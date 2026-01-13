"""Candidate configuration representation."""

from typing import Dict, Any, Optional
from dataclasses import dataclass, field
import hashlib
import json


@dataclass(frozen=True)
class CandidateConfig:
    """
    Immutable representation of a parameter configuration.
    
    This class wraps parameter values and provides:
    - Hashability for deduplication
    - Validation via constraints
    - Serialization/deserialization
    """
    
    param_values: Dict[str, int] = field(default_factory=dict)
    _hash: Optional[int] = field(default=None, init=False, compare=False)
    
    def __post_init__(self):
        # Compute and cache hash
        param_str = json.dumps(self.param_values, sort_keys=True)
        hash_val = int(hashlib.md5(param_str.encode()).hexdigest()[:16], 16)
        object.__setattr__(self, '_hash', hash_val)
    
    def __hash__(self) -> int:
        return self._hash
    
    def __eq__(self, other) -> bool:
        if not isinstance(other, CandidateConfig):
            return False
        return self.param_values == other.param_values
    
    def to_dict(self) -> Dict[str, int]:
        """Return parameter values as dictionary."""
        return dict(self.param_values)
    
    @classmethod
    def from_dict(cls, param_values: Dict[str, int]) -> "CandidateConfig":
        """Create CandidateConfig from dictionary."""
        return cls(param_values=param_values)
    
    def __repr__(self) -> str:
        return f"CandidateConfig({self.param_values})"

