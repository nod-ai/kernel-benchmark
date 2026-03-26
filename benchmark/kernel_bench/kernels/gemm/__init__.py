from typing import List, Tuple
import warnings

# Import config from new location
from kernel_bench.config.types.gemm import GemmConfig


# Lazy imports with guards for backends
def _get_backend_classes():
    """Lazily import backend classes only when needed"""
    backends = {}

    try:
        from .backends.wave_gemm import WaveGemmBenchmark

        backends["wave"] = WaveGemmBenchmark
    except Exception as e:
        warnings.warn(f"Wave GEMM backend not available: {e}")
        WaveGemmBenchmark = None

    try:
        from .backends.wave_mxfp4_gemm_4wave import WaveMxfp4Gemm4WaveBenchmark

        backends["wave_4wave"] = WaveMxfp4Gemm4WaveBenchmark
    except Exception as e:
        warnings.warn(f"Wave MXFP4 4-wave GEMM backend not available: {e}")

    try:
        from .backends.wave_mxfp4_gemm_8wave import WaveMxfp4Gemm8WaveBenchmark

        backends["wave_8wave"] = WaveMxfp4Gemm8WaveBenchmark
    except Exception as e:
        warnings.warn(f"Wave MXFP4 8-wave GEMM backend not available: {e}")

    try:
        from .backends.iree_gemm import IREEGemmBenchmark

        backends["iree"] = IREEGemmBenchmark
    except Exception as e:
        warnings.warn(f"IREE GEMM backend not available: {e}")
        IREEGemmBenchmark = None

    try:
        from .backends.torch_gemm import TorchGemmBenchmark

        backends["torch"] = TorchGemmBenchmark
    except Exception as e:
        warnings.warn(f"Torch GEMM backend not available: {e}")
        TorchGemmBenchmark = None

    try:
        from .backends.triton_gemm import TritonGemmBenchmark

        backends["triton"] = TritonGemmBenchmark
    except Exception as e:
        warnings.warn(f"Triton GEMM backend not available: {e}")
        TritonGemmBenchmark = None

    try:
        from .backends.hipblaslt_gemm import HipBLASLtGemmBenchmark

        backends["hipblaslt"] = HipBLASLtGemmBenchmark
    except Exception as e:
        warnings.warn(f"hipBLASLt GEMM backend not available: {e}")
        HipBLASLtGemmBenchmark = None

    try:
        from .backends.wave_mxfp4_gemm_4wave_rocroller import WaveMxfp4Gemm4WaveRocrollerBenchmark

        backends["wave_4wave_rocroller"] = WaveMxfp4Gemm4WaveRocrollerBenchmark
    except Exception as e:
        warnings.warn(f"Wave MXFP4 4-wave rocroller GEMM backend not available: {e}")

    return backends


from .problems import (
    get_80k_gemm_configs,
    get_gemm_comparison,
    get_gemm_configs,
    get_meta_gemms,
    get_paper_gemms,
    get_model_gemms,
    get_small_grid_gemms,
    get_medium_grid_gemms,
    get_tk_gemm_configs,
    get_b200_gemm_configs,
    get_trial_configs,
    get_mxfp4_gemms,
)


def get_default_gemm_configs(kernel_type: str, backend_name: str):
    configs = []
    configs += get_mxfp4_gemms(max_per_tag=100)
    return configs


# Dynamically build the GEMM_BENCH dictionary with available backends
GEMM_BENCH = {"gemm": _get_backend_classes()}
