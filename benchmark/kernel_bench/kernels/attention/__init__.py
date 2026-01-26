from .bshd import *
from .extend import *
from .vanilla import *

# Build ATTENTION_BENCH, filtering out None values (backends that failed to import)
ATTENTION_BENCH = {
    "attention": {
        backend: cls
        for backend, cls in {
            "wave": WaveVanillaAttentionBenchmark,
            "iree": IREEVanillaAttentionBenchmark,
            "torch": TorchVanillaAttentionBenchmark,
            "triton": TritonVanillaAttentionBenchmark,
        }.items()
        if cls is not None
    },
    "bshd_attention": {
        backend: cls
        for backend, cls in {
            "wave": WaveBSHDAttentionBenchmark,
            "triton": TritonBSHDAttentionBenchmark,
            "torch": TorchBSHDAttentionBenchmark,
        }.items()
        if cls is not None
    },
    "extend_attention": {
        backend: cls
        for backend, cls in {
            "wave": WaveExtendAttentionBenchmark,
            "triton": TritonExtendAttentionBenchmark,
            "torch": TorchExtendAttentionBenchmark,
        }.items()
        if cls is not None
    },
}
