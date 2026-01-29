"""Bayesian optimization tuning paradigm using Optuna."""

from typing import Iterator, List, Optional, override
import optuna

from kernel_bench.tuning.core import CandidateConfig, ExecutionResult
from ..parameters import CategoricalBounds, IntegerBounds
from .paradigm import TuningParadigm, TuningContext, RichProgressManager
from .registry import register_paradigm


@register_paradigm(
    "bayesian",
    "Bayesian optimization using Optuna TPE sampling (sequential)",
    {"n_startup_trials": None},
)
class BayesianTuningParadigm(TuningParadigm):
    """
    Optuna-based Bayesian hyperparameter tuning.
    
    This paradigm uses TPE (Tree-structured Parzen Estimator) sampling
    to probabilistically explore the hyperparameter space. It evaluates
    configurations sequentially, using results to inform future choices.
    """

    def __init__(self, n_startup_trials: Optional[int] = None):
        """
        Initialize Bayesian tuning paradigm.
        
        Args:
            n_startup_trials: Number of random trials before Bayesian sampling.
                             Defaults to max(num_trials // 5, 15)
        """
        super().__init__()
        self.n_startup_trials = n_startup_trials
        self.study: Optional[optuna.Study] = None
        self.trial_count = 0
        self.current_trial: Optional[optuna.Trial] = None

    @override
    def get_name(self) -> str:
        return "Bayesian (Optuna TPE)"

    @override
    def setup(self, context: TuningContext, progress: RichProgressManager):
        """Setup Optuna study."""
        super().setup(context, progress)
        
        # Determine startup trials
        if self.n_startup_trials is None:
            self.n_startup_trials = max(context.num_trials // 5, 15)
        
        # Create constraint function for Optuna
        def constraints_func(trial: optuna.trial.FrozenTrial):
            """Validate constraints for Optuna."""
            bench = self.context.bench
            is_valid, violations = bench.tuning_spec.validate_constraints(
                parameter_values=trial.params
            )
            return list(violations.values())
        
        # Create Optuna study
        sampler = optuna.samplers.TPESampler(
            constraints_func=constraints_func,
            n_startup_trials=self.n_startup_trials,
        )
        
        self.study = optuna.create_study(
            direction="minimize",
            sampler=sampler
        )

    @override
    def generate_candidates(self) -> Iterator[CandidateConfig]:
        """
        Generate candidates one at a time using Optuna.
        
        Yields single candidates for sequential evaluation, allowing
        Optuna to use each result before suggesting the next candidate.
        """
        params = self.context.bench.tuning_spec.params()
        
        while self.trial_count < self.context.num_trials:
            # Ask Optuna for next trial
            self.current_trial = self.study.ask()
            
            # Extract parameter constraints
            integer_constraints = [
                (p.name, p.bounds)
                for p in params
                if isinstance(p.bounds, IntegerBounds)
            ]
            categorical_constraints = [
                (p.name, p.bounds)
                for p in params
                if isinstance(p.bounds, CategoricalBounds)
            ]
            
            # Suggest values for each parameter
            param_values = {}
            
            for name, bounds in integer_constraints:
                param_values[name] = self.current_trial.suggest_int(
                    name,
                    bounds.min,
                    bounds.max,
                    step=bounds.step,
                )
            
            for name, bounds in categorical_constraints:
                param_values[name] = self.current_trial.suggest_categorical(
                    name,
                    bounds.get_range()
                )
            
            # Create candidate
            candidate = CandidateConfig(param_values=param_values)
            
            self.trial_count += 1
            yield candidate

    @override
    def update_strategy(self, results: List[ExecutionResult]):
        """
        Tell Optuna about the result.
        
        This allows Optuna to update its model and improve future suggestions.
        """
        if not results or self.current_trial is None:
            return
        
        result = results[0]  # Bayesian only evaluates one at a time
        
        if result.ok:
            # Tell Optuna the result
            self.study.tell(self.current_trial, result.runtime)
        else:
            # Prune failed trials
            self.study.tell(self.current_trial, state=optuna.trial.TrialState.PRUNED)
        
        self.current_trial = None

    @override
    def should_stop(self) -> bool:
        """Stop when we've completed the requested number of trials."""
        return self.trial_count >= self.context.num_trials
