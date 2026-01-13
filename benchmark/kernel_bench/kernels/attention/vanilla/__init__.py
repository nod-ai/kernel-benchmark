import warnings
from .problems import get_vanilla_attention_configs

# Conditional imports to avoid missing dependencies for unused backends
try:
    from .backends.wave_vanilla_attention import WaveVanillaAttentionBenchmark
except Exception as e:
    warnings.warn(f"Wave vanilla attention backend not available: {e}")
    WaveVanillaAttentionBenchmark = None

try:
    from .backends.iree_vanilla_attention import IREEVanillaAttentionBenchmark
except Exception as e:
    warnings.warn(f"IREE vanilla attention backend not available: {e}")
    IREEVanillaAttentionBenchmark = None

try:
    from .backends.torch_vanilla_attention import TorchVanillaAttentionBenchmark
except Exception as e:
    warnings.warn(f"Torch vanilla attention backend not available: {e}")
    TorchVanillaAttentionBenchmark = None

try:
    from .backends.triton_vanilla_attention import TritonVanillaAttentionBenchmark
except Exception as e:
    warnings.warn(f"Triton vanilla attention backend not available: {e}")
    TritonVanillaAttentionBenchmark = None


def get_default_attention_configs(kernel_type: str, backend_name: str):
    return [
        (tag, config) for tag, config in get_vanilla_attention_configs(use_fp8=True)
    ]


__all__ = [
    "WaveVanillaAttentionBenchmark",
    "IREEVanillaAttentionBenchmark",
    "TorchVanillaAttentionBenchmark",
    # "TritonVanillaAttentionBenchmark",
    "get_default_attention_configs",
]
