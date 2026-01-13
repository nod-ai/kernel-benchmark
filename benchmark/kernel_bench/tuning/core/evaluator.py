"""Result evaluation and comparison logic."""

from typing import Optional
from kernel_bench.utils.bench_utils import BenchmarkResult
from .executor import ExecutionResult


class ResultEvaluator:
    """
    Handles scoring and comparison of benchmark results.
    
    Provides consistent logic for determining improvements
    and handling constraint violations.
    """
    
    def __init__(self, context: "TuningContext"):
        """
        Initialize evaluator.
        
        Args:
            context: TuningContext for configuration
        """
        self.context = context
        self.baseline: Optional[ExecutionResult] = None
    
    def set_baseline(self, baseline: ExecutionResult):
        """
        Set the baseline result for comparison.
        
        Args:
            baseline: Baseline execution result
        """
        self.baseline = baseline
    
    def is_improvement(self, result: ExecutionResult) -> bool:
        """
        Check if result is an improvement over baseline.
        
        Args:
            result: Result to check
        
        Returns:
            True if result improves on baseline
        """
        if not result.ok:
            return False
        
        if self.baseline is None:
            return True
        
        return result.runtime < self.baseline.runtime
    
    def compute_speedup(self, result: ExecutionResult) -> float:
        """
        Compute speedup relative to baseline.
        
        Args:
            result: Result to compute speedup for
        
        Returns:
            Speedup factor (>1 means improvement)
        """
        if not result.ok or self.baseline is None:
            return 0.0
        
        if result.runtime == 0:
            return 0.0
        
        return self.baseline.runtime / result.runtime
    
    def compute_improvement_percentage(self, result: ExecutionResult) -> float:
        """
        Compute percentage improvement over baseline.
        
        Args:
            result: Result to compute improvement for
        
        Returns:
            Improvement percentage (positive means improvement)
        """
        speedup = self.compute_speedup(result)
        if speedup == 0:
            return 0.0
        
        return (speedup - 1.0) * 100.0
    
    def compare(self, result1: ExecutionResult, result2: ExecutionResult) -> int:
        """
        Compare two results.
        
        Args:
            result1: First result
            result2: Second result
        
        Returns:
            -1 if result1 is better, 1 if result2 is better, 0 if equal
        """
        # Failed results are always worse
        if not result1.ok and not result2.ok:
            return 0
        if not result1.ok:
            return 1
        if not result2.ok:
            return -1
        
        # Compare runtimes (lower is better)
        if result1.runtime < result2.runtime:
            return -1
        elif result1.runtime > result2.runtime:
            return 1
        else:
            return 0
    
    def get_best(self, results: list[ExecutionResult]) -> Optional[ExecutionResult]:
        """
        Get the best result from a list.
        
        Args:
            results: List of results to choose from
        
        Returns:
            Best result, or None if all failed
        """
        successful = [r for r in results if r.ok]
        if not successful:
            return None
        
        return min(successful, key=lambda r: r.runtime)

