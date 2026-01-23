# Backend Services

The backend is a Python-based server infrastructure that coordinates the entire microkernel benchmarking system. It provides a REST API for the dashboard, manages benchmark workflows, processes GitHub webhooks, and handles data persistence.

## Architecture Overview

The backend consists of three main services that work together to orchestrate the benchmarking infrastructure:

### 1. **API Server** (`server.py`)
Flask-based REST API that serves the dashboard and manages kernel configurations.

### 2. **Event Loop** (`event_loop.py`)
Background service that monitors ongoing benchmark runs and processes artifacts.

### 3. **Webhook Listener** (`listener.py`)
Pyramid-based service that receives GitHub webhook events for automated workflows.

## Directory Structure

```
backend/
├── server.py              # Main Flask API server
├── event_loop.py          # Background task processor
├── listener.py            # GitHub webhook handler
├── globals.py             # Global constants and configuration
├── requirements.txt       # Python dependencies
├── runs/                  # Run management and tracking
│   ├── manager.py        # Orchestrates run lifecycle
│   ├── tracker.py        # Individual run tracking
│   ├── workflows.py      # GitHub Actions integration
│   ├── run_utils.py      # Run utility functions
│   └── parsing/          # Result artifact parsing
│       ├── bench_parser.py
│       ├── tuning_parser.py
│       └── artifact_parsing.py
├── storage/              # Data persistence layer
│   ├── repository.py     # Generic database repository
│   ├── types.py          # Data models and type definitions
│   ├── auth.py           # Azure Storage authentication
│   ├── artifacts.py      # Artifact storage management
│   ├── directory.py      # File system operations
│   ├── conversion.py     # Data format conversions
│   ├── rebase.py         # PR rebasing logic
│   └── utils.py          # Storage utilities
├── webhook/              # GitHub webhook handlers
│   ├── workflow.py       # Workflow event processing
│   └── wave_update.py    # Wave-specific PR updates
├── github_utils/         # GitHub API integration
│   ├── actions.py        # GitHub Actions API
│   ├── auth.py           # GitHub authentication
│   └── gist.py           # Gist management
├── perf/                 # Performance analysis
│   └── comparisons.py    # Cross-run comparisons
└── tools/                # Administrative utilities
    ├── clear_db.py       # Database cleanup
    ├── upload_results_to_dashboard.py
    └── convert_hipblaslt_to_json.py
```

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

The run management system tracks the entire lifecycle of benchmark and tuning runs:

**Run Lifecycle:**
1. **Requested** → Run is created via API or webhook
2. **In Progress** → Event loop monitors status and steps
3. **Completed** → Artifacts are downloaded and parsed
4. **Archived** → Data is persisted to database

**Key Components:**
- **RunManager** (`runs/manager.py`): Orchestrates all active runs
- **RunTracker** (`runs/tracker.py`): Tracks individual run progress
- **ArtifactParser** (`runs/parsing/`): Extracts performance data

The event loop updates runs every 10 seconds, checking for completion and downloading artifacts when available.

### 📊 Database Layer

Built on **Azure Table Storage** with a type-safe repository pattern:

**Data Models:**
- `KernelConfig` - Kernel configurations for benchmarking
- `KernelTypeDefinition` - Kernel type schemas with attributes
- `WorkflowRunState` - Benchmark/tuning run tracking
- `TuningConfig` - Tuning results and configurations
- `RepoPullRequest` - GitHub PR tracking
- `BenchChangeStats` - Performance comparison statistics

**Repository Features:**
- Generic type-safe CRUD operations
- Batch operations (upsert, update, delete)
- OData query support
- Automatic serialization/deserialization
- Transaction support (up to 100 ops per batch)

### 🪝 GitHub Integration

**Webhook Events:**
- `workflow_run` - Track benchmark/tuning workflow status
- `workflow_job` - Monitor individual job steps
- `pull_request` - Track Wave repository updates
- `push` - Monitor repository changes

**GitHub Actions Integration:**
- Dispatch benchmark workflows with custom configurations
- Trigger tuning workflows with kernel parameters
- Cancel running workflows programmatically
- Download and process workflow artifacts

**Gist Management:**
- Upload tuning configurations as gists
- Store kernel problem definitions
- Share configurations across workflows

## Getting Started

### Prerequisites

- Python 3.12+
- Azure Storage account
- GitHub App credentials
- Access to the benchmark repository

### Environment Setup

Create a `.env` file with required credentials:

```bash
# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=<your-connection-string>

# GitHub
PEM_FILE=<github-app-private-key>
APP_ID=<github-app-id>
INSTALLATION_ID=<installation-id>

# Authentication
PASSWORD_HASH=<bcrypt-hashed-password>
```

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Initialize database tables (first-time setup)
python -c "from backend.storage.types import *; print('Database initialized')"
```

### Running the Services

The backend requires all three services to run concurrently:

**Terminal 1 - API Server:**
```bash
python -m backend.server
# Runs on port 3000 by default
```

**Terminal 2 - Event Loop:**
```bash
python -m backend.event_loop
# Polls every 10 seconds for run updates
```

**Terminal 3 - Webhook Listener:**
```bash
python -m backend.listener
# Runs on port 2500 by default
```

For production deployment, use a process manager like `supervisor` or `systemd` to manage all three services.

### Docker Deployment

```dockerfile
# Example Dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY backend/ ./backend/

# Run with supervisor or similar
CMD ["python", "-m", "backend.server"]
```

## Configuration

### Server Configuration

Default ports and settings in `server.py` and `listener.py`:

```python
# API Server
API_PORT = 3000

# Webhook Listener  
WEBHOOK_PORT = 2500

# Event Loop
UPDATE_RUNS_INTERVAL = 10  # seconds
```

### GitHub Workflow Configuration

Workflows are defined in `runs/workflows.py`:

- **Short Benchmark**: Quick validation runs for specific kernels
- **Tune Wave Kernels**: Hyperparameter optimization workflows

### Authentication

The backend uses JWT-based authentication:
- Tokens expire after 30 minutes
- Password is hashed with bcrypt
- Sessions are managed via HTTP-only cookies

## Database Schema

### Kernel Configuration

```python
@dataclass
class KernelConfig:
    _id: str              # Unique identifier
    name: str             # Kernel name
    kernelType: str       # Type (gemm, attention, etc.)
    tag: str              # Grouping tag for batch operations
    machines: list[str]   # Target machines (mi325x, etc.)
    workflow: str         # Workflow type (none, e2e, all)
    problem: dict         # Kernel-specific parameters
```

### Kernel Type Definition

```python
@dataclass
class KernelTypeDefinition:
    _id: str                  # Unique identifier
    name: str                 # Internal name
    displayName: str          # Display name for UI
    attributes: list[dict]    # Schema defining kernel parameters
    description: str          # Optional description
```

### Workflow Run State

```python
@dataclass
class WorkflowRunState:
    _id: str              # GitHub run ID
    type: str             # BENCHMARK or TUNING
    blobName: str         # Artifact storage location
    timestamp: datetime   # Run creation time
    status: str           # queued, in_progress, completed
    conclusion: str       # success, failure, cancelled
    numSteps: int         # Total workflow steps
    steps: list[dict]     # Individual step details
    completed: bool       # Completion flag
    hasArtifact: bool     # Artifact availability
    mappingId: str        # Links to PR or config
```

## API Usage Examples

### Adding Kernels

```python
import requests

# Single kernel
response = requests.post('http://localhost:3000/kernels', json={
    "name": "gemm_1024_1024_1024_f16",
    "kernelType": "gemm",
    "tag": "validation",
    "machines": ["mi325x"],
    "workflow": "e2e",
    "problem": {
        "M": 1024,
        "N": 1024,
        "K": 1024,
        "dtype": "f16"
    }
})

# Batch add
kernels = [kernel1, kernel2, kernel3]
response = requests.post('http://localhost:3000/kernels', json=kernels)
```

### Triggering Benchmarks

```python
# Trigger benchmark for specific tags
response = requests.post('http://localhost:3000/workflow/trigger', json={
    "pr": {
        "repoName": "nod-ai/SHARK-Platform",
        "branchName": "main",
        "mappingId": "pr-123"
    },
    "config": {
        "machine": "mi325x",
        "kernelSelection": {
            "type": "specific-tags",
            "tags": ["validation", "regression"]
        }
    }
})
```

### Triggering Tuning

```python
# Tune specific kernels
response = requests.post('http://localhost:3000/tune', json={
    "kernel_ids": ["kernel-uuid-1", "kernel-uuid-2", "kernel-uuid-3"]
})
```

## Performance Monitoring

The backend tracks performance metrics across runs:

### Change Statistics

Compares performance between runs to detect regressions:

```python
@dataclass
class BenchChangeStats:
    _id: str
    runId: str
    machine: str
    old: dict  # Previous run metrics
    new: dict  # Current run metrics
```

Calculated metrics:
- **Speedup/Slowdown** per kernel
- **Aggregate performance changes**
- **Backend comparisons** (Wave vs IREE vs PyTorch)

### Artifact Parsing

The backend automatically parses benchmark artifacts:

**Supported Formats:**
- CSV benchmark results
- JSON tuning configurations
- HipBLASLt output files

**Parsed Metrics:**
- Runtime (μs)
- TFLOPs
- Occupancy
- Memory bandwidth
- Tuning parameters

## Troubleshooting

### Common Issues

**Database Connection Errors:**
```bash
# Verify Azure connection string
python -c "from backend.storage.auth import get_blob_client; get_blob_client()"
```

**GitHub Authentication:**
```bash
# Test GitHub API access
python -c "from backend.github_utils import get_repo; print(get_repo('bench'))"
```

**Run Not Updating:**
- Check event loop is running
- Verify workflow is dispatched correctly
- Check GitHub Actions logs

**Artifact Not Found:**
- Ensure workflow completed successfully
- Check artifact name matches expected pattern
- Verify Azure Storage permissions

## Development

### Adding New Endpoints

```python
@app.route("/your-endpoint", methods=["GET"])
def your_endpoint():
    """Your endpoint description."""
    data = YourDataDb.find_all()
    return jsonify([asdict(item) for item in data])
```

### Creating New Run Types

1. Add to `RunType` enum in `runs/__init__.py`
2. Create workflow definition in `runs/workflows.py`
3. Implement artifact parser in `runs/parsing/`
4. Register in workflow listener

### Adding Database Models

```python
# 1. Define model in storage/types.py
@dataclass
class YourModel:
    _id: str
    field1: str
    field2: int

# 2. Create repository
YourModelDb = create_repository(YourModel, "tablename")

# 3. Use in endpoints
@app.route("/your-models")
def get_your_models():
    models = YourModelDb.find_all()
    return jsonify([asdict(m) for m in models])
```

## Performance Considerations

- Event loop polls every 10 seconds - adjust `UPDATE_RUNS_INTERVAL` if needed
- Batch operations support up to 100 entities per transaction
- Database queries are filtered at the server to minimize data transfer
- Artifact parsing is done asynchronously by event loop
- Webhook listener uses Pyramid for better performance under load

## Security

- **Authentication**: JWT tokens with 30-minute expiration
- **Authorization**: Token-based endpoint protection (commented out in development)
- **Webhook Validation**: GitHub webhook signatures should be verified (TODO)
- **CORS**: Configured for dashboard domain
- **Environment Variables**: Sensitive credentials stored in `.env`

## Contributing

When adding new features:

1. Follow existing patterns for consistency
2. Add type hints for all functions
3. Use dataclasses for structured data
4. Leverage repository pattern for database operations
5. Add appropriate error handling and logging

## Related Documentation

- [Main Project README](../README.md)
- [Benchmark Infrastructure](../benchmark/README.md)
- [Dashboard README](../dashboard/README.md)

## Support

For questions or issues:
- Open an issue on GitHub
- Contact: Surya Jasper
