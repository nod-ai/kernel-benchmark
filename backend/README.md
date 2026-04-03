# Backend Services

The backend is a Python-based server infrastructure that coordinates the entire microkernel benchmarking system. It provides a REST API for the dashboard, manages benchmark workflows via a trigger-first architecture, and processes GitHub webhooks for automated run tracking.

## Architecture Overview

The backend consists of three main services that work together:

### 1. **API Server** (`server.py`)
Flask-based REST API (port 3000) that serves the dashboard, manages kernel configurations, and triggers workflow runs.

### 2. **Event Loop** (`event_loop.py`)
Background service composed of three independent handlers:
- **`run_manager`**: Monitors ongoing runs, updates status, downloads artifacts, reconciles unlinked triggers (idempotent)
- **`tracker_scheduler`**: Triggers scheduled tracker runs when due (NOT idempotent)
- **`run_scheduler`**: Dispatches queued triggers to GitHub Actions when machines are available (NOT idempotent)

Supports `--handlers` and `--once` flags for selective execution during local development (see [Local Development](#local-development)).

### 3. **Webhook Listener** (`listener.py`)
Pyramid-based service (port 2500) that receives GitHub webhook events for real-time run tracking and PR monitoring.

## Trigger-First Architecture

**Every workflow run flows through a unified trigger system:**

```
User Action → trigger_run() → GitHub Workflow → Webhook/Poll → Run Linked → Artifacts
```

This provides:
- ✅ Single entry point for all workflow dispatches
- ✅ Complete audit trail (every run linked to its trigger)
- ✅ Robust redundancy (webhook + polling backup)
- ✅ Clean state management (no "undefined" states)

**Learn more:** See [Run Management README](runs/README.md) for detailed architecture.

## Directory Structure

```
backend/
├── server.py              # Flask API server (port 3000)
├── event_loop.py          # Background run monitoring
├── listener.py            # Webhook handler (port 2500)
├── globals.py             # Global constants
├── requirements.txt       # Python dependencies
│
├── runs/                  # 🔄 Run management system
│   ├── README.md         # → Detailed documentation
│   ├── trigger_service.py # Unified trigger system
│   ├── manager.py        # Run orchestration + redundancy
│   ├── tracker.py        # Individual run tracking
│   ├── workflows.py      # Workflow metadata
│   └── parsing/          # Artifact parsers
│
├── storage/              # 💾 Data persistence layer
│   ├── README.md         # → Detailed documentation
│   ├── triggers.py       # Trigger system models
│   ├── types.py          # Data models
│   ├── repository.py     # Repository pattern
│   ├── artifacts.py      # Blob storage
│   └── rebase.py         # Historical sync
│
├── webhook/              # 🎣 GitHub event handlers
│   ├── README.md         # → Detailed documentation
│   ├── workflow.py       # Run tracking webhooks
│   └── wave_update.py    # PR monitoring webhooks
│
├── github_utils/         # GitHub API integration
├── perf/                 # Performance analysis
└── tools/                # Admin utilities
    └── migrate_to_triggers.py  # Migration script
```

**📖 See subsystem READMEs for detailed documentation:**
- [runs/README.md](runs/README.md) - Run management & trigger system
- [storage/README.md](storage/README.md) - Data models & persistence
- [webhook/README.md](webhook/README.md) - Webhook event handling

## Core Features

### 🔌 REST API Endpoints

The API server provides comprehensive endpoints for dashboard operations:

#### **Authentication**
- `POST /auth/login` - Authenticate with password
- `GET /auth/verify` - Verify JWT token validity
- `POST /auth/logout` - Invalidate session

#### **Kernel Management**
- `GET /kernels` - List all kernel configurations
- `POST /kernels` - Add new kernel configurations (single or batch)
- `PUT /kernels/<id>` - Update individual kernel
- `PUT /kernels/batch` - Batch update multiple kernels
- `DELETE /kernels` - Delete multiple kernels by ID

#### **Kernel Types**
- `GET /kernel_types` - List all kernel type definitions
- `POST /kernel_types` - Create new kernel type
- `PUT /kernel_types/<id>` - Update kernel type
- `DELETE /kernel_types/<id>` - Remove kernel type

#### **Benchmark Runs**
- `GET /runs` - List all benchmark runs
- `GET /performances` - List all E2E performance runs
- `GET /artifact/<blob_name>` - Fetch artifact data for a specific run
- `POST /workflow/trigger` - Trigger new benchmark workflow
- `POST /workflow/cancel` - Cancel running workflow

#### **Tuning Operations**
- `POST /tune` - Trigger tuning workflow for selected kernels
- `GET /tune/results` - Fetch all tuning results
- `GET /tune/runs` - Get in-progress tuning runs

#### **Performance Analysis**
- `GET /change_stats` - Get all performance change statistics
- `GET /change_stats/<run_id>` - Get change stats for specific run
- `GET /pull_requests` - List tracked pull requests
- `POST /rebase` - Rebase PRs and refresh data

### 🔄 Run Management System

All workflow runs are triggered and tracked through a unified system:

```python
from backend.runs.trigger_service import trigger_run, TriggerType

# Trigger any run with one function call
trigger_id = trigger_run(TriggerType.MANUAL_BENCHMARK, {
    "tags": ["validation"],
    "machine": "mi325x"
})
```

**Run Lifecycle:**
1. **Trigger Created** → `trigger_run()` creates RunTrigger in database
2. **Workflow Dispatched** → GitHub Actions workflow starts with trigger_id
3. **Run Linked** → Webhook or event loop links run to trigger
4. **Monitoring** → Event loop tracks status and downloads artifacts
5. **Completed** → Artifacts parsed and stored

**Key Components:**
- **trigger_service.py**: Single entry point for all dispatches
- **manager.py**: Orchestrates runs + trigger reconciliation
- **tracker.py**: Monitors individual runs

**📖 Learn more:** [Run Management README](runs/README.md)

### 💾 Storage Layer

Built on **Azure Table Storage** with a type-safe repository pattern and trigger system:

**Core Models:**
- `RunTrigger` - Tracks all workflow run initiations (new!)
- `WorkflowRunState` - Run execution state (linked to triggers)
- `KernelConfig` - Kernel benchmark configurations
- `TuningConfig` - Tuning results
- `RepoPullRequest` - GitHub PR tracking

**Repository Pattern:**
```python
from backend.storage.types import KernelConfigDb

# Type-safe database operations
kernels = KernelConfigDb.find_all()
kernel = KernelConfigDb.find_by_id("some-id")
KernelConfigDb.upsert(kernel)
KernelConfigDb.upsert_many([k1, k2, k3])  # Batch ops
```

**📖 Learn more:** [Storage README](storage/README.md)

### 🪝 Webhook System

Receives GitHub webhook events for real-time tracking:

**Workflow Events (kernel-benchmark repo):**
- `workflow_run` - Track workflow lifecycle
- `workflow_job` - **Extract trigger ID and link run** (fast path)

**PR Events (Wave repo):**
- `pull_request` - Auto-trigger benchmarks on PR updates

**Redundancy:**
- Webhook listener provides instant linking (< 1 second)
- Event loop provides backup polling (every 10 seconds)
- Both use the same `link_trigger_to_run()` function

**📖 Learn more:** [Webhook README](webhook/README.md)

## Quick Start

### Prerequisites

- Python 3.12+
- Azure Storage account (Table Storage + Blob Storage)
- GitHub App credentials with workflow dispatch permissions
- Access to kernel-benchmark and Wave repositories

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env  # Then edit with your credentials

# Initialize database (creates Azure Table Storage tables)
python -c "from backend.storage.types import *; print('Tables ready')"
```

### Environment Variables

Create `.env` file:

```bash
# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=<connection-string>

# GitHub App
PEM_FILE=<private-key-file>
APP_ID=<app-id>
INSTALLATION_ID=<installation-id>

# Authentication
PASSWORD_HASH=<bcrypt-hash>
```

### Running the Services

All three services must run concurrently:

```bash
# Terminal 1: API Server (port 3000)
python -m backend.server

# Terminal 2: Event Loop (all handlers, 10s polling)
python -m backend.event_loop

# Terminal 3: Webhook Listener (port 2500)
python -m backend.listener
```

**Production**: Use `supervisor` or `systemd`:

```ini
# /etc/supervisor/conf.d/backend.conf
[program:backend-api]
command=python -m backend.server
directory=/path/to/backend
autostart=true
autorestart=true

[program:backend-eventloop]
command=python -m backend.event_loop
directory=/path/to/backend
autostart=true
autorestart=true

[program:backend-webhook]
command=python -m backend.listener
directory=/path/to/backend
autostart=true
autorestart=true
```

### Local Development

The API server (`server.py`) can safely run locally alongside production since there is no overlap. The event loop requires care because all three handlers share the same Azure Table Storage and GitHub API as the production server. Running the full event loop locally while the production loop is active can cause duplicate workflow dispatches, duplicate trigger linking, and wasted GPU time.

Use the `--handlers` and `--once` flags to run only the handlers you need:

```bash
# Safe: only run tracking/reconciliation (idempotent)
python -m backend.event_loop --handlers run_manager

# Single iteration then exit (great for debugging)
python -m backend.event_loop --handlers run_manager --once

# Test scheduling logic (will create triggers — stop production loop first)
python -m backend.event_loop --handlers tracker_scheduler --once

# See all options
python -m backend.event_loop --help
```

**Handler idempotency reference:**

| Handler | Idempotent? | Safe alongside production? |
|---|---|---|
| `run_manager` | Yes — status writes and trigger linking are idempotent | Yes |
| `tracker_scheduler` | No — creates a new trigger (fresh UUID) each time | No — causes duplicate scheduled runs |
| `run_scheduler` | Race condition — two processes can dispatch the same queued trigger | Mostly, but can double-dispatch |

**Rule of thumb:** Use `--handlers run_manager` for local testing. Only enable `tracker_scheduler` or `run_scheduler` locally if you have stopped them on the production server first.

## Configuration

### Ports

- API Server: `3000` (configurable in `server.py`)
- Webhook Listener: `2500` (configurable in `listener.py`)

### Polling Interval

Event loop polls every `10 seconds` (configured in `event_loop.py`)

### Authentication

JWT-based authentication with:
- 30-minute token expiration
- Bcrypt password hashing
- HTTP-only secure cookies

### Supported Workflows

Two workflow types (defined in `.github/workflows/`):
1. **Short Benchmark** (`short_bench.yml`) - Benchmark runs with configurable kernel selection
2. **Tune Wave Kernels** (`tune_kernels.yml`) - Hyperparameter tuning

## API Endpoints Reference

### Triggers (New!)
- `GET /api/triggers` - List all triggers (supports `?type=...&status=...&limit=...`)
- `GET /api/triggers/<trigger_id>` - Get trigger with linked run info
- `GET /api/runs/<run_id>/trigger` - Get trigger that caused a specific run

### Workflows
- `POST /workflow/trigger` - Trigger benchmark run (returns `triggerId`)
- `POST /workflow/cancel` - Cancel running workflow
- `POST /tune` - Trigger tuning run (returns `triggerId`)

### Runs
- `GET /runs` - List benchmark runs
- `GET /performances` - List E2E performance runs
- `GET /api/runs` - Paginated runs (supports filters)
- `DELETE /api/runs/<run_id>` - Delete run and artifacts

### Kernels
- `GET /kernels` - List all kernel configs
- `POST /kernels` - Add kernel(s)
- `PUT /kernels/<id>` - Update kernel
- `PUT /kernels/batch` - Batch update
- `DELETE /kernels` - Delete kernels by IDs

### Analysis
- `GET /change_stats` - Performance comparison stats
- `GET /pull_requests` - Tracked PRs
- `POST /rebase` - Sync historical data

## API Usage Examples

### Trigger a Benchmark Run

```python
import requests

response = requests.post('http://localhost:3000/workflow/trigger', json={
    "pr": {
        "repoName": "iree-org/wave",
        "branchName": "feature/opt",
        "mappingId": "abc123"  # head SHA
    },
    "config": {
        "machine": "mi325x",
        "kernelSelection": {
            "type": "specific-tags",
            "tags": ["validation"]
        }
    }
})

# Response: {"triggerId": "abc-123-def", "message": "Success"}
```

### Trigger Tuning

```python
response = requests.post('http://localhost:3000/tune', json={
    "kernel_ids": ["id1", "id2"],
    "numTrials": 75
})

# Response: {"triggerId": "xyz-789-abc", "message": "Success"}
```

### Query Triggers

```python
# Get all triggers
triggers = requests.get('http://localhost:3000/api/triggers')

# Get specific trigger with linked run
trigger = requests.get('http://localhost:3000/api/triggers/abc-123-def')

# Get trigger that caused a run
trigger = requests.get('http://localhost:3000/api/runs/456789/trigger')
```

### Manage Kernels

```python
# Add kernels (single or batch)
response = requests.post('http://localhost:3000/kernels', json={
    "name": "gemm_1024x1024x1024_f16",
    "kernelType": "gemm",
    "tag": "validation",
    "machines": ["mi325x"],
    "workflow": "all",
    "problem": {"M": 1024, "N": 1024, "K": 1024, "dtype": "f16"}
})

# Query runs
runs = requests.get('http://localhost:3000/runs')
```

## Monitoring & Debugging

### Check Trigger Status

```bash
# Run migration verification
python -m backend.tools.migrate_to_triggers --verify

# Check for failed dispatches
curl http://localhost:3000/api/triggers?status=failed

# Check for unlinked triggers (webhook issues)
curl http://localhost:3000/api/triggers?status=dispatched
```

### View Run Progress

```bash
# Get all runs
curl http://localhost:3000/runs

# Get runs with pagination
curl "http://localhost:3000/api/runs?page=1&page_size=20"

# Get trigger for specific run
curl http://localhost:3000/api/runs/123456/trigger
```

### Performance Analysis

The backend automatically calculates performance changes:
- Speedup/slowdown per kernel
- Aggregate performance shifts
- Cross-backend comparisons (Wave vs IREE vs PyTorch)

Access via:
- `GET /change_stats` - All statistics
- `GET /change_stats/<run_id>` - Run-specific stats

## Troubleshooting

### Trigger Not Linking to Run

**Symptoms**: Trigger stuck in DISPATCHED status

**Causes**:
- Webhook missed (network issue)
- Identifier job failed
- Step name format incorrect

**Solution**:
- Event loop automatically reconciles within 10-20 seconds
- Check GitHub workflow logs for identifier job
- Verify workflow YML uses `triggerId_${{ inputs.trigger_id }}`

### Webhook Not Received

**Check**:
1. GitHub webhook delivery status (repo settings → Webhooks)
2. Webhook listener is running on port 2500
3. Firewall allows incoming connections

**Backup**: Event loop provides redundancy - triggers will link automatically

### Database Connection Issues

```bash
# Test Azure Storage connection
python -c "from backend.storage.auth import get_blob_client; get_blob_client()"

# Test GitHub API access
python -c "from backend.github_utils import get_repo; print(get_repo('bench'))"
```

### Artifact Download Failed

- Verify workflow completed successfully (status=completed, conclusion=success)
- Check Azure Storage permissions
- Ensure artifact exists in GitHub Actions run

## Development Guide

### Adding New Trigger Types

```python
# 1. Add to TriggerType enum in storage/triggers.py
class TriggerType(Enum):
    YOUR_TYPE = "your_type"

# 2. Add handling in trigger_service.py
def _determine_workflow(trigger_type, metadata):
    if trigger_type == TriggerType.YOUR_TYPE:
        return "your_workflow.yml"

def _build_workflow_inputs(trigger_type, metadata, trigger_id):
    if trigger_type == TriggerType.YOUR_TYPE:
        return {"your_input": metadata["your_field"]}
```

### Adding New Database Models

```python
# 1. Define in storage/types.py
@dataclass
class YourModel:
    _id: str
    field1: str
    field2: int

# 2. Create repository
YourModelDb = create_repository(YourModel, "tablename")

# 3. Use in code
items = YourModelDb.find_all()
YourModelDb.upsert(item)
```

### Adding API Endpoints

```python
@app.route("/your-endpoint", methods=["GET"])
def your_endpoint():
    data = YourModelDb.find_all()
    return jsonify([asdict(item) for item in data])
```

## Architecture Benefits

### Simplicity
- **One function** for all workflow dispatches: `trigger_run()`
- **Clear data flow**: Trigger → Dispatch → Link → Artifact
- **Single source of truth**: Every run has a trigger

### Reliability
- **Dual-path tracking**: Webhook (fast) + Polling (backup)
- **Automatic reconciliation**: Missed webhooks handled within 10-20s
- **Idempotent linking**: Safe to link multiple times

### Auditability
- **Complete history**: Every trigger stored permanently
- **Type-safe metadata**: Structured data for each trigger type
- **Query anywhere**: "What triggered run X?" → Check `run.triggerId`

### Flexibility
- **Easy to extend**: Add new trigger types without touching core logic
- **Type-specific metadata**: Each trigger type stores what it needs
- **Future-proof**: Can add trigger retries, scheduling, batching, etc.

## Migration History

The backend was refactored in **January 2026** from a messy, fragmented architecture to this clean trigger-first design:

**Before**:
- Dispatch logic scattered across 4+ files
- `mappingId` held arbitrary identifiers with no schema
- Webhook loss = permanent data loss
- Difficult to debug "why did this run start?"

**After**:
- All dispatch logic in `trigger_service.py`
- Structured `RunTrigger` with typed metadata
- Webhook loss handled automatically by event loop
- Complete audit trail: trigger → run relationship

**Migration tool**: `tools/migrate_to_triggers.py` created synthetic triggers for all historical runs.

## Related Documentation

- **Subsystems**:
  - [Run Management](runs/README.md) - Detailed trigger system docs
  - [Storage Layer](storage/README.md) - Data models & persistence
  - [Webhook System](webhook/README.md) - Event handling
- **Project**:
  - [Main README](../README.md) - Full project overview
  - [Benchmark Infrastructure](../benchmark/README.md)
  - [Dashboard](../dashboard/README.md)

## Contributing

Follow these patterns:
1. Use `trigger_run()` for all workflow dispatches
2. Add type hints to all functions
3. Use dataclasses for structured data
4. Leverage repository pattern for database
5. Document trigger metadata schemas

## Contact

Questions or issues:
- Open GitHub issue
- Contact: Surya Jasper
