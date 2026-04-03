from typing import List, Tuple
import sys
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

    try:
        from .backends.wave_mxfp4_gemm_4wave_baseline import WaveMxfp4Gemm4WaveBaselineBenchmark

        backends["wave_4wave_baseline"] = WaveMxfp4Gemm4WaveBaselineBenchmark
    except Exception as e:
        warnings.warn(f"Wave MXFP4 4-wave baseline GEMM backend not available: {e}")

    try:
        from .backends.wave_mxfp4_gemm_8wave_rocroller import WaveMxfp4Gemm8WaveRocrollerBenchmark

        backends["wave_8wave_rocroller"] = WaveMxfp4Gemm8WaveRocrollerBenchmark
    except Exception as e:
        warnings.warn(f"Wave MXFP4 8-wave rocroller GEMM backend not available: {e}")

    # Auto-register any unknown wave_* backend params passed via --backend CLI arg.
    # This allows custom wave specs (e.g. wave_sanket) created in the dashboard to
    # run without requiring a hardcoded entry here.
    try:
        requested = []
        for i, arg in enumerate(sys.argv):
            if arg in ("--backend", "--backends") and i + 1 < len(sys.argv):
                requested = sys.argv[i + 1].split(",")
            elif arg.startswith("--backend=") or arg.startswith("--backends="):
                requested = arg.split("=", 1)[1].split(",")
        for param in requested:
            param = param.strip()
            if param.startswith("wave_") and param not in backends:
                base_cls = backends.get("wave")
                if base_cls is not None:
                    backends[param] = type(param, (base_cls,), {})
                    warnings.warn(
                        f"Auto-registered unknown wave backend '{param}' as WaveGemmBenchmark variant"
                    )
    except Exception as e:
        warnings.warn(f"Could not auto-register custom wave backends: {e}")

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
