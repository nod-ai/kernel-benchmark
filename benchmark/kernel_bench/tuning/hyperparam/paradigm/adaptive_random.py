import random
from typing import Iterator, List

from .paradigm import TuningParadigm
from .registry import register_paradigm
from kernel_bench.tuning.core import CandidateConfig, ExecutionResult


@register_paradigm(
    "adaptive",
    "Adaptive random search focusing on promising regions (mixed)",
    {"exploration_ratio": 0.3},
)
class AdaptiveRandom(TuningParadigm):
    """
    Adaptive random search that focuses on promising regions.

    Starts with random exploration, then adaptively samples
    around the best configurations found so far.
    """

    def __init__(self, exploration_ratio: float = 0.3):
        """
        Initialize adaptive random paradigm.

        Args:
            exploration_ratio: Fraction of trials for pure exploration
        """
        super().__init__()
        self.exploration_ratio = exploration_ratio
        self.evaluated_count = 0
        self.exploration_phase = True

    def get_name(self) -> str:
        return "Adaptive Random Search"

    def generate_candidates(self) -> Iterator[CandidateConfig]:
        """Generate candidates adaptively."""
        params = self.context.bench.tuning_spec.params()
        exploration_trials = int(self.context.num_trials * self.exploration_ratio)

        while self.evaluated_count < self.context.num_trials:
            if self.evaluated_count < exploration_trials:
                # Exploration phase: pure random
                param_values = {
                    p.name: random.choice(p.bounds.get_range()) for p in params
                }
            else:
                # Exploitation phase: sample around best
                best = self.history.get_best()
                if best:
                    param_values = self._sample_around_best(best, params)
                else:
                    # Fallback to random if no good results yet
                    param_values = {
                        p.name: random.choice(p.bounds.get_range()) for p in params
                    }

            # Check constraints
            is_valid, _ = self.context.bench.tuning_spec.validate_constraints(
                parameter_values=param_values
            )

            if is_valid:
                self.evaluated_count += 1
                yield CandidateConfig(param_values=param_values)

    def _sample_around_best(self, best: ExecutionResult, params):
        """Sample parameters around the best configuration."""
        best_params = best.candidate.param_values
        new_params = {}

        for p in params:
            best_value = best_params[p.name]
            param_range = p.bounds.get_range()

            # Find index of best value
            try:
                best_idx = param_range.index(best_value)
            except ValueError:
                # Best value not in range, pick random
                new_params[p.name] = random.choice(param_range)
                continue

            # Sample nearby values (within 20% of range)
            range_size = len(param_range)
            window = max(1, int(range_size * 0.2))

            min_idx = max(0, best_idx - window)
            max_idx = min(range_size - 1, best_idx + window)

            local_range = param_range[min_idx : max_idx + 1]
            new_params[p.name] = random.choice(local_range)

        return new_params

    def should_stop(self) -> bool:
        return self.evaluated_count >= self.context.num_trials

    def update_strategy(self, results: List[ExecutionResult]):
        """Log phase transitions."""
        exploration_trials = int(self.context.num_trials * self.exploration_ratio)

        if self.exploration_phase and self.evaluated_count >= exploration_trials:
            self.exploration_phase = False
            best = self.history.get_best()
            if best:
                speedup = self.evaluator.compute_speedup(best)
                print(f"Switching to exploitation phase (best speedup: {speedup:.2f}x)")
