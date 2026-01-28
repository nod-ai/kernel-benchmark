"""Execution engine for compiling and benchmarking kernel configurations."""

import copy
import math
import time
from typing import List, Optional, Callable, Any, TYPE_CHECKING
from dataclasses import dataclass

if TYPE_CHECKING:
    from kernel_bench.core.template import KernelBenchmark, batch_benchmark
from kernel_bench.utils.bench_utils import BenchmarkResult
from .candidate import CandidateConfig


@dataclass
class ExecutionResult:
    """Result of executing a candidate configuration."""
    
    candidate: CandidateConfig
    benchmark_result: BenchmarkResult
    compile_time: float = 0.0
    benchmark_time: float = 0.0
    
    @property
    def ok(self) -> bool:
        """Whether the execution succeeded."""
        return self.benchmark_result.ok
    
    @property
    def runtime(self) -> float:
        """Runtime in microseconds."""
        return self.benchmark_result.mean_microseconds
    
    @property
    def tflops(self) -> float:
        """Performance in TFLOPS."""
        return self.benchmark_result.tflops
    
    def __lt__(self, other) -> bool:
        """Compare by runtime (lower is better)."""
        if isinstance(other, ExecutionResult):
            return self.runtime < other.runtime
        elif isinstance(other, BenchmarkResult):
            return self.runtime < other.mean_microseconds
        return NotImplemented


class ExecutionEngine:
    """
    Handles compilation and benchmarking of kernel configurations.
    
    Provides both single and batch execution modes, with callbacks
    for progress tracking and timeout handling.
    """
    
    def __init__(self, context: "TuningContext"):
        """
        Initialize execution engine.
        
        Args:
            context: TuningContext containing benchmark and device info
        """
        self.context = context
        self.bench = context.bench
        self.device = f"hip://{context.device_id}"
        self.num_iterations = context.num_iterations
        self.base_exec_time: Optional[float] = None
    
    def benchmark_baseline(self) -> ExecutionResult:
        """
        Benchmark the baseline configuration (no tuning parameters).
        
        Returns:
            ExecutionResult with baseline performance
        """
        bench = self.bench
        bench.tuning_spec.clear()
        
        start_time = time.time()
        bench_result = bench.run_bench(self.device, self.num_iterations)
        exec_time = time.time() - start_time
        
        if not bench_result.ok:
            bench_result.mean_microseconds = math.inf
            bench_result.tflops = 0
        
        # Store baseline execution time for timeout calculation
        self.base_exec_time = exec_time
        
        baseline_candidate = CandidateConfig(param_values={})
        return ExecutionResult(
            candidate=baseline_candidate,
            benchmark_result=bench_result,
            benchmark_time=exec_time
        )
    
    def compile_and_benchmark(
        self,
        candidate: CandidateConfig,
        progress_callback: Optional[Callable[[str], None]] = None
    ) -> ExecutionResult:
        """
        Compile and benchmark a single candidate configuration.
        
        Args:
            candidate: Configuration to evaluate
            progress_callback: Optional callback for progress updates
        
        Returns:
            ExecutionResult with performance data
        """
        bench = copy.deepcopy(self.bench)
        bench.tuning_spec.clear()
        bench.update_parameter_values(candidate.param_values)
        
        # Validate constraints
        is_valid, violated = bench.tuning_spec.validate_constraints()
        if not is_valid:
            # Return failed result for invalid configuration
            failed_result = bench.get_bench_result(math.inf, False)
            return ExecutionResult(
                candidate=candidate,
                benchmark_result=failed_result
            )
        
        # Calculate timeout
        timeout = self.base_exec_time * 3 if self.base_exec_time else None
        
        # Compile and benchmark
        start_time = time.time()
        bench_result = bench.run_bench(self.device, self.num_iterations, timeout=timeout)
        exec_time = time.time() - start_time
        
        if not bench_result.ok:
            bench_result.mean_microseconds = math.inf
            bench_result.tflops = 0
        
        return ExecutionResult(
            candidate=candidate,
            benchmark_result=bench_result,
            benchmark_time=exec_time
        )
    
    def compile_batch(
        self,
        candidates: List[CandidateConfig],
        callback: Optional[Callable[[CandidateConfig], None]] = None
    ) -> List["KernelBenchmark"]:
        """
        Compile a batch of candidate configurations.
        
        Args:
            candidates: List of configurations to compile
            callback: Optional callback called after each compilation
        
        Returns:
            List of compiled KernelBenchmark objects
        """
        compiled_benches = []
        
        for candidate in candidates:
            bench = copy.deepcopy(self.bench)
            bench.tuning_spec.clear()
            bench.update_parameter_values(candidate.param_values)
            
            # Validate constraints
            is_valid, _ = bench.tuning_spec.validate_constraints()
            if is_valid:
                compiled_benches.append(bench)
            
            if callback:
                callback(candidate)
        
        return compiled_benches
    
    def benchmark_batch(
        self,
        candidates: List[CandidateConfig],
        compile_callback: Optional[Callable[[Any], None]] = None,
        bench_callback: Optional[Callable[[BenchmarkResult], None]] = None,
        validate_numerics: bool = False,
        verbose: bool = False
    ) -> List[ExecutionResult]:
        """
        Batch compile and benchmark multiple candidates.
        
        This is more efficient than individual execution for paradigms
        that generate many candidates at once.
        
        Args:
            candidates: List of configurations to evaluate
            compile_callback: Called after each compilation
            bench_callback: Called after each benchmark
            validate_numerics: Whether to validate numerical correctness
            verbose: Whether to print verbose output
        
        Returns:
            List of ExecutionResult objects
        """
        # Build batch of benchmarks
        batch_benches = []
        candidate_map = {}  # Maps bench to candidate
        
        for candidate in candidates:
            bench = copy.deepcopy(self.bench)
            bench.tuning_spec.clear()
            bench.update_parameter_values(candidate.param_values)
            
            # Validate constraints
            is_valid, _ = bench.tuning_spec.validate_constraints()
            if is_valid:
                batch_benches.append(bench)
                candidate_map[id(bench)] = candidate
        
        if not batch_benches:
            return []
        
        # Calculate timeout
        timeout = self.base_exec_time * 3 if self.base_exec_time else None
        
        # Batch benchmark
        start_time = time.time()
        bench_results = batch_benchmark(
            batch_benches,
            device=self.device,
            num_iterations=self.num_iterations,
            timeout=timeout,
            compile_callback=compile_callback,
            bench_callback=bench_callback,
            validate_numerics=validate_numerics,
            verbose=verbose,
            unique_ids=True,
        )
        exec_time = time.time() - start_time
        
        # Package results
        execution_results = []
        for bench, bench_result in zip(batch_benches, bench_results):
            candidate = candidate_map[id(bench)]
            
            if not bench_result.ok:
                bench_result.mean_microseconds = math.inf
                bench_result.tflops = 0
            
            execution_results.append(ExecutionResult(
                candidate=candidate,
                benchmark_result=bench_result,
                benchmark_time=exec_time / len(batch_benches)  # Average time
            ))
        
        return execution_results

