# Run Scheduling System

The scheduling system manages the execution of both automated tracker runs and manually queued runs. It ensures that:
1. **Only one run executes per machine at a time** (no resource conflicts)
2. **Tracker-scheduled runs have priority** over manual/queued runs
3. **Queued runs are dispatched fairly** in FIFO order when machines are available

## Architecture Overview

The scheduler consists of two parallel systems that coordinate through shared utilities:

```
┌─────────────────────┐         ┌─────────────────────┐
│  TrackerScheduler   │         │   RunScheduler      │
│  (automated runs)   │         │  (manual/queued)    │
└──────────┬──────────┘         └──────────┬──────────┘
           │                               │
           │  Checks schedules             │  Checks queue
           │  Triggers when due            │  Dispatches when safe
           │                               │
           └───────────┬───────────────────┘
                       │
                       ▼
           ┌───────────────────────┐
           │  SchedulingUtils      │
           │  • Time calculations  │
           │  • Machine queries    │
           │  • Conflict checking  │
           └───────────────────────┘
```

## Core Components

### 1. TrackerScheduler (`tracker_scheduler.py`)

**Purpose:** Monitors active trackers and automatically triggers runs when their schedule is due.

**How it Works:**
1. Every event loop cycle (typically every 10 seconds), checks all active trackers
2. For each tracker, calculates if it's due to run now using `is_tracker_due_now()`
3. If due and not recently triggered, calls `trigger_run(TriggerType.SCHEDULED, ...)`
4. Tracks last trigger time to prevent duplicate runs within grace window

**Schedule Grace Window:**
- **2 minutes** - Trackers are considered "due" if their scheduled time is within 2 minutes
- Prevents missing runs due to slight timing variations in event loop
- Example: Tracker scheduled at 10:00 UTC will trigger between 10:00 and 10:02

**Deduplication:**
- Maintains in-memory `_last_triggered` dict to prevent duplicate triggers
- Won't retrigger same tracker within grace window even if schedule still matches

### 2. RunScheduler (`run_scheduler.py`)

**Purpose:** Manages the queue of manual/requested runs and dispatches them when machines are available.

**How it Works:**
1. Every event loop cycle, queries all triggers with `status=QUEUED`
2. Sorts triggers by timestamp (oldest first - FIFO)
3. For each queued trigger, checks if it can dispatch safely:
   - No active runs on the same machine
   - No trackers scheduled within the next hour (tracker priority)
4. If safe, dispatches trigger to GitHub Actions workflow
5. Updates trigger status from `QUEUED` → `DISPATCHED`

**FIFO Queue Processing:**
- Queued runs are processed in the order they were created
- Oldest triggers get priority when multiple are waiting for the same machine
- Ensures fairness for manual runs

**Machine Availability Check:**
```python
# Check for active runs on this machine (using 24h window)
active_runs = get_active_runs_by_machine(trigger.machine, cutoff_hours=24)
if active_runs:
    return False  # Cannot dispatch yet

# Check for dispatched triggers (GitHub pending, using 24h window)
dispatched_triggers = get_dispatched_triggers_by_machine(trigger.machine, cutoff_hours=24)
if dispatched_triggers:
    return False  # GitHub is waiting to start a run
```

**Tracker Priority Enforcement:**
```python
# Block queued runs 1 hour before scheduled trackers
upcoming_trackers = get_upcoming_trackers(trigger.machine, hours_ahead=1.0)
if upcoming_trackers:
    return False  # Tracker has priority
```

### 3. OverlapValidator (`overlap_validator.py`)

**Purpose:** Validates that tracker schedules don't conflict on the same machine.

**How it Works:**
1. Called when creating or updating a tracker
2. Extracts all time slots from the tracker's schedule
3. Queries all other active trackers on the same machine
4. Checks if any time slots conflict within 2-hour grace period
5. Returns validation result with user-friendly error message if conflict found

**Conflict Detection:**

- **Weekly vs Weekly:** Must be different days OR times separated by 2+ hours
  ```
  Tracker A: Monday at 10:00 UTC
  Tracker B: Monday at 11:00 UTC  ← CONFLICT (within 2-hour window)
  Tracker C: Tuesday at 10:00 UTC ✓ OK (different day)
  ```

- **Interval vs Interval:** Conflicts if intervals align and times overlap
  ```
  Tracker A: Every 2 weeks at 10:00 UTC
  Tracker B: Every 2 weeks at 11:00 UTC  ← CONFLICT (same cycle, close time)
  Tracker C: Every 3 weeks at 10:00 UTC  ✓ OK (different cycle)
  ```

- **Weekly vs Interval:** Conservative - conflicts if times overlap
  ```
  Tracker A: Monday at 10:00 UTC
  Tracker B: Every 1 week at 11:00 UTC  ← CONFLICT (could fall on Monday)
  ```

**Grace Period:**
- **2 hours** - Trackers within 2 hours of each other are considered conflicting
- Accounts for run duration variance and provides buffer for machine cleanup
- Configurable via `OVERLAP_GRACE_HOURS` constant

### 4. SchedulingUtils (`scheduling_utils.py`)

**Purpose:** Shared utilities for schedule calculations, time parsing, and machine queries.

**Key Functions:**

#### Schedule Calculations

**`calculate_next_run_time(tracker, from_time)`**
- Calculates when a tracker will next run after a given time
- Handles both weekly and interval schedules
- Respects schedule start/end dates
- Returns `None` if schedule has ended or is invalid

**`is_tracker_due_now(tracker, now, grace_minutes=2)`**
- Checks if tracker should run right now (within grace window)
- Used by `TrackerScheduler` to trigger runs
- Returns `True` if next run is within `[now, now + grace_minutes)`

**`is_tracker_due_within(tracker, from_time, hours_ahead)`**
- Checks if tracker will run within specified time window
- Used by `RunScheduler` to check for upcoming tracker runs
- Returns `True` if next run is within `[from_time, from_time + hours_ahead]`

#### Time Utilities

**`parse_schedule_date(date_str)` / `parse_schedule_time(time_str)`**
- Parses MM-DD-YYYY and HH:MM formats to datetime/tuple
- Ensures consistent UTC timezone handling

**`time_to_minutes(hour, minute)`**
- Converts time to minutes since midnight (0-1439)
- Used for time difference calculations

**`normalize_day_name(day)`**
- Normalizes day names (handles "Mon", "monday", "MONDAY" → "Monday")
- Ensures consistent day matching across schedules

#### Machine and Tracker Queries

**`get_active_runs_by_machine(machine, cutoff_hours=None)`**
- Returns all in-progress runs on a specific machine via LINKED triggers
- Queries RunTriggers with status=LINKED, then fetches corresponding WorkflowRunStates
- Filters for active statuses: `requested`, `in_progress`, `queued`, `pending`
- Optional `cutoff_hours` parameter limits lookback window (e.g., 24 hours)

**`get_dispatched_triggers_by_machine(machine, cutoff_hours=None)`**
- Returns all DISPATCHED triggers (GitHub-pending runs) on a specific machine
- These represent workflow runs dispatched to GitHub but not yet started
- Optional `cutoff_hours` parameter limits lookback window (e.g., 24 hours)
- Critical for preventing GitHub from cancelling runs (GitHub won't queue more than 1 run)

**`get_upcoming_trackers(machine, hours_ahead=1.0)`**
- Returns trackers scheduled to run within time window on machine
- Uses `is_tracker_due_within()` to check each active tracker

## Prioritization Logic

### Priority Hierarchy

1. **Tracker-Scheduled Runs** (highest priority)
   - Automatically triggered at scheduled time
   - Block queued runs 1 hour before scheduled time
   - Always get immediate machine access when due

2. **Manual/Queued Runs** (lower priority)
   - Wait for machine availability
   - Blocked by upcoming tracker runs (within 1 hour)
   - Processed in FIFO order among themselves

### Why Tracker Priority?

Trackers represent **committed monitoring schedules** that users rely on for:
- Continuous performance regression detection
- Historical trend analysis at consistent intervals
- Automated baseline validation

Manual runs are **ad-hoc requests** that can tolerate slight delays. Giving trackers priority ensures:
- Predictable execution times (critical for time-series analysis)
- No gaps in monitoring data
- Reliable automated testing

## Schedule Configuration

### Weekly Schedule Example

```python
{
    "isInterval": False,
    "daysOfWeek": ["Monday", "Wednesday", "Friday"],
    "timeOfDay": "10:00",  # UTC
    "startDate": "01-15-2026",
    "endDate": "06-30-2026"  # Optional
}
```

**Behavior:**
- Runs every Monday, Wednesday, and Friday at 10:00 UTC
- Starts from January 15, 2026
- Ends after June 30, 2026 (won't run on 07-02-2026)

### Interval Schedule Example

```python
{
    "isInterval": True,
    "intervalValue": 2,
    "intervalUnit": "weeks",  # or "months"
    "timeOfDay": "14:30",  # UTC
    "startDate": "01-01-2026",
    "endDate": None  # Runs indefinitely
}
```

**Behavior:**
- Runs every 2 weeks starting from January 1, 2026
- First run: 01-01-2026 at 14:30 UTC
- Second run: 01-15-2026 at 14:30 UTC (14 days later)
- Third run: 01-29-2026 at 14:30 UTC (14 days later)
- Continues indefinitely (no end date)

## Integration with Trigger System

Both schedulers integrate with the unified trigger system:

### TrackerScheduler Trigger Flow

```python
# When tracker is due, create trigger
metadata = {
    "name": f"{tracker.name} (Scheduled): {formatted_time}",
    "trackerId": tracker._id,
    "trackerName": tracker.name,
    "tags": tracker.tags,
    "backends": tracker.backends,
    "machine": tracker.machine,
    "blobName": tracker.blobName,
}

trigger_id = trigger_run(TriggerType.SCHEDULED, metadata)
```

- Creates `RunTrigger` with type=SCHEDULED
- Metadata includes tracker reference and configuration
- `trigger_run()` immediately dispatches to GitHub Actions
- No queuing for tracker runs (immediate execution)

### RunScheduler Dispatch Flow

```python
# When queued trigger can dispatch
trigger_type = TriggerType(trigger.type)  # MANUAL_BENCHMARK, MANUAL_TUNING, etc.
workflow_file = _determine_workflow(trigger_type, trigger.metadata)
inputs = _build_workflow_inputs(trigger_type, trigger.metadata, trigger._id)

success = trigger_workflow_dispatch(
    repo_id="bench",
    branch_name=BENCH_REPO_BRANCH,
    workflow_id=workflow_file,
    inputs=inputs,
)

# Update trigger status: QUEUED → DISPATCHED
RunTriggerDb.update_by_id(trigger._id, {
    "status": TriggerStatus.DISPATCHED.value,
    "dispatchedAt": datetime.now(timezone.utc),
})
```

- Takes existing `RunTrigger` with status=QUEUED
- Reuses workflow determination logic from `trigger_service`
- Updates status to DISPATCHED on success
- Trigger then links to run via webhook/polling (same as other triggers)

## State Machine

### Tracker-Scheduled Run States

```
Active Tracker → Due Now → trigger_run() → PENDING → DISPATCHED → LINKED → Run Tracking
    ↑               ↑                          ↓           ↓           ↓
    │          Check every                Workflow    Workflow   Webhook
    │          event loop               Created      Started     Links
    │                                                              ↓
    └──────────────────────────────────────────────────────── Update/Complete
```

### Manual/Queued Run States

```
User Request → trigger_run() → QUEUED ──→ Scheduler ──→ DISPATCHED → LINKED → Run Tracking
                                   ↑         Checks         ↓           ↓           ↓
                                   │         Machines   Workflow   Webhook      Update/
                                   │         Trackers    Starts     Links      Complete
                                   │            ↓
                                   └─────── [WAIT] ←─────┘
                                      (if machine busy or
                                       tracker scheduled)
```

## Configuration Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `SCHEDULE_GRACE_WINDOW_MINUTES` | 2 | Time window for triggering due trackers |
| `TRACKER_GRACE_HOURS` | 1.0 | How far ahead to block queued runs for trackers |
| `OVERLAP_GRACE_HOURS` | 2.0 | Minimum time between tracker schedules on same machine |
| `ACTIVE_RUN_STATUSES` | `["requested", "in_progress", "queued", "pending"]` | Run statuses that occupy a machine |

## Error Handling

### Invalid Schedule Format
- Caught during `calculate_next_run_time()` parsing
- Logged as warning, tracker skipped for that cycle
- Doesn't crash scheduler - continues with other trackers

### Missed Schedule Window
- If event loop is delayed, grace window ensures catch-up
- Duplicate prevention via `_last_triggered` dict
- Only triggers once per schedule occurrence

### Workflow Dispatch Failure
- Updates trigger status to FAILED with error message
- Queued triggers remain in queue for retry on next cycle
- Tracker runs log error but don't retry automatically (waits for next scheduled time)

### Machine Query Errors
- Returns empty lists on database query failures
- Logged as errors but doesn't block scheduler
- Defaults to safe behavior (assume machine unavailable)

## Usage Examples

### Checking if Tracker is Due

```python
from datetime import datetime, timezone
from backend.runs.scheduling.scheduling_utils import is_tracker_due_now

tracker = TrackerDb.find_by_id("tracker_123")
now = datetime.now(timezone.utc)

if is_tracker_due_now(tracker, now, grace_minutes=2):
    print("Tracker should run now!")
```

### Validating Tracker Schedule

```python
from backend.runs.scheduling.overlap_validator import validate_tracker_no_overlap

# When creating new tracker
is_valid, error_msg = validate_tracker_no_overlap(new_tracker)
if not is_valid:
    raise ValueError(error_msg)

# When updating existing tracker
is_valid, error_msg = validate_tracker_no_overlap(updated_tracker, tracker_id="tracker_123")
```

### Checking Machine Availability

```python
from backend.runs.scheduling.scheduling_utils import (
    get_active_runs_by_machine,
    get_dispatched_triggers_by_machine,
    get_upcoming_trackers,
)

machine = "mi325x"

# Check if machine has active runs (all time)
active_runs = get_active_runs_by_machine(machine)
if active_runs:
    print(f"Machine busy with {len(active_runs)} run(s)")

# Check if machine has active runs (last 24 hours only)
recent_active = get_active_runs_by_machine(machine, cutoff_hours=24)
if recent_active:
    print(f"Machine has {len(recent_active)} active run(s) from last 24h")

# Check if machine has dispatched triggers pending in GitHub
dispatched = get_dispatched_triggers_by_machine(machine, cutoff_hours=24)
if dispatched:
    print(f"Machine has {len(dispatched)} pending dispatch(es) in GitHub")

# Check if trackers scheduled soon
upcoming = get_upcoming_trackers(machine, hours_ahead=1.0)
if upcoming:
    print(f"{len(upcoming)} tracker(s) scheduled within 1 hour")
```

## Testing Considerations

### Local Development with `--handlers`

The event loop supports selective handler execution to avoid conflicts with the production event loop. Both instances share the same Azure Table Storage and GitHub API, so running all handlers locally alongside production will cause duplicate dispatches and wasted resources.

```bash
# Safe: only run_manager (idempotent — status updates + trigger reconciliation)
python -m backend.event_loop --handlers run_manager

# Single iteration for debugging
python -m backend.event_loop --handlers run_manager --once

# Test scheduling logic only (stop production loop first!)
python -m backend.event_loop --handlers tracker_scheduler run_scheduler --once
```

**Handler idempotency:**

| Handler | Idempotent? | Why |
|---|---|---|
| `run_manager` | Yes | Status writes overwrite with same data; `link_trigger_to_run` is a no-op if already linked; `_ensure_workflow_run_exists` checks before creating |
| `tracker_scheduler` | No | Creates a new `RunTrigger` with a fresh UUID each invocation; in-memory dedup (`_last_triggered`) is per-process |
| `run_scheduler` | Race condition | Two processes can query the same `QUEUED` trigger before either flips it to `DISPATCHED`, causing a double-dispatch |

**Rule of thumb:** Use `--handlers run_manager` for local testing. Only enable `tracker_scheduler` or `run_scheduler` locally after stopping them on production.

### General Testing Guidelines

When testing the scheduler:

1. **Time-based tests:** Use fixed datetimes instead of `datetime.now()` to avoid flaky tests
2. **Grace windows:** Account for grace periods when asserting trigger timing
3. **FIFO order:** Verify oldest queued triggers dispatch first
4. **Tracker priority:** Ensure queued runs block when tracker scheduled within 1 hour
5. **Deduplication:** Check that trackers don't trigger multiple times within grace window

## Future Enhancements

Potential improvements to the scheduling system:

- **Priority levels for manual runs:** Allow urgent runs to jump the queue
- **Reservation system:** Let users reserve machine time slots in advance
- **Estimated run duration:** Use historical data to predict when machines will be free
- **Multi-machine trackers:** Support trackers that test across multiple machines
- **Schedule templates:** Predefined schedule patterns (nightly, weekly, monthly)
- **Scheduler dashboard:** Real-time view of queue status and upcoming schedules
