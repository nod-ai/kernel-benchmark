"""Base tuning paradigm interface with modular infrastructure."""

from abc import ABC, abstractmethod
import copy
import math
import time
from dataclasses import dataclass
from typing import (
    Any,
    Dict,
    Iterator,
    List,
    Optional,
    Union,
    Callable,
)

from kernel_bench.core.template import KernelBenchmark
from kernel_bench.utils.bench_utils import BenchmarkResult
from kernel_bench.utils.parallel_utils.progress_context import ProgressEvent
from kernel_bench.tuning.core import (
    CandidateConfig,
    ExecutionEngine,
    ExecutionResult,
    RichProgressManager,
    TuningHistory,
    ResultEvaluator,
)


@dataclass
class TuningContext:
    """Context object containing all necessary information for tuning."""

    bench: KernelBenchmark
    device_id: int
    num_iterations: int
    num_trials: int
    debug: bool = False
    worker_id: int = 0


@dataclass
class TuningResult:
    """Result of a tuning run."""

    name: str
    benchmark: BenchmarkResult
    improvement: bool
    speedup: float
    hyperparams: Optional[Dict[str, Any]] = None


class TuningParadigm(ABC):
    """
    Abstract base class for tuning paradigms.

    Provides common infrastructure and a flexible interface that supports
    both sequential (one-at-a-time) and batch execution patterns.

    Subclasses must implement:
    - generate_candidates(): Yield candidates to evaluate
    - should_stop(): Determine when to stop tuning
    - get_name(): Return paradigm name

    Subclasses may optionally override:
    - execute_candidates(): Custom execution logic
    - update_strategy(): Adapt based on results
    - setup(): Additional initialization
    """

    def __init__(self):
        """Initialize tuning paradigm."""
        self.context: Optional[TuningContext] = None
        self.executor: Optional[ExecutionEngine] = None
        self.progress: Optional[RichProgressManager] = None
        self.history: Optional[TuningHistory] = None
        self.evaluator: Optional[ResultEvaluator] = None
        self.baseline: Optional[ExecutionResult] = None

    def setup(self, context: TuningContext, progress: RichProgressManager):
        """
        Initialize shared infrastructure.

        This is called before tuning begins. Subclasses can override
        to add custom initialization, but should call super().setup().

        Args:
            context: Tuning context with benchmark and configuration
            progress: Progress manager for tracking
        """
        self.context = context
        self.progress = progress
        self.executor = ExecutionEngine(context)
        self.history = TuningHistory(context)
        self.evaluator = ResultEvaluator(context)

    def tune(
        self,
        context: TuningContext,
        progress_callback: Callable[[ProgressEvent], None],
    ) -> TuningResult:
        """
        Run the tuning process and return the best result.

        This is the main entry point called by the parallel tuner.
        It orchestrates the entire tuning process using the paradigm's
        generation and execution strategies.

        Args:
            context: Tuning context
            progress_callback: Callback for progress updates

        Returns:
            TuningResult with best configuration found
        """
        # Create progress manager
        progress = RichProgressManager(
            context.worker_id, context.device_id, progress_callback
        )

        # Setup infrastructure
        self.setup(context, progress)

        # Configure main progress
        progress.configure(
            total=context.num_trials,
            description=context.bench.config.get_name(),
            color="blue",
        )

        # Benchmark baseline
        self.baseline = self.executor.benchmark_baseline()
        self.history.set_baseline(self.baseline)
        self.evaluator.set_baseline(self.baseline)

        if not self.baseline.ok:
            progress.finish("Failed")
            return TuningResult(
                name=context.bench.config.get_name(),
                benchmark=self.baseline.benchmark_result,
                improvement=False,
                speedup=0,
                hyperparams=None,
            )

        # Run paradigm-specific tuning
        try:
            self._tune_impl()
        except Exception as e:
            progress.finish(f"Error: {str(e)}")
            raise

        # Get best result
        best = self.history.get_best()

        if best is None or not best.ok:
            # No valid results found, return baseline
            progress.finish("Complete (no improvements)")
            return TuningResult(
                name=context.bench.config.get_name(),
                benchmark=self.baseline.benchmark_result,
                improvement=False,
                speedup=1.0,
                hyperparams=None,
            )

        # Compute improvement
        improvement = self.evaluator.is_improvement(best)
        speedup = self.evaluator.compute_speedup(best)

        # Save history
        self.history.save()

        # Finish progress
        if improvement:
            progress.finish(f"Complete (speedup: {speedup:.2f}x)")
        else:
            progress.finish("Complete")

        return TuningResult(
            name=context.bench.config.get_name(),
            benchmark=best.benchmark_result,
            improvement=improvement,
            speedup=speedup,
            hyperparams=best.candidate.param_values,
        )

    def _tune_impl(self):
        """
        Internal tuning implementation.

        This orchestrates the main tuning loop using the paradigm's
        generate_candidates() and should_stop() methods.
        """
        for candidates in self.generate_candidates():
            # Normalize to list (handles both single and batch)
            if isinstance(candidates, CandidateConfig):
                candidates = [candidates]

            # Execute candidates
            results = self.execute_candidates(candidates)

            # Update strategy based on results
            self.update_strategy(results)

            # Check stopping condition
            if self.should_stop():
                break

    @abstractmethod
    def generate_candidates(
        self,
    ) -> Iterator[Union[CandidateConfig, List[CandidateConfig]]]:
        """
        Generate candidates to evaluate.

        This is the core method that defines the tuning strategy.
        Paradigms can yield:
        - Single CandidateConfig for sequential evaluation
        - List[CandidateConfig] for batch evaluation

        The iterator pattern allows lazy generation and early stopping.

        Yields:
            CandidateConfig or List[CandidateConfig]
        """
        pass

    @abstractmethod
    def should_stop(self) -> bool:
        """
        Determine if tuning should stop.

        Returns:
            True if tuning should stop, False to continue
        """
        pass

    @abstractmethod
    def get_name(self) -> str:
        """
        Return the name of this tuning paradigm.

        Returns:
            Paradigm name string
        """
        pass

    def execute_candidates(
        self, candidates: List[CandidateConfig]
    ) -> List[ExecutionResult]:
        """
        Execute candidates (compile + benchmark).

        Default implementation handles both batch and sequential execution.
        Paradigms can override for custom behavior (e.g., custom pruning,
        progressive benchmarking, etc.).

        Args:
            candidates: List of candidates to evaluate

        Returns:
            List of ExecutionResult objects
        """
        if len(candidates) == 1:
            # Sequential execution
            result = self.executor.compile_and_benchmark(candidates[0])
            self.history.record(candidates[0], result)
            self.progress.step()
            return [result]
        else:
            # Batch execution with sub-progress bars
            with self.progress.create_subtask(
                "Compiling", len(candidates), "yellow"
            ) as compile_progress:

                def compile_callback(_):
                    compile_progress.step()

                results = self.executor.benchmark_batch(
                    candidates,
                    compile_callback=compile_callback,
                    bench_callback=None,
                    verbose=self.context.debug,
                )

            # Update main progress
            for candidate, result in zip(candidates, results):
                self.history.record(candidate, result)
                if result.ok:
                    self.progress.step()

            return results

    def update_strategy(self, results: List[ExecutionResult]):
        """
        Update internal strategy based on results.

        This is an optional hook for paradigms that adapt their
        strategy based on previous results (e.g., Bayesian optimization).

        Args:
            results: Results from latest evaluation
        """
        pass

    def get_best_result(self) -> Optional[ExecutionResult]:
        """
        Get the current best result from history.

        Returns:
            Best ExecutionResult found so far, or None
        """
        return self.history.get_best()

    # Legacy compatibility method
    def _benchmark(
        self,
        context: TuningContext,
        param_values: Optional[Dict[str, int]] = None,
    ) -> BenchmarkResult:
        """
        Legacy method for backward compatibility.

        Use executor.compile_and_benchmark() instead in new code.
        """
        if param_values:
            candidate = CandidateConfig(param_values=param_values)
            result = self.executor.compile_and_benchmark(candidate)
            return result.benchmark_result
        else:
            result = self.executor.benchmark_baseline()
            return result.benchmark_result
