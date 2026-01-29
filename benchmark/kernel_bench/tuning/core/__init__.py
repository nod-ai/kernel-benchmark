"""Core infrastructure for hyperparameter tuning.

This module provides shared components for all tuning paradigms:
- CandidateConfig: Immutable configuration representation
- ExecutionEngine: Handles compilation and benchmarking
- RichProgressManager: Rich-based progress tracking
- TuningHistory: Result tracking and persistence
- ResultEvaluator: Scoring and comparison logic
"""

from .candidate import CandidateConfig
from .executor import ExecutionEngine, ExecutionResult
from .progress import RichProgressManager, SubTaskHandle
from .history import TuningHistory
from .evaluator import ResultEvaluator

__all__ = [
    "CandidateConfig",
    "ExecutionEngine",
    "ExecutionResult",
    "RichProgressManager",
    "SubTaskHandle",
    "TuningHistory",
    "ResultEvaluator",
]

