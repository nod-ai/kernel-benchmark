from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from .repository import create_repository


class TriggerType(Enum):
    """Types of triggers that can initiate workflow runs."""

    PR_UPDATE = "pr_update"  # Wave PR updated
    MANUAL_BENCHMARK = "manual_bench"  # Dashboard manual benchmark trigger
    MANUAL_TUNING = "manual_tuning"  # Dashboard manual tuning trigger
    SCHEDULED = "scheduled"  # Cron-based scheduled run
    REBASE = "rebase"  # Historical rebase/backfill


class TriggerStatus(Enum):
    """Status of a trigger through its lifecycle."""

    PENDING = "pending"  # Created, not yet dispatched
    QUEUED = "queued"  # Queued in scheduler, awaiting dispatch
    DISPATCHED = "dispatched"  # Workflow dispatch called successfully
    LINKED = "linked"  # Linked to actual GitHub run
    FAILED = "failed"  # Dispatch or linking failed


@dataclass
class RunTrigger:
    """
    Represents a trigger that initiates a workflow run.

    This is the single source of truth for "what we wanted to run" and provides
    a clean way to link workflow runs back to their initiating events.
    """

    _id: str  # Unique trigger ID (UUID)
    type: str  # TriggerType enum value
    status: str  # TriggerStatus enum value
    timestamp: datetime  # When trigger was created
    metadata: dict[str, Any]  # Type-specific metadata
    machine: str  # Machine for this run (required)

    # Set after workflow dispatch
    dispatchedAt: Optional[datetime] = None

    # Set after run is linked via webhook or polling
    runId: Optional[str] = None
    linkedAt: Optional[datetime] = None

    # Optional error information
    error: Optional[str] = None


# Create repository for RunTrigger with Azure Table Storage
RunTriggerDb = create_repository(RunTrigger, "runtriggers")
"""Repository for run triggers with full type safety."""


def link_trigger_to_run(trigger_id: str, run_id: str) -> bool:
    """
    Links a trigger to its corresponding GitHub workflow run.

    This is called by:
    - Webhook listener when a run starts (fast path)
    - Event loop polling for unlinked triggers (backup path)

    Args:
        trigger_id: The trigger's unique ID
        run_id: The GitHub workflow run ID

    Returns:
        True if successfully linked, False otherwise
    """
    try:
        trigger = RunTriggerDb.find_by_id(trigger_id)
        if not trigger:
            return False

        RunTriggerDb.update_by_id(
            trigger_id,
            {
                "runId": run_id,
                "status": TriggerStatus.LINKED.value,
                "linkedAt": datetime.now(timezone.utc),
            },
        )
        return True
    except Exception as e:
        print(f"Error linking trigger {trigger_id} to run {run_id}: {e}")
        return False
