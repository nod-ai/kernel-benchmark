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
        backends['wave'] = WaveGemmBenchmark
    except Exception as e:
        warnings.warn(f"Wave GEMM backend not available: {e}")
        WaveGemmBenchmark = None
    
    try:
        from .backends.iree_gemm import IREEGemmBenchmark
        backends['iree'] = IREEGemmBenchmark
    except Exception as e:
        warnings.warn(f"IREE GEMM backend not available: {e}")
        IREEGemmBenchmark = None

    try:
        from .backends.torch_gemm import TorchGemmBenchmark
        backends['torch'] = TorchGemmBenchmark
    except Exception as e:
        warnings.warn(f"Torch GEMM backend not available: {e}")
        TorchGemmBenchmark = None
        
    try:
        from .backends.triton_gemm import TritonGemmBenchmark
        backends['triton'] = TritonGemmBenchmark
    except Exception as e:
        warnings.warn(f"Triton GEMM backend not available: {e}")
        TritonGemmBenchmark = None
        
    try:
        from .backends.hipblaslt_gemm import HipBLASLtGemmBenchmark
        backends['hipblaslt'] = HipBLASLtGemmBenchmark
    except Exception as e:
        warnings.warn(f"hipBLASLt GEMM backend not available: {e}")
        HipBLASLtGemmBenchmark = None
        
    return backends

from .problems import (
    get_80k_gemm_configs,
    get_gemm_comparison,
    get_gemm_configs,
    get_meta_gemms,
    get_paper_gemms,
    get_small_grid_gemms,
    get_medium_grid_gemms,
    get_tk_gemm_configs,
    get_b200_gemm_configs,
    get_trial_configs,
)


def get_default_gemm_configs(kernel_type: str, backend_name: str):
    configs = []
    # configs += get_meta_gemms()
    # configs += get_gemm_configs("f16")
    # configs += get_gemm_configs("bf16")
    # configs += get_trial_configs()
    # configs += get_gemm_configs("f8")
    # configs += get_paper_gemms()
    # configs += get_80k_gemm_configs(100)
    configs += get_medium_grid_gemms()
    return configs


# Dynamically build the GEMM_BENCH dictionary with available backends     
GEMM_BENCH = {"gemm": _get_backend_classes()}
