"""
Collect and organize rocprof profiling data generated during benchmarking.

Scans the dump directory for rocprof thread-trace outputs, creates a manifest
mapping kernels to their dump directories, and copies everything into a
structured output directory suitable for artifact upload.

Usage:
    python -m kernel_bench.cli.collect_profiling \
        --dump-dir /workspace/dump \
        --output-dir /data/results/profiling
"""

import argparse
from pathlib import Path

from kernel_bench.utils.profiling import collect_profiling_data
from kernel_bench.utils.print_utils import get_logger


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Collect rocprof profiling data from benchmark dump directories."
    )
    parser.add_argument(
        "--dump-dir",
        type=str,
        required=True,
        help="Root dump directory containing rocprof thread traces (e.g., /workspace/dump).",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        required=True,
        help="Output directory for organized profiling data.",
    )

    args = parser.parse_args()
    logger = get_logger()

    manifest = collect_profiling_data(
        dump_root=Path(args.dump_dir),
        output_dir=Path(args.output_dir),
    )

    logger.info(f"Profiling collection complete: {len(manifest)} kernel(s) collected.")
