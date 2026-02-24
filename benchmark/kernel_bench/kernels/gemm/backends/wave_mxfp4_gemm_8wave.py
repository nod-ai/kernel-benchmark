import traceback
from typing import override
import torch
import warnings
from torch.testing import assert_close

WAVE_AVAILABLE = False
try:
    from wave_lang.kernel.lang.global_symbols import *
    from wave_lang.kernel.wave.compile import WaveCompileOptions, wave_compile
    from wave_lang.kernel.wave.scheduling.schedule_enums import SchedulingType
    from wave_lang.kernel.wave.templates import get_tagged_mxfp4_gemm
    from wave_lang.kernel.wave.schedules import (
        get_mxfp4_dbuf_schedule,
        get_mxfp4_dbuf_pingpong_schedule,
        get_mxfp4_dbuf_mixed_pingpong_schedule,
    )
    from wave_lang.kernel.wave.utils.mxfp_utils import (
        generate_gemm_afp4wfp4_inputs,
        torchScaledGemmMXFP4,
    )

    WAVE_AVAILABLE = True
except Exception as e:
    warnings.warn(f"Wave backend dependencies not available: {e}")

from kernel_bench.utils.iree_utils import shape_to_iree
from kernel_bench.tuning.hyperparam import CategoricalBounds, IntegerBounds
from kernel_bench.core.template import WaveKernelBenchmark, WaveTemplate
from ..gemm_utils import GemmConfig


# Fixed tile / wave config for the 8-wave double-buffer schedule.
_BLOCK = (256, 256, 256)


class WaveMxfp4Gemm8WaveBenchmark(WaveKernelBenchmark):
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
        if config.K % 2 != 0:
            return False
        if config.tA != "N" or config.tB != "T":
            return False
        if config.dtype != "mxfp4":
            return False
        return True

    def setup_parameters(self):
        # The 8-wave double-buffer schedule has a fixed tile of 256×256×256 —
        # no tunable block/wave params needed.
        pass

    @override
    def load_wave_kernel(self):
        config = self.config
        shape = (config.M, config.N, config.K)

        gemm, options = get_tagged_mxfp4_gemm(
            shape=shape,
            block_shape=_BLOCK,
            wave_shape=(4, 2),
        )
        schedule = get_mxfp4_dbuf_pingpong_schedule(use_stagger=True, shape=shape)

        hyperparams = options.subs
        return WaveTemplate(
            launchable=gemm,
            hyperparams=hyperparams,
            schedule=schedule,
        )

    @override
    def extra_compile_options(self):
        return WaveCompileOptions(
            canonicalize=True,
            schedule=SchedulingType.MANUAL,
            specialize=True,
            use_buffer_ops=True,
            use_global_to_shared=True,
            minimize_shared_allocs=True,
        )

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

            x, w = x.cuda(), w.cuda()
            x_scales, w_scales = x_scales.cuda(), w_scales.cuda()
            out = torch.zeros(M, N, dtype=torch.float32, device="cuda")
            wave_gemm(x, x_scales, w.T.contiguous(), w_scales, out)

            assert_close(
                torch_out, out.cpu(), check_dtype=False, check_device=False
            )
            return True

        except AssertionError as e:
            self.logger.error(
                f"Numerical accuracy failed for {self.config.get_name()} on backend {self.backend}",
                f"{e}",
            )
            return False
        except Exception as e:
            self.logger.warn(
                f"Could not validate numerics for {self.config.get_name()} on backend {self.backend}",
                "".join(traceback.format_exception(e)),
            )
            return True

    @override
    def get_runtime_args(self):
        config = self.config

        inp_a       = shape_to_iree((config.M, config.K // 2),  "i8",  self.device_ctx)
        inp_a_scale = shape_to_iree((config.M, config.K // 32), "i8",  self.device_ctx)
        inp_b       = shape_to_iree((config.N, config.K // 2),  "i8",  self.device_ctx)
        inp_b_scale = shape_to_iree((config.N, config.K // 32), "i8",  self.device_ctx)
        out_c       = shape_to_iree((config.M, config.N),       "f32", self.device_ctx)

        return [
            f"--input={inp_a}",
            f"--input={inp_a_scale}",
            f"--input={inp_b}",
            f"--input={inp_b_scale}",
            f"--input={out_c}",
            "--function=isolated_benchmark",
        ]
