from typing import List, Tuple

# Import config from new location
from kernel_bench.config.types.gemm import GemmConfig

# Lazy imports with guards for backends
def _get_backend_classes():
    """Lazily import backend classes only when needed"""
    backends = {}
    
    try:
        from .backends.wave_gemm import WaveGemmBenchmark
        backends['wave'] = WaveGemmBenchmark
    except ImportError:
        pass
    
    try:
        from .backends.iree_gemm import IREEGemmBenchmark
        backends['iree'] = IREEGemmBenchmark
    except ImportError:
        pass
    
    try:
        from .backends.torch_gemm import TorchGemmBenchmark
        backends['torch'] = TorchGemmBenchmark
    except ImportError:
        pass
    
    try:
        from .backends.triton_gemm import TritonGemmBenchmark
        backends['triton'] = TritonGemmBenchmark
    except ImportError:
        pass
    
    try:
        from .backends.hipblaslt_gemm import HipBLASLtGemmBenchmark
        backends['hipblaslt'] = HipBLASLtGemmBenchmark
    except ImportError:
        pass
    
    return backends

from .problems import (
    get_80k_gemm_configs,
    get_gemm_comparison,
    get_gemm_configs,
    get_meta_gemms,
    get_paper_gemms,
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
    configs += get_80k_gemm_configs(20_000)
    return configs


# Dynamically build the GEMM_BENCH dictionary with available backends     
GEMM_BENCH = {"gemm": _get_backend_classes()}
