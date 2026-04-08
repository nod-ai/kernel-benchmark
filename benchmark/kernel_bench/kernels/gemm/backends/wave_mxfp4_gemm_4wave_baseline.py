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
from .hipblaslt_gemm import parse_hipblaslt_us
from ..gemm_utils import GemmConfig

ROCM_LIBRARIES_DIR = "/workspace/rocm-libraries"
HIPBLASLT_DIR = f"{ROCM_LIBRARIES_DIR}/projects/hipblaslt"
# Per-variant wave directory installed by setup.sh
WAVE_DIR = os.environ.get("WAVE_DIR_WAVE_4WAVE_BASELINE", "/workspace/wave-wave_4wave_baseline")

_ERROR_KEYWORDS = ["VGPR", "memory fault", "segfault", "Segmentation fault",
                   "Bus error", "out of memory", "OOM", "illegal instruction",
                   "correctness", "numerics", "mismatch", "abort", "SIGABRT"]

def _extract_error(output: str) -> str:
    for kw in _ERROR_KEYWORDS:
        if kw.lower() in output.lower():
            for line in output.splitlines():
                if kw.lower() in line.lower():
                    return line.strip()[:200]
    lines = [l.strip() for l in output.splitlines() if l.strip()]
    return lines[-1][:200] if lines else "Unknown error"


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
        pass

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
                err = _extract_error(result.stderr + result.stdout)
                self.logger.error(
                    f"hipblaslt-bench failed (rc={result.returncode})\n"
                    f"stderr: {result.stderr[-2000:]}\nstdout: {result.stdout[-1000:]}"
                )
                return self.get_bench_result(0.0, False, error_msg=err)

            mean_time_us = parse_hipblaslt_us(result.stdout)
            if mean_time_us is None or mean_time_us <= 0:
                err = "Could not parse timing from hipblaslt-bench output"
                self.logger.error(f"{err}:\n{result.stdout[-1000:]}")
                return self.get_bench_result(0.0, False, error_msg=err)

            self.logger.info(
                f"hipblaslt-bench result: {mean_time_us:.2f} us "
                f"for M={config.M} N={config.N} K={config.K}"
            )
            return self.get_bench_result(mean_time_us, True, kernel_source="aiter")

        except subprocess.TimeoutExpired:
            self.logger.error("hipblaslt-bench timed out")
            return self.get_bench_result(0.0, False, error_msg="Timeout", kernel_source="aiter")
        except Exception as e:
            self.logger.error(f"Error running hipblaslt-bench: {e}")
            return self.get_bench_result(0.0, False, error_msg=str(e), kernel_source="aiter")


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
