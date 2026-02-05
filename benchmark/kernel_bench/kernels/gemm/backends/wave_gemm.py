from math import ceil
import traceback
from typing import override
import torch
import warnings
from torch.testing import assert_close

from wave_lang.kernel.wave import ScaledMMAType
from wave_lang.kernel.wave.utils.run_utils import set_default_run_config

# Import guards for backend-specific dependencies
WAVE_AVAILABLE = False
try:
    from wave_lang.kernel.wave.constraints import MMAType
    from wave_lang.kernel.lang.global_symbols import *
    from wave_lang.kernel.wave.compile import WaveCompileOptions, wave_compile
    from wave_lang.kernel.wave.utils.general_utils import get_default_scheduling_params
    from wave_lang.kernel.wave.scheduling.schedule_enums import SchedulingType
    from wave_lang.kernel.wave.templates.reordered_gemm import get_reordered_matmul
    from wave_lang.kernel.wave.utils.torch_utils import device_randn, device_zeros
    from wave_lang.kernel.wave.iree_utils import generate_iree_ref
    import wave_lang.kernel.wave as tkw
    import wave_lang.kernel.lang as tkl
    from wave_lang.kernel.wave import wave_schedule

    WAVE_AVAILABLE = True
except Exception as e:
    warnings.warn(f"Wave backend dependencies not available: {e}")

from kernel_bench.utils.dtypes.device_context import get_shared_memory_limit
from kernel_bench.utils.iree_utils import shape_to_iree
from kernel_bench.tuning.hyperparam import CategoricalBounds, IntegerBounds
from kernel_bench.core.template import WaveKernelBenchmark, WaveTemplate
from ..gemm_utils import GemmConfig, get_torch_reference


class WaveGemmBenchmark(WaveKernelBenchmark):
    config: GemmConfig

    def __post_init__(self):
        self.kernel_regex = "gemm"  # NOT SURE IF NEEDED - WORKS WITH "" AS WELL
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
        mfma_options = [
            ScaledMMAType.F32_16x16x128_F8F6F4,
            ScaledMMAType.F32_32x32x64_F8F6F4,
        ]

        self.mfma_variant = self.add_param(
            "MFMA_VARIANT",
            CategoricalBounds(mfma_options),
            initial_value=0,
            include_hyperparam=False,
        )
        self.BLOCK_M = self.add_param(
            "BLOCK_M",
            IntegerBounds(min=16, max=256, step=16),
            initial_value=256,
            clamp_value=True,
        )
        self.BLOCK_N = self.add_param(
            "BLOCK_N",
            IntegerBounds(min=16, max=256, step=16),
            initial_value=256,
            clamp_value=True,
        )
        self.BLOCK_K = self.add_param(
            "BLOCK_K",
            IntegerBounds(min=16, max=256, step=16),
            initial_value=256,
            clamp_value=True,
        )

        shared_mem_limit_bytes = get_shared_memory_limit(self.device_ctx.hip_target)
        bytes_per_el = 0.5
        shared_memory_constraint = (
            (self.BLOCK_M + 4) * self.BLOCK_K + (self.BLOCK_N + 4) * self.BLOCK_K
        ) * bytes_per_el - shared_mem_limit_bytes
        self.add_constraint(shared_memory_constraint, "shared_memory_limit")

    @override
    def load_wave_kernel(self):
        config = self.config

        mxfp4_gemm, hyperparams = get_mxfp4_gemm(
            shape=(config.M, config.N, config.K),
            mfma_variant=self.mfma_variant.value,
            block_m=self.BLOCK_M.value,
            block_n=self.BLOCK_N.value,
            block_k=self.BLOCK_K.value,
        )

        hyperparams.update(get_default_scheduling_params())
        return WaveTemplate(launchable=mxfp4_gemm, hyperparams=hyperparams)

    @override
    def extra_compile_options(self):
        options = WaveCompileOptions(
            canonicalize=True,
            schedule=SchedulingType.NONE,
            use_buffer_ops=False,
            waves_per_eu=1,
            use_global_to_shared=False,
            minimize_shared_allocs=False,
        )
        # options = set_default_run_config(options)
        return options

    @override
    def validate_numerics(self, device):
        config = self.config

        try:
            x = torch.randn((config.M, config.K), device="cuda", dtype=torch.bfloat16)
            w = torch.randn((config.N, config.K), device="cuda", dtype=torch.bfloat16)

            quant_func = aiter.get_triton_quant(aiter.QuantType.per_1x32)
            _, x_scale = quant_func(x, shuffle=False)
            _, w_scale = quant_func(w, shuffle=False)
            x_scale = x_scale[: config.M, : config.K // 32]
            w_scale = w_scale[: config.N, : config.K // 32]

            wave_out = torch.empty(
                config.M, config.N, device=x.device, dtype=torch.bfloat16
            )

        except Exception as e:
            self.logger.warn(
                f"Failed to allocate input tensors on device {device}",
                "".join(traceback.format_exception(e)),
            )
            return True

        try:
            kernel = self.load_wave_kernel()
            options = self.get_compile_options(kernel)
            gemm = wave_compile(options, kernel.launchable)
            gemm(
                x,
                x_scale.view(torch.uint8),
                w,
                w_scale.view(torch.uint8),
                wave_out,
            )

            torch_ref = get_torch_reference(
                x,
                w,
                x_scale.view(torch.uint8),
                w_scale.view(torch.uint8),
                torch.bfloat16,
            )
            assert_close(wave_out, torch_ref, check_device=False)
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

        shape_A = (config.M, config.K / 2)
        shape_B = (config.N, config.K / 2)
        shape_A_scale = (config.M, config.K / 32)
        shape_B_scale = (config.N, config.K / 32)
        shape_C = (config.M, config.N)

        inp_a = shape_to_iree(shape_A, "i8", self.device_ctx)
        inp_a_scale = shape_to_iree(shape_A_scale, "i8", self.device_ctx)
        inp_b = shape_to_iree(shape_B, "i8", self.device_ctx)
        inp_b_scale = shape_to_iree(shape_B_scale, "i8", self.device_ctx)
        out_c = shape_to_iree(shape_C, "bf16", self.device_ctx)

        runtime_args = [
            f"--input={inp_a}",
            f"--input={inp_a_scale}",
            f"--input={inp_b}",
            f"--input={inp_b_scale}",
            f"--input={out_c}",
            "--function=isolated_benchmark",
        ]
        return runtime_args


def get_mxfp4_gemm(
    shape,
    mfma_variant=ScaledMMAType.F32_16x16x128_F8F6F4,
    block_m=16,
    block_n=16,
    block_k=128,
):
    c_wave_dtype = tkl.bf16
    # Input sizes
    M = tkl.sym.M
    N = tkl.sym.N
    K = tkl.sym.K
    # Workgroup tile sizes
    BLOCK_M = tkl.sym.BLOCK_M
    BLOCK_N = tkl.sym.BLOCK_N
    BLOCK_K = tkl.sym.BLOCK_K
    # Address space (for GPU, shared(1) or global(0))
    ADDRESS_SPACE = tkl.sym.ADDRESS_SPACE

    # Expose user-constraints
    constraints: list[tkw.Constraint] = [tkw.WorkgroupConstraint(M, BLOCK_M, 0)]
    constraints += [tkw.WorkgroupConstraint(N, BLOCK_N, 1)]
    constraints += [tkw.TilingConstraint(K, BLOCK_K)]
    constraints += [tkw.WaveConstraint(M, BLOCK_M / 4)]
    constraints += [tkw.WaveConstraint(N, BLOCK_N / 2)]

    constraints += [tkw.HardwareConstraint(threads_per_wave=64, mma_type=mfma_variant)]

    @tkw.wave(constraints)
    def gemm_afp4_wfp4_wave(
        a: tkl.Memory[M, K / 2, ADDRESS_SPACE, tkl.i8],
        a_scale: tkl.Memory[M, K / 32, ADDRESS_SPACE, tkl.i8],
        b: tkl.Memory[N, K / 2, ADDRESS_SPACE, tkl.i8],
        b_scale: tkl.Memory[N, K / 32, ADDRESS_SPACE, tkl.i8],
        c: tkl.Memory[M, N, GLOBAL_ADDRESS_SPACE, tkl.bf16],
    ):
        c_reg = tkl.Register[M, N, tkl.f32](0.0)

        @tkw.iterate(K, init_args=[c_reg])
        def repeat(acc: tkl.Register[M, N, tkl.f32]) -> tkl.Register[M, N, tkl.f32]:
            a_reg = tkw.read(a)
            a_reg = tkw.bitcast(a_reg, tkl.f4e2m1fn)
            a_scale_reg = tkw.read(a_scale)
            a_scale_reg = tkw.bitcast(a_scale_reg, tkl.f8e8m0fnu)
            b_reg = tkw.read(b)
            b_reg = tkw.bitcast(b_reg, tkl.f4e2m1fn)
            b_scale_reg = tkw.read(b_scale)
            b_scale_reg = tkw.bitcast(b_scale_reg, tkl.f8e8m0fnu)
            acc = tkw.scaled_mma(a_reg, a_scale_reg, b_reg, b_scale_reg, acc)
            return acc

        casted = tkw.cast(repeat, c_wave_dtype)
        tkw.write(casted, c)

    hyperparams = {
        ADDRESS_SPACE: SHARED_ADDRESS_SPACE,
        BLOCK_M: block_m,
        BLOCK_N: block_n,
        BLOCK_K: block_k,
        M: shape[0],
        N: shape[1],
        K: shape[2],
    }
    hyperparams.update(get_default_scheduling_params())

    return gemm_afp4_wfp4_wave, hyperparams
