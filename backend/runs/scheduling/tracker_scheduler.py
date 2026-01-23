"""
Tracker Scheduler

Checks tracker schedules and triggers benchmark runs at the appropriate times.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from backend.runs.trigger_service import trigger_run, TriggerType
from backend.storage.types import Tracker, TrackerDb

logger = logging.getLogger(__name__)

# Grace window in minutes - triggers are considered due if within this window
SCHEDULE_GRACE_WINDOW_MINUTES = 2


class TrackerScheduler:
    """
    Manages scheduled tracker runs.

    Checks active trackers and triggers runs when they become due based on
    their schedule configuration.
    """

    def __init__(self):
        # Track last execution time for each tracker to avoid duplicate triggers
        self._last_triggered: dict[str, datetime] = {}

    def check_and_trigger_due_trackers(self):
        """
        Main entry point called from event loop.

        Checks all active trackers and triggers runs for any that are due.
        """
        try:
            # Get all active trackers
            trackers = TrackerDb.find_all({"isActive": True})

            if not trackers:
                logger.debug("No active trackers found")
                return

            now = datetime.now(timezone.utc)
            logger.debug(
                f"Checking {len(trackers)} active trackers at {now.isoformat()}"
            )

            for tracker in trackers:
                try:
                    if self._is_tracker_due(tracker, now):
                        logger.info(f"Tracker '{tracker.name}' is due, triggering run")
                        self._trigger_tracker_run(tracker)
                        self._last_triggered[tracker._id] = now
                except Exception as e:
                    logger.error(f"Error processing tracker {tracker._id}: {e}")

        except Exception as e:
            logger.error(f"Error in check_and_trigger_due_trackers: {e}")

    def _is_tracker_due(self, tracker: Tracker, now: datetime) -> bool:
        """
        Check if a tracker should run now based on its schedule.

        Args:
            tracker: The tracker to check
            now: Current UTC datetime

        Returns:
            True if the tracker should run now
        """
        schedule = tracker.schedule

        # Check if already triggered recently (within grace window)
        last_trigger = self._last_triggered.get(tracker._id)
        if last_trigger:
            time_since_trigger = (now - last_trigger).total_seconds() / 60
            if time_since_trigger < SCHEDULE_GRACE_WINDOW_MINUTES:
                return False

        # Check if schedule has ended
        if schedule.endDate:
            try:
                end_date = datetime.strptime(schedule.endDate, "%m-%d-%Y").replace(
                    tzinfo=timezone.utc
                )
                if now > end_date:
                    logger.debug(f"Tracker {tracker._id} schedule has ended")
                    return False
            except ValueError as e:
                logger.error(f"Invalid endDate format for tracker {tracker._id}: {e}")
                return False

        # Check if we've reached the start date
        try:
            start_date = datetime.strptime(schedule.startDate, "%m-%d-%Y").replace(
                tzinfo=timezone.utc
            )
            if now < start_date:
                logger.debug(f"Tracker {tracker._id} hasn't started yet")
                return False
        except ValueError as e:
            logger.error(f"Invalid startDate format for tracker {tracker._id}: {e}")
            return False

        # Parse time of day
        try:
            time_parts = schedule.timeOfDay.split(":")
            scheduled_hour = int(time_parts[0])
            scheduled_minute = int(time_parts[1])
        except (ValueError, IndexError) as e:
            logger.error(f"Invalid timeOfDay format for tracker {tracker._id}: {e}")
            return False

        # Check if current time matches scheduled time (within grace window)
        current_hour = now.hour
        current_minute = now.minute

        # Calculate time difference in minutes
        scheduled_time_minutes = scheduled_hour * 60 + scheduled_minute
        current_time_minutes = current_hour * 60 + current_minute

        # Check if within grace window (look back up to SCHEDULE_GRACE_WINDOW_MINUTES)
        time_diff = current_time_minutes - scheduled_time_minutes
        if time_diff < 0 or time_diff >= SCHEDULE_GRACE_WINDOW_MINUTES:
            return False

        # Check schedule type specific conditions
        if schedule.isInterval:
            return self._is_interval_due(tracker, now, start_date)
        else:
            return self._is_weekly_due(tracker, now)

    def _is_weekly_due(self, tracker: Tracker, now: datetime) -> bool:
        """
        Check if a weekly schedule tracker is due.

        Args:
            tracker: The tracker to check
            now: Current UTC datetime

        Returns:
            True if the tracker should run today
        """
        schedule = tracker.schedule

        if not schedule.daysOfWeek:
            logger.warning(
                f"Tracker {tracker._id} has weekly schedule but no daysOfWeek"
            )
            return False

        # Get current day of week in both formats
        current_day_full = now.strftime("%A")  # e.g., "Monday"
        current_day_abbr = now.strftime("%a")  # e.g., "Mon"

        # Check if any day in the schedule matches (supports both formats, case-insensitive)
        for day in schedule.daysOfWeek:
            day_lower = day.lower()
            if (
                day_lower == current_day_full.lower()
                or day_lower == current_day_abbr.lower()
            ):
                return True

        return False

    def _is_interval_due(
        self, tracker: Tracker, now: datetime, start_date: datetime
    ) -> bool:
        """
        Check if an interval schedule tracker is due.

        Args:
            tracker: The tracker to check
            now: Current UTC datetime
            start_date: The schedule start date

        Returns:
            True if the tracker should run today based on interval
        """
        schedule = tracker.schedule

        if not schedule.intervalValue or not schedule.intervalUnit:
            logger.warning(
                f"Tracker {tracker._id} has interval schedule but missing intervalValue or intervalUnit"
            )
            return False

        # Calculate time elapsed since start date
        days_elapsed = (now - start_date).days

        if schedule.intervalUnit == "weeks":
            interval_days = schedule.intervalValue * 7
        elif schedule.intervalUnit == "months":
            # Approximate months as 30 days for simplicity
            interval_days = schedule.intervalValue * 30
        else:
            logger.error(
                f"Unknown interval unit for tracker {tracker._id}: {schedule.intervalUnit}"
            )
            return False

        # Check if today is an interval day (or within grace period)
        # We check if we're on or just past an interval boundary
        if days_elapsed < 0:
            return False

        # Check if we're at an interval boundary
        if days_elapsed % interval_days == 0:
            return True

        # Also check if we just missed it by 1 day (in case of downtime)
        if days_elapsed % interval_days == 1:
            # Only trigger if we haven't triggered this cycle yet
            last_trigger = self._last_triggered.get(tracker._id)
            if last_trigger:
                days_since_trigger = (now - last_trigger).days
                if days_since_trigger < interval_days:
                    return False
            return True

        return False

    def _trigger_tracker_run(self, tracker: Tracker):
        """
        Trigger a benchmark run for the given tracker.

        Args:
            tracker: The tracker to trigger
        """
        metadata = {
            "trackerId": tracker._id,
            "trackerName": tracker.name,
            "tags": tracker.tags,
            "backends": tracker.backends,
            "machine": tracker.machine,
            "blobName": tracker.blobName,
        }

        trigger_id = trigger_run(TriggerType.SCHEDULED, metadata)

        if trigger_id:
            logger.info(
                f"Successfully triggered run for tracker '{tracker.name}' (trigger_id: {trigger_id})"
            )
        else:
            logger.error(f"Failed to trigger run for tracker '{tracker.name}'")
