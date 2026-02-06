from typing import Optional

import triton

# Import guards for backend-specific dependencies
TRITON_AVAILABLE = False
try:
    import torch
    from aiter.ops.triton.gemm_afp4wfp4 import gemm_afp4wfp4
    from kernel_bench.utils.torch_utils import benchmark_function_torch

    TRITON_AVAILABLE = True
except Exception as e:
    import warnings

    warnings.warn(f"Triton backend dependencies not available: {e}")

from kernel_bench.core.template import KernelBenchmark
from kernel_bench.kernels.gemm.gemm_utils import GemmConfig, get_mxfp4_inputs


class TritonGemmBenchmark(KernelBenchmark):
    config: GemmConfig

    def validate_config(self):
        if not TRITON_AVAILABLE:
            return False

        input_dtype = self.config.dtype
        if input_dtype != "mxfp4":
            return False

        variant = self.config.tA + self.config.tB
        if variant != "NT":
            return False

        return True

    def run_bench(self, device, num_iterations=1, timeout=None):
        config = self.config
        M, N, K = config.M, config.N, config.K

        try:
            x, w, x_scale, w_scale, triton_out = get_mxfp4_inputs(M, N, K)

            mean_time_ms = triton.testing.do_bench(
                lambda: gemm_afp4wfp4(
                    x.view(torch.uint8),
                    w.view(torch.uint8),
                    x_scale.view(torch.uint8),
                    w_scale.view(torch.uint8),
                    torch.bfloat16,
                    triton_out,
                ),
                warmup=25,
                rep=100,
            )
            mean_time_us = mean_time_ms * 1e3

        except Exception as e:
            self.logger.error(f"Failed to benchmark kernel {config.get_name()}: {e}")
            return self.get_bench_result(0, False)

        return self.get_bench_result(mean_time_us, True)
