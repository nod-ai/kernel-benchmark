"""
8-wave rocroller transposed MXFP4 GEMM benchmark.

Replicates test_dbuf_8wave_pingpong_mxfp_gemm_Bshuffle_lds_transposed
from adedespirlet/wave@8wavepingpong:examples/python/7.1_schedule.py.

Transposed MXFP4 GEMM: computes C^T = B * A^T instead of C = A * B^T.
MFMA left operand ("A" role) = weight B, right operand ("B" role) = activation A.
Activation A is preshuffled, A&B scales are preshuffled.
"""

import traceback
from typing import override
from pathlib import Path
import torch
import warnings
from torch.testing import assert_close

WAVE_AVAILABLE = False
try:
    import wave_lang.kernel.lang as tkl
    from wave_lang.kernel.lang.global_symbols import (
        SHARED_ADDRESS_SPACE,
    )
    from wave_lang.kernel.wave.compile import WaveCompileOptions, wave_compile
    from wave_lang.kernel.wave.scheduling.schedule_enums import SchedulingType
    from wave_lang.kernel.wave.templates import (
        get_tagged_mxfp4_gemm_preshuffle_scales_and_B,
    )
    from wave_lang.kernel.wave.schedules import (
        get_mxfp4_dbuf_pingpong_schedule_Bshuffled_lds,
    )
    from wave_lang.kernel.wave.utils.mxfp_utils import (
        generate_gemm_afp4wfp4_inputs,
        torchScaledGemmMXFP4,
        b_preshuffle,
        e8m0_shuffle,
    )

    WAVE_AVAILABLE = True
except Exception as e:
    warnings.warn(f"Wave backend dependencies not available: {e}")

from kernel_bench.utils.iree_utils import shape_to_iree
from kernel_bench.core.template import WaveKernelBenchmark, WaveTemplate
from ..gemm_utils import GemmConfig


# Block for the transposed 8-wave ping-pong schedule.
_BLOCK = (256, 192, 256)

# MLIR override file (generated from 7.1_schedule.py reference test)
_MLIR_OVERRIDE_FILE = Path(__file__).parent / "wave_8wave_transposed.mlir"

# Loop unrolling postprocess transform
_POSTPROCESS_TEMPLATE = """
module attributes {transform.with_named_sequence} {
    transform.named_sequence @__transform_main(%arg0: !transform.any_op {transform.readonly}) {
        %0 = transform.structured.match ops{["scf.for"]} in %arg0 : (!transform.any_op) -> !transform.any_op
        transform.loop.unroll %0 { factor = %%UNROLL_FACTOR%% } : !transform.any_op
        transform.yield
    }
}
"""


def _get_8wave_shape_from_block(block):
    """Choose an 8-wave shape (4x2 or 2x4) from block M/N dims."""
    m_blk, n_blk = block[0], block[1]
    if m_blk == 32 and n_blk == 32:
        raise ValueError(
            "Cannot satisfy both M and N=32 with an 8-wave shape "
            "constrained to (4, 2) or (2, 4)."
        )
    if m_blk == 32:
        return (2, 4)
    if n_blk == 32:
        return (4, 2)
    return (4, 2)


class WaveMxfp4Gemm8WaveRocrollerBenchmark(WaveKernelBenchmark):
    config: GemmConfig

    def __post_init__(self):
        self.kernel_regex = "gemm"
        super().__post_init__()

    def validate_config(self):
        if not WAVE_AVAILABLE:
            return False

        config = self.config
        if config.M < 4 or config.N < 4 or config.K < 4:
            return False
        if config.K % 256 != 0:
            return False
        if config.tA != "N" or config.tB != "T":
            return False
        if config.dtype != "mxfp4":
            return False
        return True

    def setup_parameters(self):
        pass

    @override
    def load_wave_kernel(self):
        config = self.config
        shape = (config.M, config.N, config.K)

        # Transpose shapes: C^T = B * A^T
        shape_t = (config.N, config.M, config.K)
        block_t = (_BLOCK[1], _BLOCK[0], _BLOCK[2])

        wave_shape = _get_8wave_shape_from_block(block_t)
        gemm, options = get_tagged_mxfp4_gemm_preshuffle_scales_and_B(
            shape_t,
            block_t,
            wave_shape=wave_shape,
            b_address_space=SHARED_ADDRESS_SPACE,
            output_dtype=tkl.bf16,
        )

        schedule = get_mxfp4_dbuf_pingpong_schedule_Bshuffled_lds(
            use_stagger=True, shape=shape_t, block=block_t
        )

        # Set UNROLL_FACTOR
        UNROLL_FACTOR = tkl.sym.UNROLL_FACTOR
        options.subs[UNROLL_FACTOR] = 2

        # Dynamic symbols
        dynamic_symbols = [tkl.sym.M, tkl.sym.N, tkl.sym.K]
        for sym in dynamic_symbols:
            if sym in options.subs:
                del options.subs[sym]

        hyperparams = options.subs
        return WaveTemplate(
            launchable=gemm,
            hyperparams=hyperparams,
            dynamic_symbols=dynamic_symbols,
            schedule=schedule,
        )

    @override
    def extra_compile_options(self):
        opts = WaveCompileOptions(
            canonicalize=True,
            schedule=SchedulingType.MANUAL,
            specialize=True,
            use_buffer_ops=True,
            minimize_shared_allocs=False,
            linearize_shared_access=True,
            wave_runtime=True,
        )

        # Override MLIR from the reference test
        if _MLIR_OVERRIDE_FILE.exists():
            opts.override_mlir = _MLIR_OVERRIDE_FILE.read_text()

        # Postprocess transform for loop unrolling
        opts.postprocess = _POSTPROCESS_TEMPLATE

        return opts

    @override
    def validate_numerics(self, device):
        config = self.config
        M, N, K = config.M, config.N, config.K

        try:
            x, w, x_scales, w_scales = generate_gemm_afp4wfp4_inputs((M, N, K))
        except Exception as e:
            self.logger.warn(
                f"Failed to generate inputs for {self.config.get_name()}",
                "".join(traceback.format_exception(e)),
            )
            return True

        try:
            torch_out = torchScaledGemmMXFP4(x, w, x_scales, w_scales)

            kernel = self.load_wave_kernel()
            compile_options = self.get_compile_options(kernel)
            wave_gemm = wave_compile(
                compile_options, kernel.launchable, kernel.schedule
            )

            # Transposed roles: B is left ("A" role), A is right ("B" role)
            w_t = w.T.contiguous().cuda()  # [N, K/2]
            x_ps = b_preshuffle(x).cuda()  # [M, K/2] preshuffled
            w_scales_ps = e8m0_shuffle(w_scales).cuda()  # [N, K/32]
            x_scales_ps = e8m0_shuffle(x_scales).cuda()  # [M, K/32]

            out = torch.zeros(M, N, dtype=torch.bfloat16, device="cuda")
            wave_gemm(w_t, w_scales_ps, x_ps, x_scales_ps, out)

            assert_close(
                torch_out, out.cpu(), check_dtype=False, check_device=False
            )
            return True

        except AssertionError as e:
            self.logger.error(
                f"Numerical accuracy failed for {self.config.get_name()} "
                f"on backend {self.backend}",
                f"{e}",
            )
            return False
        except Exception as e:
            self.logger.warn(
                f"Could not validate numerics for {self.config.get_name()} "
                f"on backend {self.backend}",
                "".join(traceback.format_exception(e)),
            )
            return True

    @override
    def get_runtime_args(self):
        config = self.config

        # Transposed: B[N, K/2] is left operand, A[M, K/2] is right operand
        # Scales are preshuffled
        inp_b       = shape_to_iree((config.N, config.K // 2),  "i8",  self.device_ctx)
        inp_b_scale = shape_to_iree((config.N, config.K // 32), "i8",  self.device_ctx)
        inp_a       = shape_to_iree((config.M, config.K // 2),  "i8",  self.device_ctx)
        inp_a_scale = shape_to_iree((config.M, config.K // 32), "i8",  self.device_ctx)
        out_c       = shape_to_iree((config.M, config.N),       "bf16", self.device_ctx)

        return [
            f"--input={inp_b}",
            f"--input={inp_b_scale}",
            f"--input={inp_a}",
            f"--input={inp_a_scale}",
            f"--input={out_c}",
            "--function=isolated_benchmark",
        ]
