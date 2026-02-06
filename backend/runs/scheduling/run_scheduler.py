"""
Run Scheduler

Manages queued benchmark runs and dispatches them when machine resources are
available. Ensures no conflicts with active runs or scheduled tracker runs.

Key features:
- FIFO queue processing (oldest triggers dispatched first)
- Machine availability checking (no concurrent runs on same machine)
- Tracker priority enforcement (blocks 1 hour before scheduled trackers)
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional

from backend.github_utils.actions import trigger_workflow_dispatch
from backend.github_utils.gist import create_gist
from backend.globals import BENCH_REPO_BRANCH
from backend.runs.scheduling.scheduling_utils import (
    is_tracker_due_within,
    get_active_runs_by_machine,
    get_dispatched_triggers_by_machine,
    get_upcoming_trackers,
)
from backend.runs.trigger_service import (
    _determine_workflow,
    _build_workflow_inputs,
)
from backend.storage.triggers import RunTrigger, RunTriggerDb, TriggerStatus, TriggerType
from backend.storage.types import WorkflowRunState, WorkflowRunDb, Tracker, TrackerDb

logger = logging.getLogger(__name__)

# Tracker priority grace period: block queued runs this many hours before tracker
TRACKER_GRACE_HOURS = 1.0

# Run statuses that indicate machine is occupied
ACTIVE_RUN_STATUSES = ["requested", "in_progress", "queued", "pending"]


class RunScheduler:
    """
    Manages the queue of pending workflow run triggers.
    
    Periodically checks queued triggers and dispatches them when:
    1. No active runs on the same machine
    2. No trackers scheduled to run soon (within TRACKER_GRACE_HOURS)
    """

    def __init__(self):
        """Initialize the run scheduler (stateless - uses database as source of truth)."""
        pass

    def check_and_dispatch_queued_runs(self):
        """
        Main entry point called from event loop.
        
        Checks all queued triggers and dispatches any that are ready.
        Processes in FIFO order (oldest triggers first).
        """
        try:
            # Get all queued triggers
            queued_query = f"status eq '{TriggerStatus.QUEUED.value}'"
            queued_triggers = RunTriggerDb.query(queued_query)

            if not queued_triggers:
                logger.debug("No queued triggers found")
                return

            # Sort by timestamp (oldest first - FIFO)
            queued_triggers.sort(key=lambda t: t.timestamp)

            logger.info(f"Found {len(queued_triggers)} queued trigger(s), checking for dispatch")

            dispatched_count = 0
            for trigger in queued_triggers:
                try:
                    if self._can_dispatch(trigger):
                        logger.info(
                            f"Dispatching trigger {trigger._id} for machine {trigger.machine}"
                        )
                        success = self._dispatch_trigger(trigger)
                        if success:
                            dispatched_count += 1
                        else:
                            logger.warning(f"Failed to dispatch trigger {trigger._id}")
                    else:
                        logger.debug(
                            f"Cannot dispatch trigger {trigger._id} yet "
                            f"(machine {trigger.machine} unavailable or tracker scheduled soon)"
                        )
                except Exception as e:
                    logger.error(f"Error processing trigger {trigger._id}: {e}")

            if dispatched_count > 0:
                logger.info(f"Successfully dispatched {dispatched_count} trigger(s)")

        except Exception as e:
            logger.error(f"Error in check_and_dispatch_queued_runs: {e}")

    def _can_dispatch(self, trigger: RunTrigger) -> bool:
        """
        Check if trigger can be dispatched now.
        
        Checks:
        1. No active runs on same machine (from linked triggers)
        2. No dispatched triggers waiting in GitHub (pending runs)
        3. No trackers scheduled within grace period
        
        Args:
            trigger: The trigger to check
            
        Returns:
            True if trigger can be dispatched safely
        """
        # Check for active runs on this machine (using 24h window)
        active_runs = get_active_runs_by_machine(trigger.machine, cutoff_hours=24)
        if active_runs:
            logger.debug(
                f"Machine {trigger.machine} has {len(active_runs)} active run(s), "
                f"cannot dispatch trigger {trigger._id}"
            )
            return False
        
        # Check for dispatched triggers (GitHub pending, using 24h window)
        dispatched_triggers = get_dispatched_triggers_by_machine(trigger.machine, cutoff_hours=24)
        if dispatched_triggers:
            logger.debug(
                f"Machine {trigger.machine} has {len(dispatched_triggers)} dispatched trigger(s) "
                f"pending in GitHub, cannot dispatch trigger {trigger._id}"
            )
            return False

        # Check for upcoming tracker schedules (tracker priority, using shared utility)
        upcoming_trackers = get_upcoming_trackers(
            trigger.machine, hours_ahead=TRACKER_GRACE_HOURS
        )
        if upcoming_trackers:
            logger.debug(
                f"Machine {trigger.machine} has {len(upcoming_trackers)} tracker(s) "
                f"scheduled within {TRACKER_GRACE_HOURS} hour(s), "
                f"cannot dispatch trigger {trigger._id}"
            )
            return False

        return True

    def _dispatch_trigger(self, trigger: RunTrigger) -> bool:
        """
        Dispatch a trigger to GitHub Actions.
        
        Performs the actual workflow dispatch and updates trigger status.
        Reuses logic from trigger_service module.
        
        Args:
            trigger: The trigger to dispatch
            
        Returns:
            True if dispatch succeeded, False otherwise
        """
        try:
            # Determine workflow file
            trigger_type = TriggerType(trigger.type)
            workflow_file = _determine_workflow(trigger_type, trigger.metadata)
            
            if not workflow_file:
                logger.error(
                    f"Could not determine workflow for trigger {trigger._id} "
                    f"of type {trigger.type}"
                )
                RunTriggerDb.update_by_id(
                    trigger._id,
                    {
                        "status": TriggerStatus.FAILED.value,
                        "error": "Could not determine workflow file",
                    },
                )
                return False

            # Build workflow inputs
            inputs = _build_workflow_inputs(trigger_type, trigger.metadata, trigger._id)

            # Dispatch to GitHub with specified branch
            success = trigger_workflow_dispatch(
                repo_id="bench",
                branch_name=trigger.branch,
                workflow_id=workflow_file,
                inputs=inputs,
            )

            # Update trigger status
            if success:
                RunTriggerDb.update_by_id(
                    trigger._id,
                    {
                        "status": TriggerStatus.DISPATCHED.value,
                        "dispatchedAt": datetime.now(timezone.utc),
                    },
                )
                logger.info(f"Successfully dispatched trigger {trigger._id}")
                return True
            else:
                RunTriggerDb.update_by_id(
                    trigger._id,
                    {
                        "status": TriggerStatus.FAILED.value,
                        "error": "Workflow dispatch failed",
                    },
                )
                logger.error(f"Failed to dispatch trigger {trigger._id}")
                return False

        except Exception as e:
            logger.error(f"Error dispatching trigger {trigger._id}: {e}")
            try:
                RunTriggerDb.update_by_id(
                    trigger._id,
                    {
                        "status": TriggerStatus.FAILED.value,
                        "error": str(e),
                    },
                )
            except:
                pass
            return False
