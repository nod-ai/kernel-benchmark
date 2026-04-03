"""
Profiling data collection for rocprof benchmarks.

Collects rocprof dump directories generated during IREE-based kernel benchmarking
(Wave, IREE backends) and organizes them into a structured output with a manifest
mapping kernel identifiers to their dump directories.

Output structure:
    profiling/
    ├── manifest.json         # {dump_key: {backend, kernelName, dumpDir}}
    └── dumps/
        ├── wave__kernel_1/   # rocprof dump for kernel_1 on wave
        │   ├── *_kernel_stats.csv
        │   └── ...
        └── iree__kernel_2/
            └── ...

The dump key format is "{backend}__{kernel_name}" to ensure uniqueness across backends.
"""

import json
import shutil
from pathlib import Path
from typing import Optional

from kernel_bench.utils.print_utils import get_logger


def collect_profiling_data(
    dump_root: Path,
    output_dir: Path,
) -> dict:
    """
    Scan rocprof dump directories and organize them for artifact upload.

    Walks dump_root looking for thread_trace directories produced by rocprofv3,
    copies each kernel's dump to a flat output layout, and writes a manifest.

    Args:
        dump_root: Root dump directory (e.g., /workspace/dump).
        output_dir: Destination for the organized profiling data.

    Returns:
        Manifest dict mapping dump keys to their metadata.
    """
    logger = get_logger()
    manifest: dict[str, dict] = {}

    dumps_output_dir = output_dir / "dumps"
    dumps_output_dir.mkdir(parents=True, exist_ok=True)

    dump_root = Path(dump_root)
    if not dump_root.exists():
        logger.info(f"Dump root {dump_root} does not exist, no profiling data to collect.")
        _write_manifest(output_dir, manifest)
        return manifest

    for backend_dir in sorted(dump_root.iterdir()):
        if not backend_dir.is_dir():
            continue
        backend = backend_dir.name

        thread_trace_dir = backend_dir / "thread_trace"
        if not thread_trace_dir.is_dir():
            continue

        for kernel_dump_dir in sorted(thread_trace_dir.iterdir()):
            if not kernel_dump_dir.is_dir():
                continue

            kernel_name = kernel_dump_dir.name
            dump_key = f"{backend}__{kernel_name}"

            if not _has_rocprof_data(kernel_dump_dir):
                logger.debug(f"Skipping {dump_key}: no rocprof CSV data found")
                continue

            dest_dir = dumps_output_dir / dump_key
            try:
                shutil.copytree(kernel_dump_dir, dest_dir, dirs_exist_ok=True)
            except Exception as e:
                logger.error(f"Failed to copy profiling dump {dump_key}: {e}")
                continue

            manifest[dump_key] = {
                "backend": backend,
                "kernelName": kernel_name,
                "dumpDir": dump_key,
            }
            logger.debug(f"Collected profiling data for {dump_key}")

    _write_manifest(output_dir, manifest)
    logger.info(
        f"Collected profiling data for {len(manifest)} kernel(s) into {output_dir}"
    )
    return manifest


def _has_rocprof_data(dump_dir: Path) -> bool:
    """Return True if the directory contains at least one rocprof CSV output."""
    return any(dump_dir.glob("**/*.csv"))


def _write_manifest(output_dir: Path, manifest: dict):
    """Persist the profiling manifest as JSON."""
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
