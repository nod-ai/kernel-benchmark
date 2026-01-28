"""
Tracker Scheduler

Checks tracker schedules and triggers benchmark runs at the appropriate times.
"""

import logging
from datetime import datetime, timezone
import traceback
from typing import Optional

from backend.runs.trigger_service import trigger_run, TriggerType
from backend.runs.scheduling.scheduling_utils import is_tracker_due_now
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
            trackers = TrackerDb.query("isActive eq true")

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
            logger.error(
                f"Error in check_and_trigger_due_trackers: {traceback.format_exc()}"
            )

    def _is_tracker_due(self, tracker: Tracker, now: datetime) -> bool:
        """
        Check if a tracker should run now based on its schedule.

        Args:
            tracker: The tracker to check
            now: Current UTC datetime

        Returns:
            True if the tracker should run now
        """
        # Check if already triggered recently (within grace window)
        last_trigger = self._last_triggered.get(tracker._id)
        if last_trigger:
            time_since_trigger = (now - last_trigger).total_seconds() / 60
            if time_since_trigger < SCHEDULE_GRACE_WINDOW_MINUTES:
                return False

        # Use shared utility to check if tracker is due
        return is_tracker_due_now(
            tracker, now, grace_minutes=SCHEDULE_GRACE_WINDOW_MINUTES
        )

    def _trigger_tracker_run(self, tracker: Tracker):
        """
        Trigger a benchmark run for the given tracker.

        Args:
            tracker: The tracker to trigger
        """
        now = datetime.now(timezone.utc)
        formatted_time = now.strftime("%m/%d/%Y %I:%M %p UTC")

        metadata = {
            "name": f"{tracker.name} (Scheduled): {formatted_time}",
            "trackerId": tracker._id,
            "trackerName": tracker.name,
            "tags": tracker.tags,
            "backends": tracker.backends,
            "machine": tracker.machine,
            "branch": tracker.branch,
            "blobName": tracker.blobName,
        }

        trigger_id = trigger_run(TriggerType.SCHEDULED, metadata)

        if trigger_id:
            logger.info(
                f"Successfully triggered run for tracker '{tracker.name}' (trigger_id: {trigger_id})"
            )
        else:
            logger.error(f"Failed to trigger run for tracker '{tracker.name}'")
