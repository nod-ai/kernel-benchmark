# Storage Layer

The storage layer provides a type-safe abstraction over Azure Table Storage for all backend data persistence. It implements a repository pattern with full type safety and includes the trigger system that powers the run tracking architecture.

## Architecture Overview

### Repository Pattern

All database access goes through typed repositories created via `create_repository()`:

```python
from backend.storage.types import KernelConfig
from backend.storage.repository import create_repository

KernelConfigDb = create_repository(KernelConfig, "kernelconfigs")

# Now use type-safe operations
kernels = KernelConfigDb.find_all()
kernel = KernelConfigDb.find_by_id("some-id")
KernelConfigDb.upsert(kernel)
```

### Directory Structure

```
storage/
├── types.py          # Data models and repository definitions
├── triggers.py       # Trigger system (core of run tracking)
├── repository.py     # Generic repository implementation
├── auth.py          # Azure Storage authentication
├── artifacts.py     # Artifact storage management
├── conversion.py    # Data conversion utilities
├── rebase.py        # Historical data synchronization
└── utils.py         # Storage utilities
```

## Core Components

### 1. Data Models (`types.py`)

All data models are Python dataclasses with type hints:

```python
@dataclass
class KernelConfig:
    _id: str
    name: str
    kernelType: str
    tag: str
    machines: list[str]
    workflow: Literal["none", "e2e", "all"]
    problem: dict[str, Any]

@dataclass
class WorkflowRunState:
    _id: str
    type: str
    triggerId: Optional[str]  # Links to RunTrigger
    blobName: str
    timestamp: datetime
    status: str
    conclusion: str
    numSteps: int
    steps: list[dict]
    completed: bool
    hasArtifact: bool
```

### 2. Trigger System (`triggers.py`)

The trigger system is the heart of run tracking. Every workflow run is initiated through a trigger.

#### RunTrigger Schema

```python
@dataclass
class RunTrigger:
    _id: str                      # Unique trigger ID (UUID)
    type: str                     # TriggerType enum value
    status: str                   # TriggerStatus enum value
    timestamp: datetime           # When trigger was created
    metadata: dict[str, Any]      # Type-specific metadata
    
    # Set after workflow dispatch
    dispatchedAt: Optional[datetime] = None
    
    # Set after run is linked
    runId: Optional[str] = None
    linkedAt: Optional[datetime] = None
    
    # Optional error information
    error: Optional[str] = None
```

#### Trigger Types

```python
class TriggerType(Enum):
    PR_UPDATE = "pr_update"              # Wave PR updated
    MANUAL_BENCHMARK = "manual_bench"    # Dashboard manual trigger
    MANUAL_TUNING = "manual_tuning"      # Dashboard tuning request
    SCHEDULED = "scheduled"              # Cron-based run
    REBASE = "rebase"                    # Historical backfill
```

#### Trigger Status Lifecycle

```
PENDING → DISPATCHED → LINKED
   ↓          ↓           ↓
Created → Workflow  → Run Found
          Called      via Webhook
```

#### Trigger Metadata Examples

Different trigger types store different metadata:

```python
# PR_UPDATE trigger
{
    "prId": "123",
    "repoName": "iree-org/wave",
    "branchName": "feature/opt",
    "headSha": "abc123",
    "commits": 5
}

# MANUAL_BENCHMARK trigger
{
    "tags": ["validation", "regression"],
    "machine": "mi325x",
    "repoName": "iree-org/wave",  # Optional
    "branchName": "main",         # Optional
    "headSha": "def456"          # Optional
}

# MANUAL_TUNING trigger
{
    "kernelIds": ["id1", "id2", "id3"],
    "numTrials": 75,
    "backend": "wave"
}
```

### 3. Repository Operations (`repository.py`)

The repository pattern provides consistent, type-safe database operations:

#### Basic Operations

```python
# Find operations
item = Repository.find_by_id("some-id")
all_items = Repository.find_all()
filtered = Repository.find_all({"field": "value"})

# Query with OData syntax
results = Repository.query("status eq 'active' and type eq 'benchmark'")

# Create/Update
Repository.upsert(item)  # Insert or update
Repository.upsert_many([item1, item2, item3])

# Update specific fields
Repository.update_by_id("some-id", {"field": "new_value"})
Repository.update_many([{"_id": "id1", "field": "val1"}, ...])

# Delete
Repository.delete_by_id("some-id")
Repository.delete_many_by_ids(["id1", "id2", "id3"])
```

#### Batch Operations

Azure Table Storage supports batch transactions (up to 100 operations):

```python
# Batch upsert
KernelConfigDb.upsert_many(kernels)  # Up to 100 kernels

# Batch update
updates = [
    {"_id": "id1", "status": "active"},
    {"_id": "id2", "status": "active"}
]
KernelConfigDb.update_many(updates)
```

### 4. Artifacts (`artifacts.py`)

Manages artifact storage in Azure Blob Storage:

```python
from backend.storage.artifacts import download_artifact

# Download artifact from GitHub to local path
local_path = download_artifact(gh_artifact, local_tmp_dir)

# Artifacts are then parsed and uploaded to Azure Blob Storage
# Storage path: /{blob_name}/benchmark-results/...
```

### 5. Rebase (`rebase.py`)

Synchronizes historical data from GitHub to the database:

```python
from backend.storage.rebase import rebase_runs, rebase_pull_requests

# Sync recent completed runs from GitHub
rebase_runs(limit=10)

# Sync recent pull requests from Wave repo
rebase_pull_requests(limit=40)
```

**What rebase does:**
1. Queries GitHub for recent completed runs
2. Creates `WorkflowRunState` if not in database
3. Creates REBASE trigger for runs without triggers
4. Downloads and parses artifacts if missing

## Database Tables

All tables are in Azure Table Storage:

| Table Name | Model | Purpose |
|------------|-------|---------|
| `runtriggers` | RunTrigger | Tracks all workflow run triggers |
| `workflowrunstates2` | WorkflowRunState | Stores workflow run data |
| `kernelconfigs` | KernelConfig | Kernel benchmark configurations |
| `kerneltypes` | KernelTypeDefinition | Kernel type schemas |
| `tuningconfigsnew3` | TuningConfig | Tuning results and configurations |
| `repopullrequests` | RepoPullRequest | GitHub PR tracking |
| `benchchangestats` | BenchChangeStats | Performance comparison stats |
| `trackers2` | Tracker | Scheduled benchmark trackers |

## Key Relationships

```
RunTrigger ──1:1──> WorkflowRunState
    ↓                      ↓
  metadata            blobName → Azure Blob Storage
    
KernelConfig ──many:many──> WorkflowRunState
    (via trigger metadata)

RepoPullRequest ──1:many──> RunTrigger
    (prId matches trigger metadata)
```

## Usage Examples

### Creating a Trigger

```python
from backend.storage.triggers import RunTrigger, RunTriggerDb, TriggerType, TriggerStatus
from datetime import datetime, timezone
from uuid import uuid4

trigger = RunTrigger(
    _id=str(uuid4()),
    type=TriggerType.MANUAL_BENCHMARK.value,
    status=TriggerStatus.PENDING.value,
    timestamp=datetime.now(timezone.utc),
    metadata={
        "tags": ["validation"],
        "machine": "mi325x"
    }
)

RunTriggerDb.upsert(trigger)
```

### Linking a Trigger to a Run

```python
from backend.storage.triggers import link_trigger_to_run

# Called by webhook listener or event loop
success = link_trigger_to_run(trigger_id="abc-123", run_id="456789")

if success:
    # Trigger status is now LINKED
    # trigger.runId is set to "456789"
    # trigger.linkedAt is set to current time
```

### Querying Runs by Trigger

```python
from backend.storage.types import WorkflowRunDb
from backend.storage.triggers import RunTriggerDb

# Get run
run = WorkflowRunDb.find_by_id("run-id")

# Get its trigger
if run.triggerId:
    trigger = RunTriggerDb.find_by_id(run.triggerId)
    print(f"Run was triggered by: {trigger.type}")
    print(f"Trigger metadata: {trigger.metadata}")
```

### Finding Unlinked Triggers

```python
from backend.storage.triggers import RunTriggerDb, TriggerStatus

# Find triggers that were dispatched but not linked yet
unlinked = RunTriggerDb.query(
    f"status eq '{TriggerStatus.DISPATCHED.value}'"
)

for trigger in unlinked:
    # Try to find matching run via GitHub API
    # This is the backup path when webhooks are missed
    pass
```

## Authentication

Azure Storage authentication is handled in `auth.py`:

```python
from backend.storage.auth import get_blob_client

# Get Azure Blob Service Client
blob_client = get_blob_client()

# Operations
blob_client.upload("path", data)
blob_client.download("blob_name", "local_path")
blob_client.ls("directory/")
blob_client.rm("blob_name")
```

## Data Conversion

`conversion.py` provides utilities for converting between formats:

```python
from backend.storage.conversion import parse_pr_obj

# Convert GitHub PR API response to RepoPullRequest
pr_dict = github_pr.raw_data
pr = parse_pr_obj(pr_dict)
RepoPullRequestDb.upsert(pr)
```

## Migration Notes

The storage layer was refactored in January 2026 to support the trigger-first architecture:

- **Added**: `RunTrigger` model and `runtriggers` table
- **Modified**: `WorkflowRunState` now has `triggerId` (replaced `mappingId`)
- **Migration**: All historical runs migrated via `tools/migrate_to_triggers.py`

The old `mappingId` field may still exist in Azure Table Storage for historical records, but it's ignored by the code (not in the dataclass definition).

## Best Practices

1. **Always use repositories**: Don't access Azure Storage directly
2. **Type safety**: Let TypeScript/Python type hints catch errors early
3. **Batch operations**: Use `upsert_many()` for multiple items
4. **Query optimization**: Filter at the database level with OData queries
5. **Trigger linking**: Always create a trigger before dispatching workflows
6. **Error handling**: Check return values from repository operations
