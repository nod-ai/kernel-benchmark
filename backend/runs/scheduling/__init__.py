"""
Tracker Scheduling Module

This module provides automation infrastructure for scheduled benchmark runs.
It handles:
- Checking tracker schedules and triggering runs at the right time
- Validating that trackers don't conflict on the same machine
"""

from .tracker_scheduler import TrackerScheduler
from .overlap_validator import validate_tracker_no_overlap

__all__ = ["TrackerScheduler", "validate_tracker_no_overlap"]
