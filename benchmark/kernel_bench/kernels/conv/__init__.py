# Import config from new location
from kernel_bench.config.types.conv import ConvConfig
import warnings

from .problems import get_tk_conv_configs


def _get_backend_classes():
    """Lazily import backend classes only when needed"""
    backends = {}
    
    try:
        from .backends.wave_conv import WaveConvBenchmark
        backends['wave'] = WaveConvBenchmark
    except Exception as e:
        warnings.warn(f"Wave conv backend not available: {e}")
    
    try:
        from .backends.iree_conv import IREEConvBenchmark
        backends['iree'] = IREEConvBenchmark
    except Exception as e:
        warnings.warn(f"IREE conv backend not available: {e}")
    
    try:
        from .backends.torch_conv import TorchConvBenchmark
        backends['torch'] = TorchConvBenchmark
    except Exception as e:
        warnings.warn(f"Torch conv backend not available: {e}")
    
    return backends


def get_default_conv_configs(kernel_type: str, backend_name: str):
    configs = get_tk_conv_configs()
    if backend_name == "torch":
        configs = [(tag, config) for tag, config in configs if "nchw" in config.OP]
    return configs


CONV_BENCH = {"conv": _get_backend_classes()}
