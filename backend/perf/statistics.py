"""
Performance Statistics Computation

Computes aggregated performance statistics for benchmark runs.
Groups kernels by machine → kernel_type → backend and calculates
geometric mean, arithmetic average, and counts.
"""

import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


def compute_performance_statistics(kernels: List[Dict]) -> Dict[str, Any]:
    """
    Compute performance statistics for a list of kernels.
    
    Groups kernels by machine → kernel_type → backend and calculates:
    - Geometric mean of tflops and runtime
    - Arithmetic average of tflops and runtime
    - Count of valid kernels
    
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
                        "numKernels": int
                    }
                }
            }
        }
    """
    # Group kernels by machine → kernel_type → backend
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
            grouped[machine][kernel_type][backend] = []
            
        grouped[machine][kernel_type][backend].append(kernel)
    
    # Calculate statistics for each group
    stats = {}
    
    for machine, kernel_types in grouped.items():
        stats[machine] = {}
        
        for kernel_type, backends in kernel_types.items():
            stats[machine][kernel_type] = {}
            
            for backend, kernel_list in backends.items():
                tflops_values = [k["tflops"] for k in kernel_list]
                runtime_values = [k["mean_microseconds"] for k in kernel_list]
                
                stats[machine][kernel_type][backend] = {
                    "geoMean": {
                        "tflops": calculate_geometric_mean(tflops_values),
                        "runtimeUs": calculate_geometric_mean(runtime_values),
                    },
                    "average": {
                        "tflops": calculate_arithmetic_mean(tflops_values),
                        "runtimeUs": calculate_arithmetic_mean(runtime_values),
                    },
                    "numKernels": len(kernel_list)
                }
    
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
    import math
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
