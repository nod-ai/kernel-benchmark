"""
Overlap Validator

Validates that tracker schedules don't conflict on the same machine within
a configurable grace period (default 2 hours).
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from backend.runs.scheduling.scheduling_utils import (
    normalize_day_name,
    parse_schedule_time,
    time_to_minutes,
    minutes_between_times,
)
from backend.storage.types import Tracker, TrackerDb, Schedule

logger = logging.getLogger(__name__)

# Grace period in hours - trackers within this time window are considered conflicting
OVERLAP_GRACE_HOURS = 2


@dataclass
class TimeSlot:
    """
    Represents a scheduled time slot.

    For weekly schedules: day_of_week is the day name (e.g., "Monday")
    For interval schedules: day_of_week is None, interval_days represents the cycle
    """

    hour: int
    minute: int
    day_of_week: Optional[str] = None  # For weekly schedules
    interval_days: Optional[int] = None  # For interval schedules


def validate_tracker_no_overlap(
    tracker: Tracker, tracker_id: Optional[str] = None
) -> tuple[bool, Optional[str]]:
    """
    Validate that a tracker doesn't overlap with existing trackers on the same machine.

    Args:
        tracker: The tracker to validate
        tracker_id: If provided, exclude this tracker from conflict checking (for updates)

    Returns:
        Tuple of (is_valid, error_message)
        - (True, None) if no conflicts
        - (False, error_message) if conflicts found
    """
    try:
        # Only validate active trackers
        if not tracker.isActive:
            return (True, None)

        # Get all active trackers on the same machine
        all_trackers = TrackerDb.find_all()
        same_machine_trackers = [
            t
            for t in all_trackers
            if t.machine == tracker.machine
            and t.isActive
            and t._id != tracker_id  # Exclude self when updating
        ]

        if not same_machine_trackers:
            return (True, None)

        # Extract time slots for the new tracker
        new_slots = _extract_time_slots(tracker.schedule)

        # Check against each existing tracker
        for existing_tracker in same_machine_trackers:
            existing_slots = _extract_time_slots(existing_tracker.schedule)

            # Check for conflicts
            for new_slot in new_slots:
                for existing_slot in existing_slots:
                    if _time_slots_conflict(new_slot, existing_slot):
                        error_msg = _format_conflict_message(
                            tracker, new_slot, existing_tracker, existing_slot
                        )
                        return (False, error_msg)

        return (True, None)

    except Exception as e:
        logger.error(f"Error validating tracker overlap: {e}")
        return (False, f"Validation error: {str(e)}")


def _extract_time_slots(schedule: Schedule) -> list[TimeSlot]:
    """
    Extract all time slots from a schedule.

    Args:
        schedule: The schedule to extract slots from

    Returns:
        List of TimeSlot objects
    """
    slots = []

    try:
        # Parse time of day using shared utility
        hour, minute = parse_schedule_time(schedule.timeOfDay)

        if schedule.isInterval:
            # For interval schedules, create a single representative slot
            if schedule.intervalUnit == "weeks":
                interval_days = schedule.intervalValue * 7
            elif schedule.intervalUnit == "months":
                interval_days = schedule.intervalValue * 30
            else:
                logger.warning(f"Unknown interval unit: {schedule.intervalUnit}")
                interval_days = 7  # Default to weekly

            slots.append(
                TimeSlot(hour=hour, minute=minute, interval_days=interval_days)
            )
        else:
            # For weekly schedules, create a slot for each day
            if schedule.daysOfWeek:
                for day in schedule.daysOfWeek:
                    slots.append(TimeSlot(hour=hour, minute=minute, day_of_week=day))

    except (ValueError, IndexError, AttributeError) as e:
        logger.error(f"Error parsing schedule: {e}")

    return slots


def _time_slots_conflict(slot1: TimeSlot, slot2: TimeSlot) -> bool:
    """
    Check if two time slots conflict within the grace period.

    Args:
        slot1: First time slot
        slot2: Second time slot

    Returns:
        True if the slots conflict
    """
    # Convert time to minutes since midnight using shared utility
    slot1_minutes = time_to_minutes(slot1.hour, slot1.minute)
    slot2_minutes = time_to_minutes(slot2.hour, slot2.minute)

    grace_minutes = OVERLAP_GRACE_HOURS * 60

    # Check schedule type compatibility
    # Weekly vs Weekly: must be same day
    if slot1.day_of_week and slot2.day_of_week:
        # Normalize day names using shared utility
        day1 = normalize_day_name(slot1.day_of_week)
        day2 = normalize_day_name(slot2.day_of_week)
        
        if day1 != day2:
            return False  # Different days, no conflict

        # Same day - check time difference using shared utility
        time_diff = minutes_between_times(slot1_minutes, slot2_minutes)
        return time_diff < grace_minutes

    # Interval vs Interval: check if intervals might overlap
    elif slot1.interval_days and slot2.interval_days:
        # Check if the time of day conflicts using shared utility
        time_diff = minutes_between_times(slot1_minutes, slot2_minutes)
        if time_diff >= grace_minutes:
            return False  # Times too far apart

        # Check if intervals might coincide
        # Two interval schedules conflict if their cycles can align
        # For simplicity, we consider them conflicting if:
        # 1. Same interval length, OR
        # 2. One interval is a multiple of the other
        if slot1.interval_days == slot2.interval_days:
            return True

        # Check if one is a multiple of the other
        larger = max(slot1.interval_days, slot2.interval_days)
        smaller = min(slot1.interval_days, slot2.interval_days)
        if larger % smaller == 0:
            return True

        return False

    # Mixed weekly and interval: check if they might overlap
    else:
        # For mixed schedules, we need to be conservative
        # Check if the time of day is within grace period using shared utility
        time_diff = minutes_between_times(slot1_minutes, slot2_minutes)

        if time_diff < grace_minutes:
            # If interval schedule could fall on the weekly day, it conflicts
            # For simplicity, we'll consider it a potential conflict
            return True

        return False


def _format_conflict_message(
    new_tracker: Tracker,
    new_slot: TimeSlot,
    existing_tracker: Tracker,
    existing_slot: TimeSlot,
) -> str:
    """
    Format a user-friendly conflict error message.

    Args:
        new_tracker: The tracker being validated
        new_slot: The conflicting slot from new tracker
        existing_tracker: The existing conflicting tracker
        existing_slot: The conflicting slot from existing tracker

    Returns:
        Formatted error message
    """
    # Format time
    time_str = f"{new_slot.hour:02d}:{new_slot.minute:02d}"

    # Format schedule description
    if new_slot.day_of_week:
        schedule_desc = f"{new_slot.day_of_week} at {time_str} UTC"
    elif new_slot.interval_days:
        if new_slot.interval_days % 30 == 0:
            months = new_slot.interval_days // 30
            schedule_desc = f"every {months} month(s) at {time_str} UTC"
        elif new_slot.interval_days % 7 == 0:
            weeks = new_slot.interval_days // 7
            schedule_desc = f"every {weeks} week(s) at {time_str} UTC"
        else:
            schedule_desc = f"every {new_slot.interval_days} day(s) at {time_str} UTC"
    else:
        schedule_desc = f"at {time_str} UTC"

    return (
        f"Tracker schedule conflicts with existing tracker '{existing_tracker.name}' "
        f"on machine {new_tracker.machine}. Both run {schedule_desc} "
        f"(within {OVERLAP_GRACE_HOURS}-hour window)."
    )
