"""Tuning paradigm implementations."""

from .paradigm import TuningParadigm, TuningContext, TuningResult
from .registry import (
    register_paradigm,
    get_paradigm,
    list_paradigms,
    get_paradigm_help,
)

# Import paradigm modules to trigger @register_paradigm decorators
from . import bayesian
from . import constrained_random
from . import grid_search
from . import adaptive_random

# Re-export paradigm classes for direct access
from .bayesian import BayesianTuningParadigm
from .constrained_random import ConstrainedRandom
from .grid_search import ConstrainedGridSearch
from .adaptive_random import AdaptiveRandom
