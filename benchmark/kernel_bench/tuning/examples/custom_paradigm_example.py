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
            self.all_candidates = random.sample(
                self.all_candidates, 
                context.num_trials
            )
    
    def generate_candidates(self) -> Iterator[List[CandidateConfig]]:
        """Yield candidates in batches."""
        while self.current_idx < len(self.all_candidates):
            # Get next batch
            batch_end = min(
                self.current_idx + self.batch_size,
                len(self.all_candidates)
            )
            batch = self.all_candidates[self.current_idx:batch_end]
            
            self.current_idx = batch_end
            yield batch
    
    def should_stop(self) -> bool:
        """Stop when all candidates have been evaluated."""
        return self.current_idx >= len(self.all_candidates)


class AdaptiveRandomParadigm(TuningParadigm):
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
                    p.name: random.choice(p.bounds.get_range())
                    for p in params
                }
            else:
                # Exploitation phase: sample around best
                best = self.history.get_best()
                if best:
                    param_values = self._sample_around_best(best, params)
                else:
                    # Fallback to random if no good results yet
                    param_values = {
                        p.name: random.choice(p.bounds.get_range())
                        for p in params
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
            
            local_range = param_range[min_idx:max_idx + 1]
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

