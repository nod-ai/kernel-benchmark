"""Constrained random sampling tuning paradigm."""

import random
from typing import Iterator, List, Optional, override

from kernel_bench.tuning.core import CandidateConfig
from .paradigm import TuningParadigm, TuningContext, RichProgressManager
from .registry import register_paradigm
from kernel_bench.utils.print_utils import get_logger


@register_paradigm(
    "random",
    "Random sampling with constraint validation (batch)",
    {"batch_size": None},
)
class ConstrainedRandom(TuningParadigm):
    """
    Constrained random sampling paradigm.

    Generates random configurations that satisfy constraints,
    evaluates them in batches, and tracks the best result.
    This is an efficient baseline that explores the space uniformly.
    """

    def __init__(self, batch_size: Optional[int] = None):
        """
        Initialize constrained random tuner.

        Args:
            batch_size: Number of candidates per batch.
                       Defaults to max(20, num_trials // 4)
        """
        super().__init__()
        self.batch_size = batch_size
        self.evaluated_count = 0
        self.logger = get_logger()

    @override
    def get_name(self) -> str:
        return "Constrained Random Tuning"

    @override
    def setup(self, context: TuningContext, progress: RichProgressManager):
        """Setup tuning parameters."""
        super().setup(context, progress)

        # Determine batch size
        if self.batch_size is None:
            self.batch_size = max(20, context.num_trials // 4)

        self.params = context.bench.tuning_spec.params()

    @override
    def generate_candidates(self) -> Iterator[List[CandidateConfig]]:
        """
        Generate random valid candidates in batches.

        Yields batches of candidates for efficient batch compilation
        and benchmarking.
        """
        while self.evaluated_count < self.context.num_trials:
            # Calculate how many candidates we still need
            remaining = self.context.num_trials - self.evaluated_count
            current_batch_size = min(self.batch_size, remaining)

            # Generate a batch of valid candidates
            batch = []
            attempts = 0
            max_attempts = current_batch_size * 100  # Avoid infinite loops

            while len(batch) < current_batch_size and attempts < max_attempts:
                attempts += 1

                # Generate random configuration
                param_values = {
                    p.name: random.choice(p.bounds.get_range()) for p in self.params
                }

                # Check constraints
                is_valid, _ = self.context.bench.tuning_spec.validate_constraints(
                    parameter_values=param_values
                )

                if is_valid:
                    candidate = CandidateConfig(param_values=param_values)
                    # Avoid duplicates within batch
                    if candidate not in batch:
                        batch.append(candidate)

            if not batch:
                # Couldn't generate valid candidates
                self.logger.warning(
                    f"Could not generate valid candidates after {max_attempts} attempts"
                )
                break

            self.evaluated_count += len(batch)
            yield batch

    @override
    def should_stop(self) -> bool:
        """Stop when we've evaluated enough candidates."""
        return self.evaluated_count >= self.context.num_trials
