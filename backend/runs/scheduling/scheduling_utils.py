"""
Shared Scheduling Utilities

This module consolidates all shared scheduling logic to avoid duplication
between tracker_scheduler.py, run_scheduler.py, and overlap_validator.py.

Provides utilities for:
- Date/time parsing and formatting
- Tracker schedule calculations
- Time comparisons and conversions
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple

from backend.storage.types import Tracker, Schedule, WorkflowRunState, WorkflowRunDb, TrackerDb

logger = logging.getLogger(__name__)

# Run statuses that indicate machine is occupied
ACTIVE_RUN_STATUSES = ["requested", "in_progress", "queued", "pending"]


# =============================================================================
# Date/Time Parsing
# =============================================================================


def parse_schedule_date(date_str: str) -> datetime:
    """
    Parse MM-DD-YYYY format to datetime with UTC timezone.
    
    Args:
        date_str: Date string in MM-DD-YYYY format
        
    Returns:
        datetime object with UTC timezone
        
    Raises:
        ValueError: If date string format is invalid
    """
    return datetime.strptime(date_str, "%m-%d-%Y").replace(tzinfo=timezone.utc)


def parse_schedule_time(time_str: str) -> Tuple[int, int]:
    """
    Parse HH:MM format to (hour, minute) tuple.
    
    Args:
        time_str: Time string in HH:MM format
        
    Returns:
        Tuple of (hour, minute) as integers
        
    Raises:
        ValueError: If time string format is invalid
        IndexError: If time string is malformed
    """
    parts = time_str.split(":")
    return int(parts[0]), int(parts[1])


def normalize_day_name(day: str) -> str:
    """
    Normalize day name to full format for consistent comparison.
    
    Handles both full names (Monday) and abbreviations (Mon).
    Case-insensitive to support "monday", "MONDAY", "Monday", etc.
    
    Args:
        day: Day name (full or abbreviated, any case)
        
    Returns:
        Full day name in proper case (e.g., "Monday")
        
    Examples:
        >>> normalize_day_name("mon")
        "Monday"
        >>> normalize_day_name("TUESDAY")
        "Tuesday"
        >>> normalize_day_name("Wed")
        "Wednesday"
    """
    # Convert to title case for consistent lookup
    day_title = day.strip().title()
    
    day_mapping = {
        "Mon": "Monday",
        "Tue": "Tuesday",
        "Wed": "Wednesday",
        "Thu": "Thursday",
        "Fri": "Friday",
        "Sat": "Saturday",
        "Sun": "Sunday",
    }
    
    # Return mapped value if abbreviation, otherwise return title-cased input
    return day_mapping.get(day_title, day_title)


# =============================================================================
# Time Utilities
# =============================================================================


def time_to_minutes(hour: int, minute: int) -> int:
    """
    Convert time to minutes since midnight.
    
    Args:
        hour: Hour (0-23)
        minute: Minute (0-59)
        
    Returns:
        Total minutes since midnight
        
    Examples:
        >>> time_to_minutes(0, 0)
        0
        >>> time_to_minutes(12, 30)
        750
        >>> time_to_minutes(23, 59)
        1439
    """
    return hour * 60 + minute


def minutes_between_times(time1_minutes: int, time2_minutes: int) -> int:
    """
    Calculate absolute difference between two times in minutes.
    
    Args:
        time1_minutes: First time in minutes since midnight
        time2_minutes: Second time in minutes since midnight
        
    Returns:
        Absolute difference in minutes
        
    Examples:
        >>> minutes_between_times(750, 900)  # 12:30 to 15:00
        150
        >>> minutes_between_times(900, 750)  # 15:00 to 12:30
        150
    """
    return abs(time1_minutes - time2_minutes)


# =============================================================================
# Tracker Schedule Calculations
# =============================================================================


def calculate_next_run_time(tracker: Tracker, from_time: datetime) -> Optional[datetime]:
    """
    Calculate when a tracker will next run after from_time.
    
    Handles both weekly and interval schedules. Respects schedule start/end dates.
    
    Args:
        tracker: The tracker to calculate next run time for
        from_time: Calculate next run after this time
        
    Returns:
        Next scheduled run time, or None if schedule is invalid/ended
        
    Examples:
        For a tracker scheduled weekly on Monday at 10:00 UTC:
        - If from_time is Monday 09:00, returns Monday 10:00 (same day)
        - If from_time is Monday 11:00, returns next Monday 10:00
        - If from_time is Tuesday, returns next Monday 10:00
    """
    schedule = tracker.schedule
    
    # Check if schedule has ended
    if schedule.endDate:
        try:
            end_date = parse_schedule_date(schedule.endDate)
            if from_time > end_date:
                return None
        except (ValueError, AttributeError):
            logger.warning(f"Invalid endDate for tracker {tracker._id}")
            return None
    
    # Parse scheduled time
    try:
        scheduled_hour, scheduled_minute = parse_schedule_time(schedule.timeOfDay)
    except (ValueError, IndexError, AttributeError):
        logger.error(f"Invalid timeOfDay for tracker {tracker._id}: {schedule.timeOfDay}")
        return None
    
    # Check if before start date
    try:
        start_date = parse_schedule_date(schedule.startDate)
        if from_time < start_date:
            return start_date.replace(hour=scheduled_hour, minute=scheduled_minute)
    except (ValueError, AttributeError):
        logger.error(f"Invalid startDate for tracker {tracker._id}")
        return None
    
    # Calculate based on schedule type
    if schedule.isInterval:
        return _calculate_next_interval_run(
            schedule, from_time, scheduled_hour, scheduled_minute, start_date
        )
    else:
        return _calculate_next_weekly_run(
            schedule, from_time, scheduled_hour, scheduled_minute
        )


def _calculate_next_interval_run(
    schedule: Schedule,
    from_time: datetime,
    scheduled_hour: int,
    scheduled_minute: int,
    start_date: datetime,
) -> Optional[datetime]:
    """
    Calculate next run for interval-based schedule.
    
    Args:
        schedule: The interval schedule
        from_time: Calculate next run after this time
        scheduled_hour: Hour of day to run (0-23)
        scheduled_minute: Minute of hour to run (0-59)
        start_date: Schedule start date
        
    Returns:
        Next scheduled run time, or None if invalid
    """
    # Calculate interval in days
    if schedule.intervalUnit == "weeks":
        interval_days = schedule.intervalValue * 7
    elif schedule.intervalUnit == "months":
        interval_days = schedule.intervalValue * 30  # Approximate
    else:
        logger.error(f"Invalid interval unit: {schedule.intervalUnit}")
        return None
    
    days_since_start = (from_time - start_date).days
    if days_since_start < 0:
        return start_date
    
    # Find next occurrence
    cycles_passed = days_since_start // interval_days
    
    # Check if current cycle's time hasn't passed yet
    current_cycle_day = start_date + timedelta(days=cycles_passed * interval_days)
    current_cycle_time = current_cycle_day.replace(
        hour=scheduled_hour, minute=scheduled_minute, second=0, microsecond=0
    )
    
    if from_time < current_cycle_time:
        return current_cycle_time
    
    # Current cycle passed, calculate next cycle
    next_cycle_day = start_date + timedelta(days=(cycles_passed + 1) * interval_days)
    return next_cycle_day.replace(
        hour=scheduled_hour, minute=scheduled_minute, second=0, microsecond=0
    )


def _calculate_next_weekly_run(
    schedule: Schedule,
    from_time: datetime,
    scheduled_hour: int,
    scheduled_minute: int,
) -> Optional[datetime]:
    """
    Calculate next run for weekly schedule.
    
    Args:
        schedule: The weekly schedule
        from_time: Calculate next run after this time
        scheduled_hour: Hour of day to run (0-23)
        scheduled_minute: Minute of hour to run (0-59)
        
    Returns:
        Next scheduled run time, or None if no days configured
    """
    if not schedule.daysOfWeek:
        logger.warning("Weekly schedule has no daysOfWeek configured")
        return None
    
    # Normalize all day names for consistent comparison
    normalized_days = {normalize_day_name(d) for d in schedule.daysOfWeek}
    
    # Check if runs today and hasn't happened yet
    today_scheduled = from_time.replace(
        hour=scheduled_hour, minute=scheduled_minute, second=0, microsecond=0
    )
    today_name = from_time.strftime("%A")
    
    if today_name in normalized_days and from_time < today_scheduled:
        return today_scheduled
    
    # Check next 7 days for matching day
    for days_ahead in range(1, 8):
        check_date = from_time + timedelta(days=days_ahead)
        check_day = check_date.strftime("%A")
        
        if check_day in normalized_days:
            return check_date.replace(
                hour=scheduled_hour, minute=scheduled_minute, second=0, microsecond=0
            )
    
    # Should never reach here if daysOfWeek is valid
    return None


def is_tracker_due_now(
    tracker: Tracker, now: datetime, grace_minutes: int = 2
) -> bool:
    """
    Check if tracker should run right now (within grace window).
    
    Used by tracker_scheduler to determine which trackers to trigger.
    
    Args:
        tracker: The tracker to check
        now: Current time
        grace_minutes: Grace window in minutes (default 2)
        
    Returns:
        True if tracker is due now (within grace window)
        
    Examples:
        If tracker scheduled at 10:00 with 2-minute grace:
        - At 09:58: False
        - At 10:00: True
        - At 10:01: True
        - At 10:02: False (outside grace window)
    """
    # Calculate when tracker will next run
    # Look back by grace window to catch runs that just started
    next_run = calculate_next_run_time(tracker, now - timedelta(minutes=grace_minutes))
    if not next_run:
        return False
    
    # Check if within grace window
    time_until_run = (next_run - now).total_seconds() / 60
    return 0 <= time_until_run < grace_minutes


def is_tracker_due_within(
    tracker: Tracker, from_time: datetime, hours_ahead: float
) -> bool:
    """
    Check if tracker will run within the specified time window.
    
    Used by run_scheduler to block queued runs if tracker scheduled soon.
    
    Args:
        tracker: The tracker to check
        from_time: Start of time window
        hours_ahead: Length of time window in hours
        
    Returns:
        True if tracker will run within the window
        
    Examples:
        If tracker scheduled at 15:00 and checking at 13:00 with 2-hour window:
        - Returns True (15:00 is within 13:00-15:00 window)
        
        If tracker scheduled at 16:00 and checking at 13:00 with 2-hour window:
        - Returns False (16:00 is outside 13:00-15:00 window)
    """
    next_run = calculate_next_run_time(tracker, from_time)
    if not next_run:
        return False
    
    cutoff = from_time + timedelta(hours=hours_ahead)
    return from_time <= next_run <= cutoff


# =============================================================================
# Schedule Description Formatting
# =============================================================================


def get_tracker_schedule_description(tracker: Tracker) -> str:
    """
    Generate human-readable description of tracker schedule.
    
    Useful for logging and error messages.
    
    Args:
        tracker: The tracker to describe
        
    Returns:
        Human-readable schedule description
        
    Examples:
        >>> get_tracker_schedule_description(weekly_tracker)
        "Monday, Wednesday at 10:00 UTC"
        >>> get_tracker_schedule_description(interval_tracker)
        "every 2 week(s) at 14:30 UTC"
    """
    schedule = tracker.schedule
    time_str = schedule.timeOfDay
    
    if schedule.isInterval:
        if schedule.intervalUnit == "weeks":
            return f"every {schedule.intervalValue} week(s) at {time_str} UTC"
        elif schedule.intervalUnit == "months":
            return f"every {schedule.intervalValue} month(s) at {time_str} UTC"
        else:
            return f"at {time_str} UTC"
    else:
        if schedule.daysOfWeek:
            days = ", ".join(schedule.daysOfWeek)
            return f"{days} at {time_str} UTC"
        else:
            return f"at {time_str} UTC"


# =============================================================================
# Machine and Tracker Query Utilities
# =============================================================================


def get_active_runs_by_machine(machine: str) -> List[WorkflowRunState]:
    """
    Get all in-progress workflow runs for a specific machine.
    
    Queries the database for runs with active statuses (requested, in_progress,
    queued, pending) on the specified machine.
    
    Args:
        machine: Machine name to check
        
    Returns:
        List of active workflow runs on this machine (empty list if none or error)
        
    Examples:
        >>> runs = get_active_runs_by_machine("mi325")
        >>> if runs:
        ...     print(f"Machine mi325 has {len(runs)} active runs")
    """
    try:
        # Query for runs that are active on this machine
        status_conditions = " or ".join(
            [f"status eq '{status}'" for status in ACTIVE_RUN_STATUSES]
        )
        query = f"machine eq '{machine}' and ({status_conditions})"
        
        active_runs = WorkflowRunDb.query(query)
        return active_runs
    except Exception as e:
        logger.error(f"Error querying active runs for machine {machine}: {e}")
        return []


def get_upcoming_trackers(machine: str, hours_ahead: float = 1.0) -> List[Tracker]:
    """
    Get trackers scheduled to run within specified time window on this machine.
    
    Uses is_tracker_due_within() to check each active tracker on the machine.
    Useful for checking if a machine will be needed by a tracker soon.
    
    Args:
        machine: Machine name to check
        hours_ahead: Time window in hours (default: 1.0)
        
    Returns:
        List of trackers that will run within the time window (empty list if none or error)
        
    Examples:
        >>> upcoming = get_upcoming_trackers("mi325", hours_ahead=2.0)
        >>> if upcoming:
        ...     print(f"Machine mi325 has {len(upcoming)} trackers scheduled soon")
    """
    try:
        # Get all active trackers for this machine
        all_trackers = TrackerDb.find_all({"isActive": True, "machine": machine})

        now = datetime.now(timezone.utc)
        upcoming = []

        for tracker in all_trackers:
            # Use shared utility to check if tracker is due within window
            if is_tracker_due_within(tracker, now, hours_ahead):
                upcoming.append(tracker)
                logger.debug(
                    f"Tracker '{tracker.name}' scheduled within {hours_ahead}h "
                    f"on machine {machine}"
                )

        return upcoming
    except Exception as e:
        logger.error(f"Error querying upcoming trackers for machine {machine}: {e}")
        return []
