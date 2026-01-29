"""Tuning history tracking and persistence."""

import json
import os
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, asdict

from .candidate import CandidateConfig
from .executor import ExecutionResult


@dataclass
class HistoryEntry:
    """Single entry in tuning history."""
    
    config: Dict[str, int]
    runtime: float
    tflops: float
    success: bool
    improvement: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return asdict(self)


class TuningHistory:
    """
    Centralized tracking of tuning history.
    
    Records all evaluations with automatic persistence,
    and provides query methods for analysis.
    """
    
    def __init__(self, context: "TuningContext"):
        """
        Initialize tuning history.
        
        Args:
            context: TuningContext for identifying the tuning run
        """
        self.context = context
        self.entries: List[HistoryEntry] = []
        self.baseline: Optional[ExecutionResult] = None
        self.best: Optional[ExecutionResult] = None
        
        # Setup persistence path
        self.history_dir = "results/tuning/history"
        os.makedirs(self.history_dir, exist_ok=True)
        
        bench = context.bench
        self.history_file = os.path.join(
            self.history_dir,
            f"{bench.backend}_{bench.config.get_name()}_worker{context.worker_id}.json"
        )
    
    def set_baseline(self, result: ExecutionResult):
        """
        Set the baseline result.
        
        Args:
            result: Baseline execution result
        """
        self.baseline = result
    
    def record(self, candidate: CandidateConfig, result: ExecutionResult):
        """
        Record a tuning result.
        
        Args:
            candidate: Candidate configuration
            result: Execution result
        """
        if not result.ok:
            # Still record failures for analysis
            entry = HistoryEntry(
                config=candidate.param_values,
                runtime=float('inf'),
                tflops=0.0,
                success=False,
                improvement=False
            )
        else:
            # Check if this is an improvement
            is_improvement = False
            if self.baseline and result.runtime < self.baseline.runtime:
                is_improvement = True
            
            entry = HistoryEntry(
                config=candidate.param_values,
                runtime=result.runtime,
                tflops=result.tflops,
                success=True,
                improvement=is_improvement
            )
            
            # Update best result
            if self.best is None or result < self.best:
                self.best = result
        
        self.entries.append(entry)
    
    def get_best(self) -> Optional[ExecutionResult]:
        """Get the best result found so far."""
        return self.best
    
    def get_improvements(self) -> List[HistoryEntry]:
        """Get all entries that improved over baseline."""
        return [entry for entry in self.entries if entry.improvement]
    
    def get_successful(self) -> List[HistoryEntry]:
        """Get all successful evaluations."""
        return [entry for entry in self.entries if entry.success]
    
    def get_failed(self) -> List[HistoryEntry]:
        """Get all failed evaluations."""
        return [entry for entry in self.entries if not entry.success]
    
    def num_evaluations(self) -> int:
        """Get total number of evaluations."""
        return len(self.entries)
    
    def save(self, additional_metadata: Optional[Dict[str, Any]] = None):
        """
        Save history to disk.
        
        Args:
            additional_metadata: Optional additional metadata to include
        """
        data = {
            "config": self.context.bench.config.to_dict(),
            "baseline": {
                "runtime": self.baseline.runtime if self.baseline else None,
                "tflops": self.baseline.tflops if self.baseline else None,
            },
            "best": {
                "config": self.best.candidate.param_values if self.best else None,
                "runtime": self.best.runtime if self.best else None,
                "tflops": self.best.tflops if self.best else None,
            },
            "history": [entry.to_dict() for entry in self.entries],
            "stats": {
                "total_evaluations": len(self.entries),
                "successful": len(self.get_successful()),
                "failed": len(self.get_failed()),
                "improvements": len(self.get_improvements()),
            }
        }
        
        if additional_metadata:
            data["metadata"] = additional_metadata
        
        with open(self.history_file, "w") as f:
            json.dump(data, f, indent=4)
    
    def load(self) -> bool:
        """
        Load history from disk if it exists.
        
        Returns:
            True if history was loaded, False otherwise
        """
        if not os.path.exists(self.history_file):
            return False
        
        try:
            with open(self.history_file, "r") as f:
                data = json.load(f)
            
            # Reconstruct entries
            self.entries = [
                HistoryEntry(**entry) for entry in data.get("history", [])
            ]
            
            return True
        except Exception:
            return False

