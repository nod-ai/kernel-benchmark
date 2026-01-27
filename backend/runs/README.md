# Run Management System

The run management system is responsible for tracking benchmark and tuning workflow runs throughout their entire lifecycle. It implements a **trigger-first architecture** where all workflow runs are initiated through triggers, providing a clean, auditable way to link runs back to their initiating events.

## Architecture Overview

### Trigger-First Design

Every workflow run flows through a unified trigger system:

```
User Action → trigger_run() → GitHub Workflow → Webhook/Poll → Run Linked
```

**Key Components:**
- **`trigger_service.py`**: Single entry point for all workflow dispatches
- **`tracker.py`**: Monitors individual run progress and downloads artifacts
- **`manager.py`**: Orchestrates all active runs and handles trigger reconciliation
- **`workflows.py`**: Workflow metadata and lookup functions

## Core Concepts

### 1. Triggers (`trigger_service.py`)

All workflow runs are initiated via the unified `trigger_run()` function:

```python
from backend.runs.trigger_service import trigger_run, TriggerType

# Wave PR update
trigger_run(TriggerType.PR_UPDATE, {
    "prId": "123",
    "repoName": "iree-org/wave",
    "branchName": "feature/opt",
    "headSha": "abc123",
    "commits": 5
})

# Manual benchmark
trigger_run(TriggerType.MANUAL_BENCHMARK, {
    "tags": ["validation"],
    "machine": "mi325x"
})

# Tuning request
trigger_run(TriggerType.MANUAL_TUNING, {
    "kernelIds": ["id1", "id2"],
    "numTrials": 75
})
```

**What `trigger_run()` does:**
1. Creates a `RunTrigger` in the database (status=PENDING)
2. Determines which workflow to dispatch based on trigger type
3. Builds workflow inputs from metadata (creates gists for kernels/configs)
4. Dispatches workflow to GitHub Actions with `trigger_id`
5. Updates trigger status to DISPATCHED

### 2. Trigger Types

```python
class TriggerType(Enum):
    PR_UPDATE = "pr_update"              # Wave PR updated
    MANUAL_BENCHMARK = "manual_bench"    # Dashboard manual trigger
    MANUAL_TUNING = "manual_tuning"      # Dashboard tuning request
    SCHEDULED = "scheduled"              # Cron-based run
    REBASE = "rebase"                    # Historical backfill
```

### 3. Trigger States

```
PENDING → DISPATCHED → LINKED
   ↓          ↓           ↓
Created → Workflow  → Run Found
          Called      via Webhook
```

- **PENDING**: Trigger created, workflow not yet dispatched
- **DISPATCHED**: Workflow dispatch succeeded, waiting for run to start
- **LINKED**: Run started and linked to trigger via identifier job
- **FAILED**: Dispatch or linking failed

## Run Tracking

### RunTracker (`tracker.py`)

Tracks individual workflow runs and manages their lifecycle:

```python
class RunTracker:
    def update(self):
        """Poll GitHub for run status and update database"""
    
    def save_artifact(self):
        """Download and parse run artifacts when complete"""
    
    def is_complete(self) -> bool:
        """Check if run has finished"""
```

**Responsibilities:**
- Poll GitHub API for run status updates
- Update run steps in database
- Download artifacts when run completes
- Parse artifacts and store results

### RunManager (`manager.py`)

Orchestrates all active runs and provides redundancy:

```python
class RunManager:
    def update_runs(self):
        """Update all incomplete runs"""
    
    def reconcile_unlinked_triggers(self):
        """Find dispatched triggers missing run links (webhook backup)"""
```

**Responsibilities:**
- Load incomplete runs from database
- Update each run's status via RunTracker
- Download artifacts for completed successful runs
- **Redundancy**: Reconcile unlinked triggers when webhooks are missed

### Redundancy System

The system has two paths for linking triggers to runs:

1. **Fast Path (95% of cases)**: Webhook listener extracts `triggerId` from identifier job immediately
2. **Backup Path**: Event loop periodically checks for unlinked triggers and queries GitHub to find their runs

This ensures that even if webhook events are lost due to network issues, triggers eventually get linked.

## Workflow Integration

### Identifier Job Pattern

All workflows include an identifier job that embeds the `trigger_id`:

```yaml
jobs:
  identifier:
    name: Run Identifier
    runs-on: ubuntu-latest
    steps:
      - name: triggerId_${{ inputs.trigger_id }}
        run: echo "Trigger ID: ${{ inputs.trigger_id }}"
```

The step name format `triggerId_{id}` allows the webhook listener and event loop to extract the trigger ID and link the run.

### Workflow Metadata (`workflows.py`)

Defines metadata for supported workflows:

```python
@dataclass
class WorkflowRunInfo:
    run_type: RunType
    name: str
    filename: str
    main_job: Optional[str] = None
    identifier: Optional[str] = None

SUPPORTED_WORKFLOWS = [
    WorkflowRunInfo(
        run_type=RunType.BENCHMARK,
        name="Short Benchmark",
        filename="short_bench.yml",
        main_job="Short Benchmark",
        identifier="headSha",  # Legacy, now uses triggerId
    ),
    # ...
]
```

## Run Types

```python
class RunType(Enum):
    BENCHMARK = 0  # Short benchmark runs
    TUNING = 1     # Hyperparameter tuning
    E2E = 2        # Full end-to-end performance runs
```

## Trackers and Automated Scheduling

### Trackers (`tracker.py`)

Trackers are automated benchmark runners that execute on a configured schedule. They provide continuous performance monitoring without manual intervention.

**Key Features:**
- **Scheduled Execution**: Runs automatically based on weekly or interval schedules
- **Machine Assignment**: Each tracker is bound to a specific machine
- **Configuration Reuse**: References a stored benchmark configuration (blob)
- **Tags and Backends**: Filters benchmarks by tags and target backends

**Tracker Lifecycle:**
1. Dashboard creates tracker with schedule and configuration
2. `TrackerScheduler` monitors active trackers
3. When schedule is due, triggers run via `trigger_run(TriggerType.SCHEDULED, ...)`
4. Run executes like any manual run (same workflow, tracking, artifacts)

### Custom Run Scheduling (`scheduling/`)

The scheduling system orchestrates both automated tracker runs and manual/queued runs to ensure:
- No machine conflicts (one run per machine)
- Tracker priority (trackers get first access to machines)
- Fair queuing (FIFO for manual runs)

**Core Components:**
- **`tracker_scheduler.py`**: Triggers tracker runs when their schedule is due
- **`run_scheduler.py`**: Dispatches queued manual runs when machines are available
- **`overlap_validator.py`**: Prevents conflicting tracker schedules on the same machine
- **`scheduling_utils.py`**: Shared utilities for schedule calculations and time parsing

**Schedule Types:**
- **Weekly**: Runs on specific days of the week at a set time (e.g., "Monday, Wednesday at 10:00 UTC")
- **Interval**: Runs every N weeks/months at a set time (e.g., "every 2 weeks at 14:30 UTC")

See [`backend/runs/scheduling/README.md`](scheduling/README.md) for detailed scheduling logic and prioritization.

## Artifact Parsing

After a run completes, artifacts are automatically:
1. Downloaded from GitHub
2. Parsed based on run type (CSV for benchmarks, JSON for tuning)
3. Stored in Azure Blob Storage
4. Indexed in database with `hasArtifact=True`

**Parser Types:**
- **BenchmarkArtifactParser**: Parses CSV benchmark results
- **TuningArtifactParser**: Parses JSON tuning configurations

## Database Schema

### WorkflowRunState

```python
@dataclass
class WorkflowRunState:
    _id: str              # GitHub run ID
    type: str             # BENCHMARK, TUNING, E2E
    triggerId: str        # Foreign key to RunTrigger
    blobName: str         # Artifact storage location
    timestamp: datetime
    status: str           # queued, in_progress, completed
    conclusion: str       # success, failure, cancelled
    numSteps: int
    steps: list[dict]
    completed: bool
    hasArtifact: bool
```

### RunTrigger

See [`backend/storage/README.md`](../storage/README.md) for trigger schema details.

## Usage Examples

### Triggering a Run

```python
from backend.runs.trigger_service import trigger_run, TriggerType

# Trigger benchmark for Wave PR
trigger_id = trigger_run(TriggerType.PR_UPDATE, {
    "repoName": "iree-org/wave",
    "branchName": "feature/new-opt",
    "headSha": "abc123def",
    "commits": 3
})

if trigger_id:
    print(f"Triggered run: {trigger_id}")
```

### Monitoring Runs

```python
from backend.runs.manager import RunManager

# Create manager and update all active runs
manager = RunManager()
manager.update_runs()  # Poll GitHub and download artifacts
```

### Querying Runs

```python
from backend.runs.run_utils import find_incomplete_runs
from backend.runs import RunType

# Find all incomplete benchmark runs
incomplete = find_incomplete_runs(RunType.BENCHMARK)
```

## Key Benefits

### 1. Single Entry Point
All workflow dispatches go through `trigger_run()` - one function to maintain, test, and debug.

### 2. Complete Audit Trail
Every run has a trigger that explains:
- What caused the run (PR update, manual request, etc.)
- When it was triggered
- What configuration was used
- Full metadata about the request

### 3. Robust Redundancy
- Webhook listener handles 95%+ of cases instantly
- Event loop catches missed webhooks within 10 seconds
- Both use the same `link_trigger_to_run()` function

### 4. Clean State Management
No more "undefined" states. Every run either:
- Has a trigger (tracked properly)
- Is marked as untracked (old historical runs)

### 5. Easy Debugging
- Query: "Which trigger caused run X?" → Check `run.triggerId`
- Query: "Did trigger Y dispatch?" → Check trigger status
- Query: "Show failed dispatches" → Query triggers with status=FAILED

## Migration Notes

The system was refactored from a messy, fragmented architecture to this trigger-first design in January 2026. Historical runs were migrated using [`backend/tools/migrate_to_triggers.py`](../tools/migrate_to_triggers.py), creating synthetic REBASE triggers for all existing runs.

Key changes:
- **Before**: `mappingId` held arbitrary identifiers with no schema
- **After**: `triggerId` links to a structured `RunTrigger` with typed metadata
- **Before**: Dispatch logic scattered across 4+ files
- **After**: All dispatch logic in `trigger_service.py`
