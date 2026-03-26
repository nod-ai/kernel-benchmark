from typing import override, Optional
import subprocess
import csv
import os
import tempfile
from pathlib import Path

from kernel_bench.core.template import KernelBenchmark
from .hipblaslt_gemm import parse_hipblaslt_us
from ..gemm_utils import GemmConfig

_BLOCK = (256, 192, 256)

ROCM_LIBRARIES_DIR = "/workspace/rocm-libraries"
HIPBLASLT_DIR = f"{ROCM_LIBRARIES_DIR}/projects/hipblaslt"
INTEGRATE_SCRIPT = f"{HIPBLASLT_DIR}/integrate_wave_kernels.py"
BENCHMARK_MXFP4_SCRIPT = "wave_lang/kernel/wave/perf/benchmark_mxfp4.py"
WAVE_DIR = "/workspace/wave"


class WaveMxfp4Gemm4WaveRocrollerBenchmark(KernelBenchmark):
    config: GemmConfig

    def validate_config(self):
        config = self.config
        if config.M < 4 or config.N < 4 or config.K < 4:
            return False
        if config.K % 2 != 0:
            return False
        if config.tA != "N" or config.tB != "T":
            return False
        if config.dtype != "mxfp4":
            return False
        return True

    @override
    def run_bench(self, device, num_iterations=1, timeout=None):
        if device.startswith("hip://"):
            device_id = int(device.split("hip://")[1])
        else:
            device_id = 0

        result = self._run_automated(device_id, num_iterations, timeout)
        if result is not None:
            return result

        self.logger.info("Automated integration unavailable, falling back to hipblaslt-bench")
        return self._run_via_hipblaslt_bench(device_id, num_iterations, timeout)

    def _run_automated(self, device_id: int, num_iterations: int, timeout: Optional[float]):
        """
        Two-step automated flow:
        1. benchmark_mxfp4.py --dynamic: compile wave kernel → assembly + manifest
        2. integrate_wave_kernels.py: patch, integrate, rebuild, benchmark
        """
        bench_script = Path(WAVE_DIR) / BENCHMARK_MXFP4_SCRIPT
        integrate_script = Path(INTEGRATE_SCRIPT)

        if not bench_script.exists():
            self.logger.info(f"benchmark_mxfp4.py not found at {bench_script}")
            return None
        if not integrate_script.exists():
            self.logger.info(f"integrate_wave_kernels.py not found at {integrate_script}")
            return None

        config = self.config
        work_dir = Path(tempfile.mkdtemp(prefix="rocroller_"))
        asm_output_dir = work_dir / "wave_asm"
        shapes_csv = work_dir / "shapes.csv"

        with open(shapes_csv, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["M", "N", "K"])
            writer.writerow([config.M, config.N, config.K])

        env = os.environ.copy()
        env["HIP_VISIBLE_DEVICES"] = str(device_id)

        # Step 1: Compile wave kernel to assembly + manifest
        compile_cmd = [
            "python", str(bench_script),
            "--dynamic",
            "--block", str(_BLOCK[0]), str(_BLOCK[1]), str(_BLOCK[2]),
            "-o", str(asm_output_dir),
        ]

        try:
            proc = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                timeout=timeout or 600,
                cwd=WAVE_DIR,
                env=env,
            )
            if proc.returncode != 0:
                self.logger.error(
                    f"benchmark_mxfp4.py failed (rc={proc.returncode})\n"
                    f"stderr: {proc.stderr}\nstdout: {proc.stdout}"
                )
                return self.get_bench_result(0.0, False)
        except subprocess.TimeoutExpired:
            self.logger.error("benchmark_mxfp4.py timed out")
            return self.get_bench_result(0.0, False)
        except Exception as e:
            self.logger.error(f"Error running benchmark_mxfp4.py: {e}")
            return None

        if not asm_output_dir.exists():
            self.logger.error(f"Assembly output dir not found at {asm_output_dir}")
            return self.get_bench_result(0.0, False)

        # Step 2: Integrate kernels, rebuild hipblaslt-bench, and benchmark
        integrate_cmd = [
            "python", str(integrate_script),
            str(asm_output_dir),
            "--build",
            "--benchmark",
            "--flip-macrotiles",
            "--shapes", str(shapes_csv),
        ]

        try:
            proc = subprocess.run(
                integrate_cmd,
                capture_output=True,
                text=True,
                timeout=timeout or 1200,
                cwd=HIPBLASLT_DIR,
                env=env,
            )
            if proc.returncode != 0:
                self.logger.error(
                    f"integrate_wave_kernels.py failed (rc={proc.returncode})\n"
                    f"stderr: {proc.stderr}\nstdout: {proc.stdout}"
                )
                return self.get_bench_result(0.0, False)

            return self._parse_integrate_output(proc.stdout, work_dir)

        except subprocess.TimeoutExpired:
            self.logger.error("integrate_wave_kernels.py timed out")
            return self.get_bench_result(0.0, False)
        except Exception as e:
            self.logger.error(f"Error running integrate_wave_kernels.py: {e}")
            return self.get_bench_result(0.0, False)

    def _parse_integrate_output(self, stdout: str, work_dir: Path):
        """Parse results from integrate_wave_kernels.py output or CSV."""
        # Try to find a results CSV in the work directory or hipblaslt dir
        for candidate in [
            work_dir / "results.csv",
            Path(HIPBLASLT_DIR) / "results.csv",
            Path(HIPBLASLT_DIR) / "benchmark_results.csv",
        ]:
            if candidate.exists():
                return self._parse_results_csv(candidate)

        # Fall back to parsing hipblaslt-bench output from stdout
        try:
            mean_time_us = parse_hipblaslt_us(stdout)
            return self.get_bench_result(mean_time_us, True)
        except ValueError:
            pass

        self.logger.error(
            f"Could not parse results from integrate_wave_kernels.py\nstdout: {stdout}"
        )
        return self.get_bench_result(0.0, False)

    def _parse_results_csv(self, results_csv: Path):
        try:
            with open(results_csv, "r") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    us_val = row.get("us") or row.get("mean_us") or row.get("time_us")
                    if us_val is not None:
                        return self.get_bench_result(float(us_val), True)

            self.logger.error(f"No timing column found in {results_csv}")
            return self.get_bench_result(0.0, False)
        except Exception as e:
            self.logger.error(f"Failed to parse results CSV: {e}")
            return self.get_bench_result(0.0, False)

    def _run_via_hipblaslt_bench(self, device_id: int, num_iterations: int, timeout: Optional[float]):
        config = self.config
        cmd = _get_rocroller_hipblaslt_cmd(config, device_id, num_iterations)

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=timeout or 600,
            )

            if result.returncode != 0:
                self.logger.error(
                    f"hipblaslt-bench failed (rc={result.returncode})\n"
                    f"stderr: {result.stderr}\nstdout: {result.stdout}"
                )
                return self.get_bench_result(0.0, False)

            mean_time_us = parse_hipblaslt_us(result.stdout)
            return self.get_bench_result(mean_time_us, True)

        except subprocess.TimeoutExpired:
            self.logger.error("hipblaslt-bench timed out")
            return self.get_bench_result(0.0, False)
        except Exception as e:
            self.logger.error(f"Error running hipblaslt-bench: {e}")
            return self.get_bench_result(0.0, False)


def _get_rocroller_hipblaslt_cmd(
    config: GemmConfig, device_id: int = 0, num_iterations: int = 3,
):
    return [
        "hipblaslt-bench",
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
        "--rotating", "0",
        "--cold_iters", "1",
        "--iters", str(num_iterations),
        "--use_gpu_timer",
        "--swizzleA",
        "--device", str(device_id),
    ]
