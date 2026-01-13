"""
Example: Creating a custom tuning paradigm

This example demonstrates how to create a custom tuning paradigm
using the new modular infrastructure.
"""

import random
from typing import Iterator, List

from kernel_bench.tuning import TuningParadigm
from kernel_bench.tuning.core import CandidateConfig, ExecutionResult


class GridSearchParadigm(TuningParadigm):
    """
    Simple grid search paradigm.

    Systematically explores all combinations of parameter values,
    evaluating them in batches for efficiency.
    """

    def __init__(self, batch_size: int = 10):
        """
        Initialize grid search paradigm.

        Args:
            batch_size: Number of candidates to evaluate per batch
        """
        super().__init__()
        self.batch_size = batch_size
        self.all_candidates = []
        self.current_idx = 0

    def get_name(self) -> str:
        return "Grid Search"

    def setup(self, context, progress):
        """Generate all grid points upfront."""
        super().setup(context, progress)

        # Get all parameters
        params = context.bench.tuning_spec.params()

        # Generate all combinations
        param_ranges = {p.name: p.bounds.get_range() for p in params}

        # Create grid (simplified - in practice you'd use itertools.product)
        import itertools

        param_names = list(param_ranges.keys())
        param_values_list = [param_ranges[name] for name in param_names]

        for combination in itertools.product(*param_values_list):
            param_dict = dict(zip(param_names, combination))

            # Check constraints
            is_valid, _ = context.bench.tuning_spec.validate_constraints(
                parameter_values=param_dict
            )

            if is_valid:
                self.all_candidates.append(CandidateConfig(param_values=param_dict))

        # Limit to num_trials
        if len(self.all_candidates) > context.num_trials:
            # Random sample if too many
            import random

            self.all_candidates = random.sample(self.all_candidates, context.num_trials)

    def generate_candidates(self) -> Iterator[List[CandidateConfig]]:
        """Yield candidates in batches."""
        while self.current_idx < len(self.all_candidates):
            # Get next batch
            batch_end = min(
                self.current_idx + self.batch_size, len(self.all_candidates)
            )
            batch = self.all_candidates[self.current_idx : batch_end]

            self.current_idx = batch_end
            yield batch

    def should_stop(self) -> bool:
        """Stop when all candidates have been evaluated."""
        return self.current_idx >= len(self.all_candidates)


# Example usage
if __name__ == "__main__":
    """
    To use these paradigms:

    from kernel_bench.tuning import ParallelTuner
    from custom_paradigm_example import GridSearchParadigm, AdaptiveRandomParadigm

    # Grid search
    paradigm = GridSearchParadigm(batch_size=20)
    tuner = ParallelTuner(paradigm, num_gpus=8)
    results = tuner.tune_kernels(benches, "results.json", num_trials=100)

    # Adaptive random
    paradigm = AdaptiveRandomParadigm(exploration_ratio=0.3)
    tuner = ParallelTuner(paradigm, num_gpus=8)
    results = tuner.tune_kernels(benches, "results.json", num_trials=200)
    """
    print(__doc__)
