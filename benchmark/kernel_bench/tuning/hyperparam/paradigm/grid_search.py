"""Tree-based multi-pass tuning paradigm."""

import itertools
import numpy as np
from typing import Dict, List, Optional, Iterator, override
from dataclasses import dataclass

from kernel_bench.tuning.core import CandidateConfig, ExecutionResult
from ..parameters import CategoricalBounds
from .paradigm import TuningParadigm, TuningContext, RichProgressManager
from kernel_bench.utils.print_utils import get_logger


@dataclass
class GridParameter:
    """Represents a tunable parameter for tree-based exploration."""

    name: str
    values: List[int]
    is_categorical: bool = False

    def get_candidates(
        self,
        num_candidates: int,
        center: Optional[int] = None,
        range_fraction: float = 1.0,
    ) -> List[int]:
        """
        Generate candidate values for this parameter.

        Args:
            num_candidates: Number of candidates to generate
            center: Center point for refined search (None for initial pass)
            range_fraction: Fraction of the original range to use

        Returns:
            List of candidate values
        """
        if center is None:
            # Initial pass: evenly distribute across all values
            if num_candidates == 1:
                return [self.values[len(self.values) // 2]]
            elif num_candidates >= len(self.values):
                return self.values.copy()
            else:
                indices = []
                step = (len(self.values) - 1) / (num_candidates - 1)
                for i in range(num_candidates):
                    idx = int(round(i * step))
                    indices.append(idx)
                unique_indices = list(dict.fromkeys(indices))
                return [self.values[i] for i in unique_indices]
        else:
            # Refinement pass: search around the center point
            if center not in self.values:
                center_idx = min(
                    range(len(self.values)), key=lambda i: abs(self.values[i] - center)
                )
            else:
                center_idx = self.values.index(center)

            # Calculate search range
            total_range = len(self.values) - 1
            search_range = max(1, int(total_range * range_fraction))
            search_range = max(search_range, num_candidates - 1)

            # Calculate bounds
            local_min_idx = max(0, center_idx - search_range // 2)
            local_max_idx = min(len(self.values) - 1, center_idx + search_range // 2)

            # Ensure enough values
            while local_max_idx - local_min_idx + 1 < num_candidates:
                if local_min_idx > 0:
                    local_min_idx -= 1
                if (
                    local_max_idx < len(self.values) - 1
                    and local_max_idx - local_min_idx + 1 < num_candidates
                ):
                    local_max_idx += 1
                if local_min_idx == 0 and local_max_idx == len(self.values) - 1:
                    break

            available_values = self.values[local_min_idx : local_max_idx + 1]

            if num_candidates >= len(available_values):
                return available_values
            else:
                indices = []
                step = (len(available_values) - 1) / (num_candidates - 1)
                for i in range(num_candidates):
                    idx = int(round(i * step))
                    indices.append(idx)
                unique_indices = list(dict.fromkeys(indices))
                return [available_values[i] for i in unique_indices]


class ConstrainedGridSearch(TuningParadigm):
    """
    Multi-pass tree-based hyperparameter tuner.

    Explores the hyperparameter space in multiple passes, starting with
    a coarse grid and progressively refining around the best results.
    Each pass narrows the search space based on previous findings.
    """

    def __init__(
        self,
        num_candidates: int = 3,
        num_passes: int = 3,
        range_reduction_factor: float = 0.5,
    ):
        """
        Initialize tree-based tuner.

        Args:
            num_candidates: Number of candidates to try per parameter
            num_passes: Number of refinement passes
            range_reduction_factor: Factor to reduce search range each pass
        """
        super().__init__()
        self.num_candidates = num_candidates
        self.num_passes = num_passes
        self.range_reduction_factor = range_reduction_factor
        self.parameters: List[GridParameter] = []
        self.current_pass = 0
        self.best_config: Optional[Dict[str, int]] = None
        self.logger = get_logger()

    @override
    def get_name(self) -> str:
        return "Tree-based Multi-pass Tuning"

    @override
    def setup(self, context: TuningContext, progress: RichProgressManager):
        """Setup tree parameters from tuning spec."""
        super().setup(context, progress)

        tuning_params = context.bench.tuning_spec.params()
        self.parameters = [
            GridParameter(
                name=param.name,
                values=param.bounds.get_range(),
                is_categorical=isinstance(param.bounds, CategoricalBounds),
            )
            for param in tuning_params
        ]

    @override
    def generate_candidates(self) -> Iterator[List[CandidateConfig]]:
        """
        Generate candidates pass by pass.

        Each pass explores the space at different granularity,
        refining around the best results from previous passes.

        Yields batches of candidates for each pass.
        """
        for pass_num in range(self.num_passes):
            self.progress.update(current=f"Pass {pass_num + 1}/{self.num_passes}")

            # Calculate range fraction for this pass
            range_fraction = (
                self.range_reduction_factor**pass_num if pass_num > 0 else 1.0
            )

            # Generate candidates for each parameter
            all_candidates = []
            for param in self.parameters:
                if self.best_config is None or param.is_categorical:
                    # First pass or categorical: use full range
                    candidates = param.get_candidates(self.num_candidates)
                else:
                    # Subsequent passes: refine around best value
                    center = self.best_config[param.name]
                    candidates = param.get_candidates(
                        self.num_candidates, center, range_fraction
                    )
                all_candidates.append([(param.name, val) for val in candidates])

            # Generate all combinations
            configurations = []
            for combination in itertools.product(*all_candidates):
                config = dict(combination)
                configurations.append(config)

            # Filter by constraints
            valid_configs = []
            for config in configurations:
                is_valid, _ = self.context.bench.tuning_spec.validate_constraints(
                    parameter_values=config
                )
                if is_valid:
                    valid_configs.append(config)

            # Limit total configurations if needed
            num_trials = self.context.num_trials
            max_configs = num_trials // self.num_passes + num_trials // 10

            if len(valid_configs) > max_configs:
                # Randomly sample to stay within budget
                indices = np.random.choice(
                    len(valid_configs), size=max_configs, replace=False
                )
                valid_configs = [valid_configs[i] for i in indices]

            # Convert to CandidateConfig objects
            candidates = [
                CandidateConfig(param_values=config) for config in valid_configs
            ]

            if not candidates:
                self.logger.warning(f"No valid candidates in pass {pass_num + 1}")
                break

            self.current_pass = pass_num + 1
            yield candidates

    @override
    def update_strategy(self, results: List[ExecutionResult]):
        """
        Update best config for next pass.

        After each pass, we identify the best configuration and use it
        as the center point for the next refinement pass.
        """
        # Find best result from this pass
        successful = [r for r in results if r.ok]
        if successful:
            best_result = min(successful, key=lambda r: r.runtime)
            self.best_config = best_result.candidate.param_values

            if self.evaluator.is_improvement(best_result):
                improvement_pct = self.evaluator.compute_improvement_percentage(
                    best_result
                )
                self.logger.info(
                    f"Pass {self.current_pass}: Found {improvement_pct:.1f}% improvement"
                )

    @override
    def should_stop(self) -> bool:
        """Stop after completing all passes."""
        return self.current_pass >= self.num_passes
