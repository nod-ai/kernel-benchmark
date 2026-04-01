# Copyright 2026 The IREE Authors
#
# Licensed under the Apache License v2.0 with LLVM Exceptions.
# See https://llvm.org/LICENSE.txt for license information.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception

"""
Standalone 4-wave MXFP4 Wave GEMM compilation script.

Based on the 8-wave benchmark_mxfp4.py gist, adapted for 4-wave ASM kernels.

Key differences from the 8-wave version:
  - wave_shape = (1, 4) — 4 waves total instead of 8
  - Uses WaveASM backend (backend="asm", use_wave_asm_backend=True)
  - Block size = {128, 2, 1} instead of {256, 2, 1}
  - Template: get_tagged_mxfp4_gemm_preshuffle_b (B-only preshuffle)
  - Schedule: get_mxfp4_asymmetric_schedule

Usage (compile-only, dynamic kernels):

  python benchmark_mxfp4_4wave.py \\
      --shapes shapes.csv \\
      --dynamic --skip-validate \\
      --asm-dir /tmp/wave_asm \\
      -o results.csv

Shapes CSV requires columns: M, N, K, MT_M, MT_N, MT_K (wave convention).
"""

import argparse
import csv
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Optional

import torch
from wave_lang.kernel.wave.compile import wave_compile
from wave_lang.kernel.wave.templates import get_tagged_mxfp4_gemm_preshuffle_b
from wave_lang.kernel.wave.schedules import get_mxfp4_asymmetric_schedule
from wave_lang.kernel.wave.utils.run_utils import set_default_run_config
from wave_lang.kernel.wave.utils.mxfp_utils import (
    generate_gemm_afp4wfp4_inputs,
    torchScaledGemmMXFP4,
)
from wave_lang.kernel.wave.perf.utils import (
    find_rocprof_outputs,
    get_rocprofv3_cmd,
    parse_rocprof_kernel_stats,
)
import wave_lang.kernel.lang as tkl

# ---------------------------------------------------------------------------
# 4-wave configuration
# ---------------------------------------------------------------------------

_WAVE_SHAPE = (4, 1)
_BLOCK_SIZE = [128, 2, 1]


# ---------------------------------------------------------------------------
# ASM patching (identical to 8-wave gist)
# ---------------------------------------------------------------------------


def _patch_wave_asm(asm: str) -> str:
    """Apply compatibility patches to Wave assembly source text.

    1. Remove .amdhsa_code_object_version directive
    2. Change amdhsa.version from [1, 2] to [1, 0]
    """
    asm = re.sub(
        r"^\s*\.amdhsa_code_object_version\s+\d+\s*\n",
        "",
        asm,
        flags=re.MULTILINE,
    )
    asm = re.sub(
        r"(amdhsa\.version:\s*\n\s*-\s*)1(\s*\n\s*-\s*)\d+",
        r"\g<1>1\g<2>0",
        asm,
    )
    return asm


def _kernel_name(
    shape: tuple[int, int, int],
    macrotiles: tuple[int, int, int],
    dynamic: bool = False,
) -> str:
    mt_m, mt_n, mt_k = macrotiles
    if dynamic:
        return f"wave_mxfp4_dynamic_gemm_{mt_m}x{mt_n}x{mt_k}"
    m, n, k = shape
    return f"wave_mxfp4_static_gemm_{mt_m}x{mt_n}x{mt_k}_{m}x{n}x{k}"


def _patch_and_save_asm(
    intermediates_dir: Path,
    asm_dir: Path,
    shape: tuple[int, int, int],
    macrotiles: tuple[int, int, int],
    dynamic: bool = False,
) -> None:
    """Find the .rocmasm in intermediates_dir, patch it, and write to asm_dir."""
    rocmasm_files = glob.glob(str(intermediates_dir / "*.rocmasm"))
    if not rocmasm_files:
        print(
            f"  Warning: no .rocmasm found in {intermediates_dir} for shape {shape}",
            file=sys.stderr,
        )
        return
    src_path = rocmasm_files[0]
    with open(src_path) as f:
        asm = f.read()

    name = _kernel_name(shape, macrotiles, dynamic=dynamic)
    asm = asm.replace("gemm", name)
    asm = _patch_wave_asm(asm)

    asm_dir.mkdir(parents=True, exist_ok=True)
    dst_path = asm_dir / f"{name}.s"
    dst_path.write_text(asm)
    print(f"  ASM saved: {dst_path}")


# ---------------------------------------------------------------------------
# 4-wave kernel compilation
# ---------------------------------------------------------------------------


def get_mxfp4_gemm_4wave(
    shape: tuple[int, int, int],
    macrotiles: tuple[int, int, int],
    intermediates_dir: Optional[Path] = None,
    dynamic: bool = False,
):
    """Compile a 4-wave MXFP4 GEMM kernel.

    Uses the ASM backend with wave_shape=(1,4) and block_size={128,2,1}.
    """
    gemm, options = get_tagged_mxfp4_gemm_preshuffle_b(
        shape=shape,
        block_shape=macrotiles,
        wave_shape=_WAVE_SHAPE,
    )
    options.specialize = True
    options.use_buffer_ops = True
    options.wave_runtime = True

    # 4-wave ASM backend
    options.backend = "asm"
    options.use_wave_asm_backend = True
    options.use_global_to_shared = True

    if dynamic:
        options.dynamic_symbols = [tkl.sym.M, tkl.sym.N, tkl.sym.K]
        for sym in options.dynamic_symbols:
            del options.subs[sym]

    if intermediates_dir is not None:
        options.dump_intermediates = str(intermediates_dir)

    schedule = get_mxfp4_asymmetric_schedule(is_bscale_shuffled=True)
    options = set_default_run_config(options)
    compiled_gemm = wave_compile(options, gemm, schedule)
    return compiled_gemm


# ---------------------------------------------------------------------------
# Subprocess compilation worker
# ---------------------------------------------------------------------------


def _spawn_compile_worker(
    shape: tuple[int, int, int],
    macrotiles: tuple[int, int, int],
    dump_dir: Path,
    asm_dir: Path,
    dynamic: bool,
) -> tuple[bool, str]:
    """Spawn a subprocess to compile one kernel and save its ASM."""
    m, n, k = shape
    mt_m, mt_n, mt_k = macrotiles
    cmd = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--_compile_only",
        "--_shape", str(m), str(n), str(k),
        "--_tiles", str(mt_m), str(mt_n), str(mt_k),
        "--_co-asm-dir", str(asm_dir),
        "--_co-dump-dir", str(dump_dir),
    ]
    if dynamic:
        cmd.append("--_dynamic")
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=600, cwd=os.getcwd()
        )
        if proc.returncode == 0:
            return (True, "")
        stderr_preview = (proc.stderr or "").strip()[-2000:]
        return (False, stderr_preview or f"exit code {proc.returncode}")
    except subprocess.TimeoutExpired:
        return (False, "compilation timed out (600s)")
    except Exception as e:
        return (False, str(e))


# ---------------------------------------------------------------------------
# Validation and benchmarking helpers
# ---------------------------------------------------------------------------


class BenchmarkError(RuntimeError):
    def __init__(self, message: str, stage: str):
        super().__init__(message)
        self.stage = stage


def get_flops(M: int, N: int, K: int) -> float:
    return 2.0 * M * N * K


def runtime_us_to_tflops(M: int, N: int, K: int, runtime_us: float) -> float:
    if runtime_us <= 0:
        return 0.0
    return (get_flops(M, N, K) / 1e12) / (runtime_us / 1e6)


def _clear_dir(dir_path: os.PathLike) -> None:
    if os.path.exists(dir_path):
        shutil.rmtree(dir_path)
    os.makedirs(dir_path, exist_ok=True)


def _parse_worker_stdout_for_mean_us(stdout: str) -> tuple[float, bool]:
    for line in stdout.splitlines():
        line = line.strip()
        if line.startswith("MEAN_US:"):
            try:
                return float(line.split(":", 1)[1].strip()), True
            except (ValueError, IndexError):
                pass
    return 0.0, False


def _run_torch_benchmark(
    kernel_func,
    inputs: tuple,
    warmup_iters: int = 0,
    benchmark_iters: int = 1,
) -> float:
    """Run warmup and benchmark loop; return mean runtime in microseconds."""
    for _ in range(warmup_iters):
        kernel_func(*inputs)
    torch.cuda.synchronize()

    if benchmark_iters < 1:
        return 0.0
    start_ev = torch.cuda.Event(enable_timing=True)
    end_ev = torch.cuda.Event(enable_timing=True)
    start_ev.record()
    for _ in range(benchmark_iters):
        kernel_func(*inputs)
    end_ev.record()
    torch.cuda.synchronize()
    return start_ev.elapsed_time(end_ev) / benchmark_iters * 1000.0


def run_worker(
    shape: tuple[int, int, int],
    macrotiles: tuple[int, int, int],
    warmup_iters: int = 0,
    benchmark_iters: int = 1,
    dynamic: bool = False,
) -> None:
    """Worker: compile 4-wave GEMM, run torch benchmark, print MEAN_US."""
    m, n, k = shape
    gemm_rt = get_mxfp4_gemm_4wave(shape, macrotiles, dynamic=dynamic)

    device = torch.device("cuda")
    x, w, x_scale, w_scale = generate_gemm_afp4wfp4_inputs((m, n, k), device)
    w_t = w.T.contiguous()
    wave_out = torch.empty(m, n, device=device, dtype=torch.float32)
    inputs = (x, x_scale, w_t, w_scale, wave_out)

    mean_us = _run_torch_benchmark(
        gemm_rt, inputs, warmup_iters=warmup_iters, benchmark_iters=benchmark_iters
    )
    print(f"MEAN_US: {mean_us}")


def validate_mxfp4_gemm(shape: tuple[int, int, int], compiled_gemm) -> bool:
    """Run compiled 4-wave GEMM and compare to torch reference."""
    m, n, k = shape
    try:
        device = torch.device("cuda")
        x, w, x_scale, w_scale = generate_gemm_afp4wfp4_inputs(shape, device)
        torch_ref = torchScaledGemmMXFP4(x, w, x_scale, w_scale)

        w_t = w.T.contiguous()
        wave_out = torch.zeros(m, n, device=device, dtype=torch.bfloat16)
        compiled_gemm(x, x_scale, w_t, w_scale, wave_out)

        torch.testing.assert_close(
            wave_out, torch_ref, check_device=False, check_dtype=False
        )
        return True
    except Exception as e:
        raise RuntimeError(f"Validation failed for shape {shape}: {e}") from e


def benchmark_mxfp4_gemm_rocprof(
    shape: tuple[int, int, int],
    macrotiles: tuple[int, int, int],
    profiler_dump_path: Path,
    att_library_path: Optional[str],
    kernel_regex: str = "gemm",
    timeout: Optional[float] = None,
    warmup_iters: int = 0,
    benchmark_iters: int = 1,
    dynamic: bool = False,
) -> float:
    """Run self as worker under rocprofv3; return mean runtime in microseconds."""
    m, n, k = shape
    mt_m, mt_n, mt_k = macrotiles
    _clear_dir(profiler_dump_path)
    profile_prefix = get_rocprofv3_cmd(
        profiler_dump_path, None, kernel_regex, att_library_path
    )
    worker_cmd = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--_worker",
        "--_shape", str(m), str(n), str(k),
        "--_tiles", str(mt_m), str(mt_n), str(mt_k),
        "--warmup-iters", str(warmup_iters),
        "--benchmark-iters", str(benchmark_iters),
    ]
    if dynamic:
        worker_cmd.append("--_dynamic")
    full_cmd = profile_prefix + worker_cmd
    try:
        proc = subprocess.run(
            full_cmd, timeout=timeout,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            check=False, text=True, cwd=os.getcwd(),
        )
    except subprocess.TimeoutExpired as e:
        raise RuntimeError(
            f"rocprof worker timed out after {timeout}s for shape {shape}"
        ) from e
    if proc.returncode != 0:
        stderr_preview = (proc.stderr or "").strip()[:500]
        raise RuntimeError(
            f"rocprof worker exited with code {proc.returncode} for shape {shape}"
            + (f"; stderr: {stderr_preview}" if stderr_preview else "")
        )
    _, worker_ok = _parse_worker_stdout_for_mean_us(proc.stdout)
    if not worker_ok:
        raise RuntimeError(
            f"No MEAN_US in worker stdout for shape {shape}"
        )
    stats_path, _ = find_rocprof_outputs(profiler_dump_path, None)
    if stats_path is None:
        raise RuntimeError(
            f"rocprof stats not found under {profiler_dump_path} for shape {shape}"
        )
    rocprof_stats = parse_rocprof_kernel_stats(stats_path, kernel_regex)
    if not rocprof_stats or "mean_duration_us" not in rocprof_stats:
        raise RuntimeError(
            f"rocprof stats parsing failed for {kernel_regex!r} in {stats_path}"
        )
    return rocprof_stats["mean_duration_us"]


def run_validate_and_benchmark(
    shape: tuple[int, int, int],
    macrotiles: tuple[int, int, int],
    dump_dir: Path,
    att_library_path: Optional[str],
    kernel_regex: str = "gemm",
    warmup_iters: int = 0,
    benchmark_iters: int = 1,
    asm_dir: Optional[Path] = None,
    dynamic: bool = False,
    skip_validate: bool = False,
) -> tuple[Optional[float], Optional[float], str]:
    """Compile, validate, and benchmark. Returns (runtime_us, tflops, status)."""
    m, n, k = shape
    mt_m, mt_n, mt_k = macrotiles
    gemm_id = f"gemm_{m}_{n}_{k}_MT_{mt_m}_{mt_n}_{mt_k}"

    intermediates_dir: Optional[Path] = None
    if asm_dir is not None:
        intermediates_dir = dump_dir / "intermediates" / gemm_id
        intermediates_dir.mkdir(parents=True, exist_ok=True)

    try:
        gemm_rt = get_mxfp4_gemm_4wave(
            shape, macrotiles,
            intermediates_dir=intermediates_dir, dynamic=dynamic,
        )
    except Exception as e:
        raise BenchmarkError(
            f"Compilation failed for shape {shape}: {e}", stage="compile_failed"
        ) from e

    mlir_dir = dump_dir / "mlir"
    mlir_dir.mkdir(parents=True, exist_ok=True)
    (mlir_dir / f"{gemm_id}.mlir").write_text(gemm_rt.asm)

    if asm_dir is not None and intermediates_dir is not None:
        try:
            _patch_and_save_asm(
                intermediates_dir, asm_dir, shape, macrotiles, dynamic=dynamic,
            )
        except Exception as e:
            print(
                f"  Warning: failed to save ASM for shape {shape}: {e}",
                file=sys.stderr,
            )

    if skip_validate:
        return None, None, "ok"

    try:
        validate_mxfp4_gemm(shape, gemm_rt)
    except Exception as e:
        raise BenchmarkError(
            f"Validation failed for shape {shape}: {e}", stage="validation_failed"
        ) from e

    profiler_dump_path = dump_dir / "rocprof" / gemm_id
    try:
        runtime_us = benchmark_mxfp4_gemm_rocprof(
            shape, macrotiles, profiler_dump_path, att_library_path,
            kernel_regex=kernel_regex,
            warmup_iters=warmup_iters,
            benchmark_iters=benchmark_iters,
            dynamic=dynamic,
        )
    except RuntimeError as e:
        raise BenchmarkError(str(e), stage="benchmark_failed") from e

    tflops = runtime_us_to_tflops(m, n, k, runtime_us)
    return runtime_us, tflops, "ok"


# ---------------------------------------------------------------------------
# Shape CSV loading and validation
# ---------------------------------------------------------------------------


def validate_shape_and_macrotiles(
    shape: tuple[int, int, int],
    macrotiles: tuple[int, int, int],
) -> None:
    M, N, K = shape
    mt_m, mt_n, mt_k = macrotiles
    if M <= 4 or N <= 4 or K <= 4:
        raise ValueError(f"M, N, K must be > 4 (got M={M}, N={N}, K={K})")
    if mt_m > M or mt_n > N or mt_k > K:
        raise ValueError(
            f"Macrotiles must not exceed shape: "
            f"MT_M({mt_m})<=M({M}), MT_N({mt_n})<=N({N}), MT_K({mt_k})<=K({K})"
        )
    if K % 32 != 0:
        raise ValueError(f"K must be divisible by 32 (got K={K})")
    if mt_m % 4 != 0:
        raise ValueError(f"MT_M must be divisible by 4 (got MT_M={mt_m})")
    if mt_n % 2 != 0:
        raise ValueError(f"MT_N must be divisible by 2 (got MT_N={mt_n})")


def load_shapes_csv(
    path: Path,
) -> list[tuple[tuple[int, int, int], tuple[int, int, int]]]:
    rows: list[tuple[tuple[int, int, int], tuple[int, int, int]]] = []
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row_idx, row in enumerate(reader, start=2):
            M = int(row["M"])
            N = int(row["N"])
            K = int(row["K"])
            MT_M = int(row["MT_M"])
            MT_N = int(row["MT_N"])
            MT_K = int(row["MT_K"])
            shape = (M, N, K)
            macrotiles = (MT_M, MT_N, MT_K)
            try:
                validate_shape_and_macrotiles(shape, macrotiles)
            except ValueError as e:
                raise ValueError(f"{path}: row {row_idx}: {e}") from e
            rows.append((shape, macrotiles))
    return rows


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------


def _write_results_csv(output_path: Path, results: list[dict]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["M", "N", "K", "MT_M", "MT_N", "MT_K", "runtime_us", "tflops", "ok"]
    with open(output_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in results:
            w.writerow({k: r[k] for k in fieldnames})
    print(f"Results written to {output_path}")


# ---------------------------------------------------------------------------
# Parallel compile (--skip-validate path)
# ---------------------------------------------------------------------------


def _run_compile_only_worker(args) -> None:
    """Entry point for --_compile_only subprocess."""
    import wave_lang.kernel.wave.cache as _wave_cache
    _wave_cache.WAVE_CACHE_ON = 0

    shape = tuple(args._shape)
    macrotiles = tuple(args._tiles)
    validate_shape_and_macrotiles(shape, macrotiles)

    asm_dir = args._co_asm_dir.resolve()
    dump_dir = args._co_dump_dir.resolve()
    asm_dir.mkdir(parents=True, exist_ok=True)
    dynamic = args._dynamic

    m, n, k = shape
    mt_m, mt_n, mt_k = macrotiles
    gemm_id = f"gemm_{m}_{n}_{k}_MT_{mt_m}_{mt_n}_{mt_k}"
    intermediates_dir = dump_dir / "intermediates" / gemm_id
    intermediates_dir.mkdir(parents=True, exist_ok=True)

    get_mxfp4_gemm_4wave(
        shape, macrotiles, intermediates_dir=intermediates_dir, dynamic=dynamic
    )
    _patch_and_save_asm(intermediates_dir, asm_dir, shape, macrotiles, dynamic=dynamic)


def _run_parallel_compile(
    shape_rows: list[tuple[tuple[int, int, int], tuple[int, int, int]]],
    asm_dir: Path,
    dump_dir: Path,
    dynamic: bool,
    num_workers: int,
    output_path: Path,
) -> None:
    """Compile all kernels in parallel via subprocesses."""
    asm_dir.mkdir(parents=True, exist_ok=True)

    if dynamic:
        compile_tasks: list[tuple[tuple[int, int, int], tuple[int, int, int]]] = []
        all_shapes_by_mt: dict[tuple[int, int, int], list[tuple[int, int, int]]] = {}
        for shape, macrotiles in shape_rows:
            all_shapes_by_mt.setdefault(macrotiles, []).append(shape)
            if not any(mt == macrotiles for _, mt in compile_tasks):
                compile_tasks.append((shape, macrotiles))
    else:
        compile_tasks = list(shape_rows)
        all_shapes_by_mt = None

    print(
        f"Compiling {len(compile_tasks)} kernel(s) with {num_workers} parallel workers..."
    )

    compiled: list[tuple[tuple[int, int, int], tuple[int, int, int]]] = []
    failed: list[tuple[tuple[int, int, int], tuple[int, int, int], str]] = []

    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        future_to_task = {
            executor.submit(
                _spawn_compile_worker, shape, mt, dump_dir, asm_dir, dynamic
            ): (shape, mt)
            for shape, mt in compile_tasks
        }
        for future in as_completed(future_to_task):
            shape, mt = future_to_task[future]
            success, err_msg = future.result()
            tag = f"({shape[0]}, {shape[1]}, {shape[2]}) MT({mt[0]},{mt[1]},{mt[2]})"
            if success:
                compiled.append((shape, mt))
                print(f"  OK: {tag}")
            else:
                failed.append((shape, mt, err_msg))
                print(f"  FAIL: {tag}: {err_msg[:1000]}", file=sys.stderr)

    manifest_entries = []
    if dynamic:
        compiled_mts = {mt for _, mt in compiled}
        for mt in sorted(compiled_mts):
            name = _kernel_name((0, 0, 0), mt, dynamic=True)
            manifest_entries.append({
                "name": name,
                "macrotile": list(mt),
                "wave_shapes": [list(s) for s in all_shapes_by_mt[mt]],
                "block_size": _BLOCK_SIZE,
                "asm_file": f"{name}.s",
                "dynamic": True,
            })
    else:
        for shape, mt in sorted(compiled):
            name = _kernel_name(shape, mt, dynamic=False)
            manifest_entries.append({
                "name": name,
                "macrotile": list(mt),
                "wave_shape": list(shape),
                "block_size": _BLOCK_SIZE,
                "asm_file": f"{name}.s",
                "dynamic": False,
            })

    if manifest_entries:
        manifest_path = asm_dir / "wave_kernels_manifest.json"
        with open(manifest_path, "w") as mf:
            json.dump({"kernels": manifest_entries}, mf, indent=2)
        print(f"Manifest written to {manifest_path} ({len(manifest_entries)} kernels)")

    if dynamic:
        compiled_mts = {mt for _, mt in compiled}
    compiled_set = {(s, mt) for s, mt in compiled}
    results = []
    for shape, macrotiles in shape_rows:
        ok = (
            (macrotiles in compiled_mts)
            if dynamic
            else ((shape, macrotiles) in compiled_set)
        )
        results.append({
            "M": shape[0], "N": shape[1], "K": shape[2],
            "MT_M": macrotiles[0], "MT_N": macrotiles[1], "MT_K": macrotiles[2],
            "runtime_us": 0.0, "tflops": 0.0, "ok": ok,
        })
    _write_results_csv(output_path, results)

    n_ok = len(compiled)
    n_total = len(compile_tasks)
    print(f"\nCompiled {n_ok}/{n_total} kernels successfully.")
    if failed:
        print(f"Failed compilations ({len(failed)}):", file=sys.stderr)
        for s, mt, err in failed:
            print(
                f"  ({s[0]},{s[1]},{s[2]}) MT({mt[0]},{mt[1]},{mt[2]}): {err[:1000]}",
                file=sys.stderr,
            )
    if n_ok == 0:
        sys.exit(1)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args():
    p = argparse.ArgumentParser(
        description="Standalone 4-wave MXFP4 Wave GEMM benchmark / compilation."
    )
    p.add_argument("--_worker", action="store_true", help=argparse.SUPPRESS)
    p.add_argument(
        "--_shape", type=int, nargs=3, metavar=("M", "N", "K"),
        help=argparse.SUPPRESS,
    )
    p.add_argument(
        "--_tiles", type=int, nargs=3, metavar=("mt_m", "mt_n", "mt_k"),
        help=argparse.SUPPRESS,
    )
    p.add_argument("--_dynamic", action="store_true", help=argparse.SUPPRESS)
    p.add_argument("--_compile_only", action="store_true", help=argparse.SUPPRESS)
    p.add_argument(
        "--_co-asm-dir", type=Path, default=None, dest="_co_asm_dir",
        help=argparse.SUPPRESS,
    )
    p.add_argument(
        "--_co-dump-dir", type=Path, default=None, dest="_co_dump_dir",
        help=argparse.SUPPRESS,
    )
    p.add_argument(
        "--shapes", type=Path, metavar="CSV",
        help="CSV with M,N,K,MT_M,MT_N,MT_K columns",
    )
    p.add_argument("--warmup-iters", type=int, default=0, metavar="N")
    p.add_argument("--benchmark-iters", type=int, default=1, metavar="N")
    p.add_argument("-o", "--output", type=Path, default=None)
    p.add_argument(
        "--dump-dir", type=Path, default=Path("/tmp/bench_mxfp4_4wave_dump"),
    )
    p.add_argument("--kernel-regex", type=str, default="gemm")
    p.add_argument("--asm-dir", type=Path, default=None)
    p.add_argument("--dynamic", action="store_true")
    p.add_argument("--skip-validate", action="store_true")
    p.add_argument("-j", "--jobs", type=int, default=4, metavar="N")
    return p.parse_args()


def main():
    att_library_path = os.environ.get("ATT_LIBRARY_PATH") or None
    args = parse_args()

    # --- Internal compile-only worker ---
    if args._compile_only:
        if args._shape is None or args._tiles is None:
            print("--_compile_only requires --_shape and --_tiles.", file=sys.stderr)
            sys.exit(1)
        if args._co_asm_dir is None or args._co_dump_dir is None:
            print(
                "--_compile_only requires --_co-asm-dir and --_co-dump-dir.",
                file=sys.stderr,
            )
            sys.exit(1)
        _run_compile_only_worker(args)
        return

    # --- Internal benchmark worker ---
    if args._worker:
        if args._shape is None or args._tiles is None:
            print("--_worker requires --_shape and --_tiles.", file=sys.stderr)
            sys.exit(1)
        shape = tuple(args._shape)
        macrotiles = tuple(args._tiles)
        try:
            validate_shape_and_macrotiles(shape, macrotiles)
        except ValueError as e:
            print(f"Invalid shape/macrotile: {e}", file=sys.stderr)
            sys.exit(1)
        run_worker(
            shape, macrotiles,
            warmup_iters=args.warmup_iters,
            benchmark_iters=args.benchmark_iters,
            dynamic=args._dynamic,
        )
        return

    # --- Main entry ---
    if args.shapes is None:
        print("--shapes is required.", file=sys.stderr)
        sys.exit(1)
    if not args.shapes.exists():
        print(f"Shapes file not found: {args.shapes}", file=sys.stderr)
        sys.exit(1)
    if args.output is None:
        print("--shapes requires -o/--output for the result CSV.", file=sys.stderr)
        sys.exit(1)

    try:
        shape_rows = load_shapes_csv(args.shapes)
    except ValueError as e:
        print(f"Invalid shape/macrotile in CSV: {e}", file=sys.stderr)
        sys.exit(1)
    if not shape_rows:
        print("No shapes found in CSV.", file=sys.stderr)
        sys.exit(1)

    dump_dir = Path(args.dump_dir)
    dump_dir.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    run_dump_dir = dump_dir / run_id
    run_dump_dir.mkdir(parents=True, exist_ok=True)
    print(f"Dump directory for this run: {run_dump_dir}")
    asm_dir = args.asm_dir
    dynamic = args.dynamic

    if dynamic:
        print("Dynamic mode: kernels will use runtime M/N/K dimensions")

    # --- Parallel compile-only path ---
    if args.skip_validate:
        if asm_dir is None:
            print("--skip-validate requires --asm-dir.", file=sys.stderr)
            sys.exit(1)
        _run_parallel_compile(
            shape_rows, asm_dir, run_dump_dir, dynamic,
            num_workers=args.jobs, output_path=args.output,
        )
        return

    # --- Sequential compile + validate + benchmark ---
    kernel_regex = args.kernel_regex
    results = []
    manifest_entries = []
    failed_compilation = []
    failed_validation = []
    failed_benchmark = []
    saved_dynamic_macrotiles: set[tuple[int, int, int]] = set()
    dynamic_manifest_shapes: dict[tuple[int, int, int], list[list[int]]] = {}

    for shape, macrotiles in shape_rows:
        M, N, K = shape
        mt_m, mt_n, mt_k = macrotiles

        effective_asm_dir = asm_dir
        if dynamic and macrotiles in saved_dynamic_macrotiles:
            effective_asm_dir = None

        try:
            runtime_us, tflops, status = run_validate_and_benchmark(
                shape, macrotiles, run_dump_dir, att_library_path,
                kernel_regex=kernel_regex,
                warmup_iters=args.warmup_iters,
                benchmark_iters=args.benchmark_iters,
                asm_dir=effective_asm_dir,
                dynamic=dynamic,
            )
        except BenchmarkError as e:
            print(f"  {e}", file=sys.stderr)
            traceback.print_exc()
            status = e.stage
            runtime_us, tflops = None, None
        ok = status == "ok"

        if asm_dir is not None and status != "compile_failed":
            name = _kernel_name(shape, macrotiles, dynamic=dynamic)
            asm_file = asm_dir / f"{name}.s"
            if asm_file.exists():
                if dynamic:
                    saved_dynamic_macrotiles.add(macrotiles)
                    dynamic_manifest_shapes.setdefault(macrotiles, []).append(
                        list(shape)
                    )
                else:
                    manifest_entries.append({
                        "name": name,
                        "macrotile": list(macrotiles),
                        "wave_shape": list(shape),
                        "block_size": _BLOCK_SIZE,
                        "asm_file": f"{name}.s",
                        "dynamic": False,
                    })

        if status == "compile_failed":
            failed_compilation.append((M, N, K))
        elif status == "validation_failed":
            failed_validation.append((M, N, K))
        elif status == "benchmark_failed":
            failed_benchmark.append((M, N, K))

        mean_us = runtime_us if runtime_us is not None else 0.0
        tflops_val = tflops if tflops is not None else 0.0
        results.append({
            "M": M, "N": N, "K": K,
            "MT_M": mt_m, "MT_N": mt_n, "MT_K": mt_k,
            "runtime_us": mean_us, "tflops": tflops_val, "ok": ok,
        })
        print(
            f"  ({M}, {N}, {K}) MT({mt_m},{mt_n},{mt_k}): "
            f"{mean_us:.2f} us, {tflops_val:.4f} TFLOPs [{status if not ok else 'ok'}]"
        )

    for mt_key in sorted(dynamic_manifest_shapes):
        name = _kernel_name((0, 0, 0), mt_key, dynamic=True)
        manifest_entries.append({
            "name": name,
            "macrotile": list(mt_key),
            "wave_shapes": dynamic_manifest_shapes[mt_key],
            "block_size": _BLOCK_SIZE,
            "asm_file": f"{name}.s",
            "dynamic": True,
        })

    if asm_dir is not None and manifest_entries:
        manifest_path = asm_dir / "wave_kernels_manifest.json"
        with open(manifest_path, "w") as mf:
            json.dump({"kernels": manifest_entries}, mf, indent=2)
        print(f"Manifest written to {manifest_path} ({len(manifest_entries)} kernels)")

    if failed_compilation:
        print(f"Kernels that failed compilation: {failed_compilation}", file=sys.stderr)
    if failed_validation:
        print(f"Kernels that failed validation: {failed_validation}", file=sys.stderr)
    if failed_benchmark:
        print(f"Kernels that failed benchmarking: {failed_benchmark}", file=sys.stderr)

    valid = [r for r in results if r["ok"] and r["runtime_us"] > 0]
    if not valid:
        print("No successful runs.", file=sys.stderr)
        sys.exit(1)

    avg_us = sum(r["runtime_us"] for r in valid) / len(valid)
    avg_tflops = sum(r["tflops"] for r in valid) / len(valid)
    best = max(valid, key=lambda r: r["tflops"])
    print()
    print(f"Average across {len(valid)} kernels: {avg_us:.2f} us, {avg_tflops:.4f} TFLOPs")
    print(
        f"Best kernel: M={best['M']}, N={best['N']}, K={best['K']} "
        f"MT({best['MT_M']},{best['MT_N']},{best['MT_K']}) -> "
        f"{best['runtime_us']:.2f} us, {best['tflops']:.4f} TFLOPs"
    )
    _write_results_csv(args.output, results)


if __name__ == "__main__":
    main()
