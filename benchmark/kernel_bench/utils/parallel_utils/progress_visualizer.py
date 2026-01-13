"""Rich-based parallel progress visualization for multi-GPU tuning."""

from dataclasses import dataclass
from multiprocessing import Manager
from typing import Any, Dict, Optional
from rich.progress import (
    Progress,
    SpinnerColumn,
    BarColumn,
    TextColumn,
    TimeRemainingColumn,
    TaskID,
)
from rich.live import Live
from rich.console import Group, Console

from .progress_context import ProgressEvent


@dataclass
class WorkerMessage:
    """Message from worker process."""

    type: str  # 'progress' or 'result'
    data: Any


class RichParallelProgressManager:
    """
    Rich-based parallel progress manager for multi-GPU tuning.

    Displays a hierarchical view with:
    - Overall progress across all configurations
    - Per-worker progress bars showing current task
    - Sub-progress bars for compilation, benchmarking, etc.
    """

    def __init__(self, total_configs: int, num_workers: int):
        """
        Initialize the parallel progress manager.

        Args:
            total_configs: Total number of configurations to process
            num_workers: Number of parallel workers
        """
        # Create manager for shared state
        self.manager = Manager()
        self.shared_state = self.manager.dict()
        self.lock = self.manager.Lock()

        # Initialize shared state
        self.shared_state["total_completed"] = 0
        self.shared_state["total_configs"] = total_configs

        # Initialize worker states
        for i in range(num_workers):
            self.shared_state[f"worker_{i}_completed"] = 0
            self.shared_state[f"worker_{i}_total"] = 0
            self.shared_state[f"worker_{i}_current"] = "Idle"
            self.shared_state[f"worker_{i}_active"] = False
            self.shared_state[f"worker_{i}_color"] = "purple"
            self.shared_state[f"worker_{i}_extra_info"] = ""
            self.shared_state[f"worker_{i}_sub_progress"] = self.manager.dict()

        self.num_workers = num_workers
        self.total_configs = total_configs

        # Rich components
        self.console = Console()
        self.live: Optional[Live] = None
        self.main_progress: Optional[Progress] = None
        self.worker_progresses: Dict[int, Progress] = {}
        self.main_task: Optional[TaskID] = None
        self.worker_tasks: Dict[int, TaskID] = {}
        self.sub_tasks: Dict[str, tuple[Progress, TaskID]] = (
            {}
        )  # {worker_id}_{sub_id}: (progress, task)

    def start_main_progress(self):
        """Start the main progress display."""
        # Create main progress for overall completion
        self.main_progress = Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]{task.description}"),
            BarColumn(complete_style="green", finished_style="green"),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TextColumn("•"),
            TextColumn("{task.completed}/{task.total} configs"),
            TimeRemainingColumn(),
        )

        self.main_task = self.main_progress.add_task(
            "Overall Progress", total=self.total_configs
        )

        # Create progress bars for each worker
        for i in range(self.num_workers):
            worker_progress = Progress(
                TextColumn(f"  [bold cyan]GPU {i}:"),
                TextColumn("[dim]{task.description}"),
                BarColumn(),  # Will set style dynamically
                TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                TextColumn("({task.completed}/{task.total})"),
                TextColumn("[dim]{task.fields[extra_info]}"),  # Extra info field
            )
            self.worker_progresses[i] = worker_progress
            self.worker_tasks[i] = worker_progress.add_task(
                "Idle", total=100, extra_info=""
            )

        # Create live display with all progress bars
        self._update_display()

    def _update_display(self):
        """Update the live display with current progress state."""
        if self.live is not None:
            return  # Already started

        # Build progress group
        progress_group = [self.main_progress]

        for i in range(self.num_workers):
            progress_group.append(self.worker_progresses[i])

            # Add sub-progress bars for this worker
            worker_sub_progress = self.shared_state.get(f"worker_{i}_sub_progress", {})
            for sub_id, sub_data in worker_sub_progress.items():
                sub_key = f"{i}_{sub_id}"
                if sub_key in self.sub_tasks:
                    sub_progress, _ = self.sub_tasks[sub_key]
                    progress_group.append(sub_progress)

        # Create live display
        self.live = Live(
            Group(*progress_group),
            console=self.console,
            refresh_per_second=4,
        )
        self.live.start()

    def handle_progress_event(self, event: ProgressEvent):
        """Handle progress events from workers."""
        worker_id = event.device_id

        with self.lock:
            if event.event_type == "main_update":
                # Update main worker progress
                data = event.data
                self.shared_state[f"worker_{worker_id}_completed"] = data["completed"]
                self.shared_state[f"worker_{worker_id}_total"] = data["total"]
                self.shared_state[f"worker_{worker_id}_current"] = data["current"]
                self.shared_state[f"worker_{worker_id}_active"] = data["active"]
                self.shared_state[f"worker_{worker_id}_color"] = data.get(
                    "color", "purple"
                )
                self.shared_state[f"worker_{worker_id}_extra_info"] = data.get(
                    "extra_info", ""
                )

                # Check if this is a final update
                if not data["active"] and data["completed"] >= data["total"]:
                    self.shared_state["total_completed"] = (
                        self.shared_state.get("total_completed", 0) + 1
                    )

            elif event.event_type == "sub_create":
                # Create new sub-progress bar
                data = event.data
                sub_id = data["sub_id"]
                sub_key = f"{worker_id}_{sub_id}"

                # Update shared state
                worker_sub_progress = dict(
                    self.shared_state.get(f"worker_{worker_id}_sub_progress", {})
                )
                worker_sub_progress[sub_id] = {
                    "name": data["name"],
                    "total": data["total"],
                    "completed": data["completed"],
                    "color": data["color"],
                    "active": True,
                }
                self.shared_state[f"worker_{worker_id}_sub_progress"] = (
                    self.manager.dict(worker_sub_progress)
                )

                # Create the actual progress bar
                if sub_key not in self.sub_tasks:
                    sub_progress = Progress(
                        TextColumn(f"    [dim]└─ {{task.description}}"),
                        BarColumn(complete_style=data["color"]),
                        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                    )
                    sub_task = sub_progress.add_task(data["name"], total=data["total"])
                    self.sub_tasks[sub_key] = (sub_progress, sub_task)

            elif event.event_type == "sub_update":
                # Update existing sub-progress bar
                data = event.data
                sub_id = data["sub_id"]
                sub_key = f"{worker_id}_{sub_id}"

                # Update shared state
                worker_sub_progress = dict(
                    self.shared_state.get(f"worker_{worker_id}_sub_progress", {})
                )
                if sub_id in worker_sub_progress:
                    sub_progress_data = dict(worker_sub_progress[sub_id])
                    sub_progress_data["completed"] = data["completed"]
                    if "total" in data:
                        sub_progress_data["total"] = data["total"]
                    worker_sub_progress[sub_id] = sub_progress_data
                    self.shared_state[f"worker_{worker_id}_sub_progress"] = (
                        self.manager.dict(worker_sub_progress)
                    )

            elif event.event_type == "sub_complete":
                # Mark sub-progress as complete
                data = event.data
                sub_id = data["sub_id"]

                worker_sub_progress = dict(
                    self.shared_state.get(f"worker_{worker_id}_sub_progress", {})
                )
                if sub_id in worker_sub_progress:
                    sub_progress_data = dict(worker_sub_progress[sub_id])
                    sub_progress_data["completed"] = sub_progress_data["total"]
                    sub_progress_data["active"] = False
                    worker_sub_progress[sub_id] = sub_progress_data
                    self.shared_state[f"worker_{worker_id}_sub_progress"] = (
                        self.manager.dict(worker_sub_progress)
                    )

            elif event.event_type == "sub_remove":
                # Remove sub-progress bar
                data = event.data
                sub_id = data["sub_id"]
                sub_key = f"{worker_id}_{sub_id}"

                # Update shared state
                worker_sub_progress = dict(
                    self.shared_state.get(f"worker_{worker_id}_sub_progress", {})
                )
                if sub_id in worker_sub_progress:
                    del worker_sub_progress[sub_id]
                    self.shared_state[f"worker_{worker_id}_sub_progress"] = (
                        self.manager.dict(worker_sub_progress)
                    )

                # Remove progress bar
                if sub_key in self.sub_tasks:
                    del self.sub_tasks[sub_key]

    def refresh_display(self):
        """Refresh all progress bars based on shared state."""
        if self.main_progress is None or self.live is None:
            return

        with self.lock:
            # Update main progress bar
            completed = self.shared_state.get("total_completed", 0)
            self.main_progress.update(self.main_task, completed=completed)

            # Update worker progress bars
            for i in range(self.num_workers):
                if i in self.worker_tasks:
                    completed = self.shared_state.get(f"worker_{i}_completed", 0)
                    total = self.shared_state.get(f"worker_{i}_total", 100)
                    current = self.shared_state.get(f"worker_{i}_current", "Idle")
                    active = self.shared_state.get(f"worker_{i}_active", False)
                    color = self.shared_state.get(f"worker_{i}_color", "purple")
                    extra_info = self.shared_state.get(f"worker_{i}_extra_info", "")

                    # Update task
                    if total == 0:
                        total = 100

                    description = current[:50] if active else "Idle"

                    # Update progress bar with dynamic color
                    progress = self.worker_progresses[i]
                    task_id = self.worker_tasks[i]

                    # Update bar column style based on color
                    for column in progress.columns:
                        if isinstance(column, BarColumn):
                            if color == "green":
                                column.complete_style = "green"
                                column.finished_style = "green"
                            elif color == "purple":
                                column.complete_style = "magenta"
                                column.finished_style = "magenta"
                            else:
                                column.complete_style = color
                                column.finished_style = color

                    progress.update(
                        task_id,
                        completed=completed,
                        total=total,
                        description=description,
                        extra_info=extra_info,
                    )

                    # Update sub-progress bars for this worker
                    worker_sub_progress = dict(
                        self.shared_state.get(f"worker_{i}_sub_progress", {})
                    )
                    for sub_id, sub_data in worker_sub_progress.items():
                        sub_key = f"{i}_{sub_id}"
                        if sub_key in self.sub_tasks:
                            sub_progress, sub_task = self.sub_tasks[sub_key]

                            status = "✓" if not sub_data.get("active", True) else "⋯"
                            sub_progress.update(
                                sub_task,
                                completed=sub_data.get("completed", 0),
                                total=sub_data.get("total", 100),
                                description=f"{sub_data.get('name', 'Unknown')} {status}",
                            )

            # Rebuild display group with current sub-tasks
            progress_group = [self.main_progress]
            for i in range(self.num_workers):
                progress_group.append(self.worker_progresses[i])

                # Add sub-progress bars for this worker
                worker_sub_progress = dict(
                    self.shared_state.get(f"worker_{i}_sub_progress", {})
                )
                for sub_id in worker_sub_progress.keys():
                    sub_key = f"{i}_{sub_id}"
                    if sub_key in self.sub_tasks:
                        sub_progress, _ = self.sub_tasks[sub_key]
                        progress_group.append(sub_progress)

            # Update live display
            self.live.update(Group(*progress_group))

    def close(self):
        """Close all progress bars and stop live display."""
        if self.live:
            self.live.stop()

        # Print final summary
        with self.lock:
            completed = self.shared_state.get("total_completed", 0)
            self.console.print(
                f"\n[bold green]✓[/bold green] Completed {completed}/{self.total_configs} configurations"
            )

    def get_shared_state(self):
        """Get the shared state dictionary for passing to workers."""
        return self.shared_state

    def get_lock(self):
        """Get the lock for synchronization."""
        return self.lock
