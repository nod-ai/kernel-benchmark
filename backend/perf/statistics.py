"""
Performance Statistics Computation

Computes aggregated performance statistics for benchmark runs.
Groups kernels by machine → kernel_type → backend and calculates
geometric mean, arithmetic average, and counts.
"""

import math
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


def _get_macrotile_key(kernel: Dict) -> str | None:
    """Extract macrotile string (e.g. '256x192x256') from kernel's tuningConfig."""
    tc = kernel.get("tuningConfig")
    if not tc:
        return None
    bm = tc.get("BLOCK_M")
    bn = tc.get("BLOCK_N")
    bk = tc.get("BLOCK_K")
    if bm is None or bn is None or bk is None:
        return None
    return f"{bm}x{bn}x{bk}"


def _compute_stats_for_list(kernel_list: List[Dict]) -> Dict[str, Any]:
    tflops_values = [k["tflops"] for k in kernel_list]
    runtime_values = [k["meanMicroseconds"] for k in kernel_list]
    return {
        "geoMean": {
            "tflops": calculate_geometric_mean(tflops_values),
            "runtimeUs": calculate_geometric_mean(runtime_values),
        },
        "average": {
            "tflops": calculate_arithmetic_mean(tflops_values),
            "runtimeUs": calculate_arithmetic_mean(runtime_values),
        },
        "numKernels": len(kernel_list),
    }


def compute_performance_statistics(kernels: List[Dict]) -> Dict[str, Any]:
    """
    Compute performance statistics for a list of kernels.

    Groups kernels by machine → kernel_type → backend and calculates:
    - Geometric mean of tflops and runtime
    - Arithmetic average of tflops and runtime
    - Count of valid kernels
    - Per-macrotile breakdown (byMacrotile key)

    Args:
        kernels: List of kernel dictionaries with performance data

    Returns:
        Nested dict with structure:
        {
            "machine_name": {
                "kernel_type": {
                    "backend": {
                        "geoMean": {"tflops": float, "runtimeUs": float},
                        "average": {"tflops": float, "runtimeUs": float},
                        "numKernels": int,
                        "byMacrotile": {
                            "256x192x256": {
                                "geoMean": {...}, "average": {...}, "numKernels": int
                            },
                            ...
                        }
                    }
                }
            }
        }
    """
    # Group kernels by machine → kernel_type → backend → macrotile
    grouped = {}

    for kernel in kernels:
        # Skip invalid kernels
        if not kernel.get("ok", False):
            continue
        if kernel.get("tflops", 0) <= 0:
            continue

        machine = kernel.get("machine", "unknown")
        kernel_type = kernel.get("kernel_type", "unknown")
        backend = kernel.get("backend", "unknown")

        # Create nested structure
        if machine not in grouped:
            grouped[machine] = {}
        if kernel_type not in grouped[machine]:
            grouped[machine][kernel_type] = {}
        if backend not in grouped[machine][kernel_type]:
            grouped[machine][kernel_type][backend] = {"_all": [], "byMacrotile": {}}

        grouped[machine][kernel_type][backend]["_all"].append(kernel)

        macrotile = _get_macrotile_key(kernel)
        if macrotile:
            by_mt = grouped[machine][kernel_type][backend]["byMacrotile"]
            if macrotile not in by_mt:
                by_mt[macrotile] = []
            by_mt[macrotile].append(kernel)

    # Calculate statistics for each group
    stats = {}

    for machine, kernel_types in grouped.items():
        stats[machine] = {}

        for kernel_type, backends in kernel_types.items():
            stats[machine][kernel_type] = {}

            for backend, data in backends.items():
                kernel_list = data["_all"]
                backend_stats = _compute_stats_for_list(kernel_list)
                backend_stats["byMacrotile"] = {
                    mt: _compute_stats_for_list(mt_kernels)
                    for mt, mt_kernels in data["byMacrotile"].items()
                }
                stats[machine][kernel_type][backend] = backend_stats

    return stats


def calculate_geometric_mean(values: List[float]) -> float:
    """
    Calculate geometric mean of a list of values.

    Geometric mean = (v1 * v2 * ... * vn) ^ (1/n)

    Args:
        values: List of positive numbers

    Returns:
        Geometric mean as a float
    """
    if not values:
        return 0.0

    # Filter out zero or negative values (shouldn't happen but be safe)
    valid_values = [v for v in values if v > 0]

    if not valid_values:
        return 0.0

    # Calculate product and take nth root
    # Using logarithms to avoid overflow: exp(mean(log(values)))

    log_sum = sum(math.log(v) for v in valid_values)
    log_mean = log_sum / len(valid_values)

    return math.exp(log_mean)


def calculate_arithmetic_mean(values: List[float]) -> float:
    """
    Calculate arithmetic mean (average) of a list of values.

    Args:
        values: List of numbers

    Returns:
        Arithmetic mean as a float
    """
    if not values:
        return 0.0

    return sum(values) / len(values)
