"""Rich-based progress tracking for tuning operations."""

import uuid
from contextlib import contextmanager
from typing import Optional, Callable

from kernel_bench.utils.parallel_utils.progress_context import ProgressEvent


class SubTaskHandle:
    """Handle for updating a sub-progress bar."""

    def __init__(self, manager: "RichProgressManager", sub_id: str, total: int):
        self.manager = manager
        self.sub_id = sub_id
        self.total = total
        self.completed = 0

    def step(self, amount: int = 1):
        """Increment progress by amount."""
        self.completed = min(self.total, self.completed + amount)
        self.manager._emit_event(
            "sub_update",
            {"sub_id": self.sub_id, "completed": self.completed, "total": self.total},
        )

    def update(self, completed: int):
        """Set progress to specific value."""
        self.completed = min(self.total, completed)
        self.manager._emit_event(
            "sub_update",
            {"sub_id": self.sub_id, "completed": self.completed, "total": self.total},
        )

    def complete(self):
        """Mark sub-task as complete."""
        self.completed = self.total
        self.manager._emit_event("sub_complete", {"sub_id": self.sub_id})


class RichProgressManager:
    """
    Rich-based progress tracking with hierarchical sub-tasks.

    Provides a clean API for managing main progress and sub-tasks,
    with automatic cleanup and event-based communication for
    multiprocessing compatibility.
    """

    def __init__(
        self, worker_id: int, device_id: int, callback: Callable[[ProgressEvent], None]
    ):
        """
        Initialize progress manager.

        Args:
            worker_id: Worker identifier
            device_id: GPU device identifier
            callback: Callback for emitting progress events
        """
        self.worker_id = worker_id
        self.device_id = device_id
        self.callback = callback
        self.total = 100
        self.completed = 0
        self.current = ""
        self.active = True
        self.color = "purple"  # Default to purple (searching)
        self.extra_info = ""  # For displaying candidate index
        self._sub_tasks = {}

    def configure(self, total: int, description: str, color: str = "purple"):
        """
        Configure the main progress bar.

        Args:
            total: Total number of steps
            description: Description of the task
            color: Progress bar color
        """
        self.total = total
        self.current = description
        self.color = color
        self._emit_event(
            "main_update",
            {
                "completed": self.completed,
                "total": self.total,
                "current": self.current,
                "active": self.active,
                "color": self.color,
                "extra_info": self.extra_info,
            },
        )

    def update(
        self,
        completed: Optional[int] = None,
        increment: int = 0,
        current: Optional[str] = None,
        color: Optional[str] = None,
        extra_info: Optional[str] = None,
    ):
        """
        Update main progress.

        Args:
            completed: Set progress to specific value
            increment: Increment progress by amount
            current: Update current task description
            color: Update progress bar color
            extra_info: Update extra info (e.g., candidate index)
        """
        if completed is not None:
            self.completed = completed
        else:
            self.completed += increment

        if current is not None:
            self.current = current

        if color is not None:
            self.color = color

        if extra_info is not None:
            self.extra_info = extra_info

        self.completed = max(0, min(self.completed, self.total))

        self._emit_event(
            "main_update",
            {
                "completed": self.completed,
                "total": self.total,
                "current": self.current,
                "active": self.active,
                "color": self.color,
                "extra_info": self.extra_info,
            },
        )

    def step(
        self,
        amount: int = 1,
        current: Optional[str] = None,
        color: Optional[str] = None,
        extra_info: Optional[str] = None,
    ):
        """
        Increment progress by amount.

        Args:
            amount: Amount to increment
            current: Optional task description update
            color: Optional color update
            extra_info: Optional extra info update
        """
        self.update(
            increment=amount, current=current, color=color, extra_info=extra_info
        )

    @contextmanager
    def create_subtask(self, name: str, total: int, color: str = "cyan"):
        """
        Create a sub-progress bar context.

        Args:
            name: Name of the sub-task
            total: Total steps for sub-task
            color: Progress bar color

        Yields:
            SubTaskHandle for updating progress
        """
        sub_id = f"{name}_{uuid.uuid4().hex[:8]}"

        # Notify creation
        self._emit_event(
            "sub_create",
            {
                "sub_id": sub_id,
                "name": name,
                "total": total,
                "color": color,
                "completed": 0,
            },
        )

        handle = SubTaskHandle(self, sub_id, total)
        self._sub_tasks[sub_id] = handle

        try:
            yield handle
        finally:
            # Auto-cleanup
            if sub_id in self._sub_tasks:
                del self._sub_tasks[sub_id]
            self._emit_event("sub_remove", {"sub_id": sub_id})

    def finish(self, message: str = "Complete"):
        """
        Mark progress as finished.

        Args:
            message: Completion message
        """
        self.completed = self.total
        self.current = message
        self.active = False

        # Cleanup any remaining sub-tasks
        for sub_id in list(self._sub_tasks.keys()):
            self._emit_event("sub_remove", {"sub_id": sub_id})
        self._sub_tasks.clear()

        self._emit_event(
            "main_update",
            {
                "completed": self.completed,
                "total": self.total,
                "current": self.current,
                "active": self.active,
                "color": self.color,
                "extra_info": self.extra_info,
            },
        )

    def _emit_event(self, event_type: str, data: dict):
        """Emit a progress event."""
        event = ProgressEvent(
            event_type=event_type,
            worker_id=self.worker_id,
            device_id=self.device_id,
            data=data,
        )
        self.callback(event)
