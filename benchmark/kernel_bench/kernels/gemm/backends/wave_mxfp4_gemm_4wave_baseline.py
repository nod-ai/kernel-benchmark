"""
4-wave baseline MXFP4 GEMM benchmark.

Uses hipblaslt-bench with ROCm/rocm-libraries @ develop (aiter baseline).
Does NOT compile or integrate wave kernels — benchmarks against hipBLASLt's
pre-existing kernel library as the aiter baseline.

Wave installation comes from iree-org/wave @ develop (Sanket's branch).
"""

from typing import override, Optional
import subprocess
import os

from kernel_bench.core.template import KernelBenchmark
from kernel_bench.tuning.hyperparam import IntegerBounds
from .hipblaslt_gemm import parse_hipblaslt_us
from ..gemm_utils import GemmConfig

_MACROTILES = [
    (256, 224, 256),
    (256, 192, 256),
    (192, 224, 256),
    (256, 160, 256),
    (224, 224, 256),
    (192, 192, 256),
    (224, 192, 256),
    (224, 160, 256),
]

ROCM_LIBRARIES_DIR = "/workspace/rocm-libraries"
HIPBLASLT_DIR = f"{ROCM_LIBRARIES_DIR}/projects/hipblaslt"
# Per-variant wave directory installed by setup.sh
WAVE_DIR = os.environ.get("WAVE_DIR_WAVE_4WAVE_BASELINE", "/workspace/wave-wave_4wave_baseline")


def _get_hipblaslt_env() -> dict:
    env = os.environ.copy()
    env["LD_LIBRARY_PATH"] = (
        f"{HIPBLASLT_DIR}/build/library:"
        f"/opt/rocm/lib:{env.get('LD_LIBRARY_PATH', '')}"
    )
    return env


class WaveMxfp4Gemm4WaveBaselineBenchmark(KernelBenchmark):
    config: GemmConfig

    def validate_config(self):
        config = self.config
        if config.M < 4 or config.N < 4 or config.K < 4:
            return False
        if config.K % 256 != 0:
            return False
        if config.tA != "N" or config.tB != "T":
            return False
        if config.dtype != "mxfp4":
            return False
        return True

    def setup_parameters(self):
        # Record the macrotile used for this problem shape so it appears in tuningConfig.
        mt = self._select_macrotile()
        if mt is not None:
            self.add_param("BLOCK_M", IntegerBounds(mt[0], mt[0]), initial_value=mt[0])
            self.add_param("BLOCK_N", IntegerBounds(mt[1], mt[1]), initial_value=mt[1])
            self.add_param("BLOCK_K", IntegerBounds(mt[2], mt[2]), initial_value=mt[2])

    def _select_macrotile(self):
        """Pick the first macrotile whose (MT_M, MT_N) divides the problem, else first entry."""
        config = self.config
        for mt in _MACROTILES:
            if config.M % mt[0] == 0 and config.N % mt[1] == 0:
                return mt
        return _MACROTILES[0]

    @override
    def run_bench(self, device, num_iterations=1, timeout=None):
        if device.startswith("hip://"):
            device_id = int(device.split("hip://")[1])
        else:
            device_id = 0

        return self._run_hipblaslt_bench(device_id, num_iterations, timeout)

    def _run_hipblaslt_bench(self, device_id: int, num_iterations: int, timeout: Optional[float]):
        config = self.config
        cmd = _get_baseline_hipblaslt_cmd(config, device_id, num_iterations)

        env = _get_hipblaslt_env()
        env["HIP_VISIBLE_DEVICES"] = str(device_id)

        self.logger.info(f"Running hipblaslt-bench (baseline): {' '.join(cmd)}")
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True,
                timeout=timeout or 600, env=env,
            )

            if result.returncode != 0:
                self.logger.error(
                    f"hipblaslt-bench failed (rc={result.returncode})\n"
                    f"stderr: {result.stderr[-2000:]}\nstdout: {result.stdout[-1000:]}"
                )
                return self.get_bench_result(0.0, False)

            mean_time_us = parse_hipblaslt_us(result.stdout)
            if mean_time_us is None or mean_time_us <= 0:
                self.logger.error(
                    f"Could not parse timing from hipblaslt-bench output:\n{result.stdout[-1000:]}"
                )
                return self.get_bench_result(0.0, False)

            self.logger.info(
                f"hipblaslt-bench result: {mean_time_us:.2f} us "
                f"for M={config.M} N={config.N} K={config.K}"
            )
            return self.get_bench_result(mean_time_us, True)

        except subprocess.TimeoutExpired:
            self.logger.error("hipblaslt-bench timed out")
            return self.get_bench_result(0.0, False)
        except Exception as e:
            self.logger.error(f"Error running hipblaslt-bench: {e}")
            return self.get_bench_result(0.0, False)


def _get_baseline_hipblaslt_cmd(
    config: GemmConfig, device_id: int = 0, num_iterations: int = 3,
):
    return [
        f"{HIPBLASLT_DIR}/build/clients/hipblaslt-bench",
        "--api_method", "c",
        "-m", str(config.M),
        "-n", str(config.N),
        "-k", str(config.K),
        "--alpha", "1",
        "--beta", "0",
        "--transA", "T",
        "--transB", "N",
        "--batch_count", "1",
        "--scaleA", "1001",
        "--scaleB", "1001",
        "--a_type", "f4_r",
        "--b_type", "f4_r",
        "--c_type", "bf16_r",
        "--d_type", "bf16_r",
        "--compute_type", "f32_r",
        "--cold_iters", "2",
        "--iters", str(num_iterations),
        "--swizzleA",
        "--device", str(device_id),
    ]
