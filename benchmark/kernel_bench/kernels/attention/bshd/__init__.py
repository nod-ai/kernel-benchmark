import warnings
from .problems import get_bshd_attention_configs

# Conditional imports to avoid missing dependencies for unused backends
try:
    from .backends.torch_bshd_attention import TorchBSHDAttentionBenchmark
except Exception as e:
    warnings.warn(f"Torch BSHD attention backend not available: {e}")
    TorchBSHDAttentionBenchmark = None

try:
    from .backends.triton_bshd_attention import TritonBSHDAttentionBenchmark
except Exception as e:
    warnings.warn(f"Triton BSHD attention backend not available: {e}")
    TritonBSHDAttentionBenchmark = None

try:
    from .backends.wave_bshd_attention import WaveBSHDAttentionBenchmark
except Exception as e:
    warnings.warn(f"Wave BSHD attention backend not available: {e}")
    WaveBSHDAttentionBenchmark = None


def get_default_bshd_attention_configs(kernel_type: str, backend_name: str):
    return get_bshd_attention_configs()


__all__ = [
    "TorchBSHDAttentionBenchmark",
    # "TritonBSHDAttentionBenchmark",
    "WaveBSHDAttentionBenchmark",
    "get_default_bshd_attention_configs",
]
