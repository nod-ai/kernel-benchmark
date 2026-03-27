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
WAVE_DIR = "/workspace/wave"


class WaveMxfp4Gemm4WaveRocrollerBenchmark(KernelBenchmark):
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
        Two-step automated flow per WAVE_KERNEL_BENCHMARKING.md:
        1. benchmark_mxfp4.py --shapes <csv> --dynamic --skip-validate --asm-dir <dir>
        2. integrate_wave_kernels.py --asm-dir <dir> --flip-macrotiles --build --benchmark
        """
        bench_script = Path(WAVE_DIR) / "wave_lang/kernel/wave/perf/benchmark_mxfp4.py"
        integrate_script = Path(INTEGRATE_SCRIPT)

        if not bench_script.exists():
            self.logger.info(f"benchmark_mxfp4.py not found at {bench_script}")
            return None
        if not integrate_script.exists():
            self.logger.info(f"integrate_wave_kernels.py not found at {integrate_script}")
            return None

        config = self.config
        work_dir = Path(tempfile.mkdtemp(prefix="rocroller_"))
        asm_dir = work_dir / "wave_asm"
        shapes_csv = work_dir / "wave_shapes.csv"

        # Shapes CSV in wave convention: M,N,K,MT_M,MT_N,MT_K
        with open(shapes_csv, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["M", "N", "K", "MT_M", "MT_N", "MT_K"])
            writer.writerow([
                config.M, config.N, config.K,
                _BLOCK[0], _BLOCK[1], _BLOCK[2],
            ])

        env = os.environ.copy()
        env["HIP_VISIBLE_DEVICES"] = str(device_id)
        env["WAVE_CACHE_ON"] = "0"
        if "/opt/rocm/lib" not in env.get("LD_LIBRARY_PATH", ""):
            env["LD_LIBRARY_PATH"] = f"/opt/rocm/lib:{env.get('LD_LIBRARY_PATH', '')}"

        # Step 1: Compile wave kernel → assembly + manifest
        compile_cmd = [
            "python", "-u", str(bench_script),
            "--shapes", str(shapes_csv),
            "--dynamic",
            "--skip-validate",
            "--asm-dir", str(asm_dir),
            "-o", str(work_dir / "wave_compile_results.csv"),
        ]

        self.logger.info(f"Step 1: Compiling wave kernel: {' '.join(compile_cmd)}")
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

        if not asm_dir.exists():
            self.logger.error(f"Assembly output dir not found at {asm_dir}")
            return self.get_bench_result(0.0, False)

        # Step 2: Integrate, rebuild, and benchmark via hipBLASLt
        integrate_cmd = [
            "python", str(integrate_script),
            "--asm-dir", str(asm_dir),
            "--flip-macrotiles",
            "--build",
            "--benchmark",
            "--benchmark-iters", str(num_iterations),
        ]

        self.logger.info(f"Step 2: Integrating & benchmarking: {' '.join(integrate_cmd)}")
        try:
            proc = subprocess.run(
                integrate_cmd,
                capture_output=True,
                text=True,
                timeout=timeout or 1800,
                cwd=HIPBLASLT_DIR,
                env=env,
            )
            if proc.returncode != 0:
                self.logger.error(
                    f"integrate_wave_kernels.py failed (rc={proc.returncode})\n"
                    f"stderr: {proc.stderr}\nstdout: {proc.stdout}"
                )
                return self.get_bench_result(0.0, False)

            return self._parse_integrate_output(proc.stdout, asm_dir)

        except subprocess.TimeoutExpired:
            self.logger.error("integrate_wave_kernels.py timed out")
            return self.get_bench_result(0.0, False)
        except Exception as e:
            self.logger.error(f"Error running integrate_wave_kernels.py: {e}")
            return self.get_bench_result(0.0, False)

    def _parse_integrate_output(self, stdout: str, asm_dir: Path):
        """Parse results from integrate_wave_kernels.py output CSV."""
        # Per docs, results are at <asm-dir>/hipblaslt_results.csv
        results_csv = asm_dir / "hipblaslt_results.csv"
        if results_csv.exists():
            return self._parse_results_csv(results_csv)

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
        """
        Parse hipblaslt_results.csv with columns:
        tag, m, n, k, status, kernel_source, tile, tflops, runtime_us, correctness
        """
        try:
            config = self.config
            with open(results_csv, "r") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    row_m = int(row.get("m", 0))
                    row_n = int(row.get("n", 0))
                    row_k = int(row.get("k", 0))

                    # Match by shape (hipBLASLt convention: m,n,k)
                    # Wave (M,N,K) = hipBLASLt (n,m,k) due to M/N swap
                    if row_m == config.N and row_n == config.M and row_k == config.K:
                        us_val = row.get("runtime_us")
                        if us_val is not None:
                            self.logger.info(
                                f"Matched shape m={row_m},n={row_n},k={row_k}: "
                                f"kernel_source={row.get('kernel_source', '?')}, "
                                f"tflops={row.get('tflops', '?')}, "
                                f"runtime_us={us_val}"
                            )
                            return self.get_bench_result(float(us_val), True)

            # If exact match not found, use the first valid row
            with open(results_csv, "r") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    us_val = row.get("runtime_us")
                    if us_val is not None and float(us_val) > 0:
                        self.logger.info(
                            f"Using first result: runtime_us={us_val}, "
                            f"kernel_source={row.get('kernel_source', '?')}"
                        )
                        return self.get_bench_result(float(us_val), True)

            self.logger.error(f"No valid results in {results_csv}")
            return self.get_bench_result(0.0, False)
        except Exception as e:
            self.logger.error(f"Failed to parse results CSV: {e}")
            return self.get_bench_result(0.0, False)

    def _run_via_hipblaslt_bench(self, device_id: int, num_iterations: int, timeout: Optional[float]):
        """Direct hipblaslt-bench fallback (assumes kernels are already integrated)."""
        config = self.config
        cmd = _get_rocroller_hipblaslt_cmd(config, device_id, num_iterations)

        try:
            env = os.environ.copy()
            env["LD_LIBRARY_PATH"] = (
                f"{HIPBLASLT_DIR}/build/library:"
                f"{HIPBLASLT_DIR}/build/rocroller:"
                f"{env.get('LD_LIBRARY_PATH', '')}"
            )
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=timeout or 600,
                env=env,
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
