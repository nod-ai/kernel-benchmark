from typing import override, Optional
import subprocess
import csv
import os
import tempfile
import threading
from pathlib import Path

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
INTEGRATE_SCRIPT = f"{HIPBLASLT_DIR}/integrate_wave_kernels.py"
# Per-variant wave directory: setup.sh installs wave for each rocroller backend separately
WAVE_DIR = os.environ.get("WAVE_DIR_WAVE_4WAVE_ROCROLLER", "/workspace/wave-wave_4wave_rocroller")
# Compile flags match Wave test test_dbuf_4wave_mxfp_dynamic_preshuffle_b_gemm_asm
# (preshuffle-B, wave_shape 2×2, reorder_workgroups, dynamic M/N/K, ASM backend).
BENCH_SCRIPT = f"{WAVE_DIR}/wave_lang/kernel/wave/perf/benchmark_mxfp4_4wave.py"

_integration_lock = threading.Lock()
_integration_attempted = False
_integration_succeeded = False


def _get_hipblaslt_env() -> dict:
    env = os.environ.copy()
    env["LD_LIBRARY_PATH"] = (
        f"{HIPBLASLT_DIR}/build/library:"
        f"{HIPBLASLT_DIR}/build/rocroller:"
        f"/opt/rocm/lib:{env.get('LD_LIBRARY_PATH', '')}"
    )
    return env


def _get_compile_env() -> dict:
    """Clean env for Wave compilation — no custom hipblaslt to avoid
    undefined-symbol crashes when torch loads libhipblaslt.so."""
    env = os.environ.copy()
    env["WAVE_CACHE_ON"] = "0"
    # Ensure subprocess uses this backend's wave installation
    env["PYTHONPATH"] = f"{WAVE_DIR}:{env.get('PYTHONPATH', '')}"
    ld = env.get("LD_LIBRARY_PATH", "")
    if "/opt/rocm/lib" not in ld:
        env["LD_LIBRARY_PATH"] = f"/opt/rocm/lib:{ld}"
    return env


def _try_compile_and_integrate(device_id: int, logger) -> bool:
    """One-time compile + integrate. Returns True on success."""
    global _integration_attempted, _integration_succeeded

    with _integration_lock:
        if _integration_attempted:
            return _integration_succeeded
        _integration_attempted = True

    bench_script = Path(BENCH_SCRIPT)
    integrate_script = Path(INTEGRATE_SCRIPT)

    if not bench_script.exists():
        logger.info(
            f"Wave perf script not found at {bench_script} "
            f"(install benchmark_mxfp4_4wave.py into wave or use Wave tree with perf script); "
            f"skipping compile"
        )
        return False
    if not integrate_script.exists():
        logger.info(
            f"integrate_wave_kernels.py not found at {integrate_script} "
            f"(need rocm-libraries hipBLASLt fork); skipping integration"
        )
        return False

    work_dir = Path(tempfile.mkdtemp(prefix="rocroller_"))
    asm_dir = work_dir / "wave_asm"
    shapes_csv = work_dir / "wave_shapes.csv"

    with open(shapes_csv, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["M", "N", "K", "MT_M", "MT_N", "MT_K"])
        for mt in _MACROTILES:
            writer.writerow([
                max(mt[0], 512), max(mt[1], 512), max(mt[2], 512),
                mt[0], mt[1], mt[2],
            ])

    # Step 1: Compile wave kernel with CLEAN env (no custom hipblaslt)
    compile_env = _get_compile_env()
    compile_env["HIP_VISIBLE_DEVICES"] = str(device_id)

    compile_cmd = [
        "python", "-u", str(bench_script),
        "--shapes", str(shapes_csv),
        "--dynamic",
        "--skip-validate",
        "--asm-dir", str(asm_dir),
        "-o", str(work_dir / "wave_compile_results.csv"),
    ]

    logger.info(f"Compiling wave kernel: {' '.join(compile_cmd)}")
    try:
        proc = subprocess.run(
            compile_cmd,
            capture_output=True, text=True, timeout=600,
            cwd=WAVE_DIR, env=compile_env,
        )
        if proc.returncode != 0:
            logger.warning(
                f"Wave compilation failed (rc={proc.returncode}). "
                f"Using pre-integrated kernels from rocm-libraries fork.\n"
                f"stderr: {proc.stderr[-4000:]}\nstdout: {proc.stdout[-2000:]}"
            )
            return False
    except Exception as e:
        logger.warning(f"Wave compilation error: {e}. Using pre-integrated kernels.")
        return False

    if not asm_dir.exists() or not list(asm_dir.glob("*.s")):
        logger.warning("No assembly files produced. Using pre-integrated kernels.")
        return False

    # Step 2: Integrate into hipBLASLt with hipblaslt env
    integrate_env = _get_hipblaslt_env()
    integrate_env["HIP_VISIBLE_DEVICES"] = str(device_id)

    integrate_cmd = [
        "python", str(integrate_script),
        "--asm-dir", str(asm_dir),
        "--flip-macrotiles",
        "--build",
    ]

    logger.info(f"Integrating wave kernels: {' '.join(integrate_cmd)}")
    try:
        proc = subprocess.run(
            integrate_cmd,
            capture_output=True, text=True, timeout=1800,
            cwd=HIPBLASLT_DIR, env=integrate_env,
        )
        if proc.returncode != 0:
            logger.warning(
                f"Integration failed (rc={proc.returncode}). "
                f"Using pre-integrated kernels.\n"
                f"stderr: {proc.stderr[-2000:]}"
            )
            return False
    except Exception as e:
        logger.warning(f"Integration error: {e}. Using pre-integrated kernels.")
        return False

    logger.info("Wave kernel compilation and integration succeeded")
    _integration_succeeded = True
    return True


class WaveMxfp4Gemm4WaveRocrollerBenchmark(KernelBenchmark):
    config: GemmConfig

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

        _try_compile_and_integrate(device_id, self.logger)

        return self._run_hipblaslt_bench(device_id, num_iterations, timeout)

    def _run_hipblaslt_bench(self, device_id: int, num_iterations: int, timeout: Optional[float]):
        config = self.config
        cmd = _get_rocroller_hipblaslt_cmd(config, device_id, num_iterations)

        env = _get_hipblaslt_env()
        env["HIP_VISIBLE_DEVICES"] = str(device_id)

        self.logger.info(f"Running hipblaslt-bench: {' '.join(cmd)}")
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
