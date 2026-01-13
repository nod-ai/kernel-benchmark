import warnings
from .problems import get_extend_attention_configs

# Conditional imports to avoid missing dependencies for unused backends
try:
    from .backends.triton_extend_attention import TritonExtendAttentionBenchmark
except Exception as e:
    warnings.warn(f"Triton extend attention backend not available: {e}")
    TritonExtendAttentionBenchmark = None

try:
    from .backends.torch_extend_attention import TorchExtendAttentionBenchmark
except Exception as e:
    warnings.warn(f"Torch extend attention backend not available: {e}")
    TorchExtendAttentionBenchmark = None

try:
    from .backends.wave_extend_attention import WaveExtendAttentionBenchmark
except Exception as e:
    warnings.warn(f"Wave extend attention backend not available: {e}")
    WaveExtendAttentionBenchmark = None


def get_default_extend_attention_configs(kernel_type: str, backend_name: str):
    return get_extend_attention_configs()


__all__ = [
    # "TritonExtendAttentionBenchmark",
    "TorchExtendAttentionBenchmark",
    "WaveExtendAttentionBenchmark",
    "get_default_extend_attention_configs",
]
