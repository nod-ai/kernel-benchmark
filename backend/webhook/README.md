# Webhook System

The webhook system receives and processes GitHub webhook events to track workflow runs and Wave repository updates in real-time. It provides the "fast path" for linking triggers to runs and automatically tracking PR updates.

## Architecture Overview

The webhook listener is built with Pyramid and runs as a standalone service on port 2500. It handles multiple event types from GitHub:

- **workflow_run**: Workflow execution lifecycle events
- **workflow_job**: Job and step progress updates
- **pull_request**: Wave PR updates and changes
- **push**: Repository push events

## Components

### 1. Webhook Listener (`listener.py`)

Main entry point that routes webhook events to appropriate handlers:

```python
from backend.webhook import WorkflowListener, WaveUpdateListener

workflow_client = WorkflowListener()
wave_update_client = WaveUpdateListener()

# Routes based on X-Github-Event header:
# - workflow_run → workflow_client.handle_workflow_run_payload()
# - workflow_job → workflow_client.handle_workflow_job_payload()
# - pull_request → wave_update_client.handle_pr_payload()
```

### 2. Workflow Event Handler (`workflow.py`)

Handles workflow and job events from the kernel-benchmark repository:

```python
class WorkflowListener:
    def handle_workflow_run_payload(self, run_payload: dict):
        """Handle workflow run lifecycle events"""
    
    def handle_workflow_job_payload(self, job_payload: dict):
        """Handle job events and extract trigger IDs"""
```

#### Event Flow

**workflow_run Events:**
1. **requested**: Run is created in database with initial status
2. **in_progress**: Run status updated to in_progress
3. **completed**: Run status updated with conclusion (success/failure/cancelled)

**workflow_job Events:**
1. Job event received for "identifier" job
2. Extract `triggerId` from step name (format: `triggerId_{id}`)
3. Link trigger to run using `link_trigger_to_run()`
4. Update `WorkflowRunState.triggerId` in database

#### Trigger Extraction

The webhook listener extracts trigger IDs from the identifier job:

```python
def _extract_trigger_id_from_steps(self, steps: list[dict]) -> Optional[str]:
    """Extract trigger ID from identifier job steps."""
    for step in steps:
        step_name = step.get("name", "")
        if step_name.startswith("triggerId_"):
            trigger_id = step_name.split("triggerId_", 1)[1]
            return trigger_id
    return None
```

**Example:**
- Step name: `triggerId_abc-123-def-456`
- Extracted: `abc-123-def-456`

### 3. Wave PR Handler (`wave_update.py`)

Handles pull request events from the Wave repository:

```python
class WaveUpdateListener:
    def handle_pr_payload(self, pr_payload: dict):
        """Handle PR events and trigger benchmark runs"""
```

#### Event Flow

1. PR event received (opened, synchronize, etc.)
2. Check if PR targets `iree-org/wave/main`
3. Store PR in database via `RepoPullRequestDb.upsert(pr)`
4. If commits changed, trigger benchmark run:
   ```python
   trigger_id = trigger_run(TriggerType.PR_UPDATE, {
       "prId": str(pr_obj["id"]),
       "repoName": head_repo_name,
       "branchName": head_branch,
       "headSha": head_sha,
       "commits": pr_obj["commits"]
   })
   ```

## Webhook Event Types

### workflow_run

Tracks the overall workflow execution lifecycle:

```json
{
  "action": "completed",
  "workflow_run": {
    "id": 123456,
    "name": "Short Benchmark",
    "status": "completed",
    "conclusion": "success",
    "created_at": "2026-01-23T10:00:00Z",
    "updated_at": "2026-01-23T10:15:00Z"
  }
}
```

**Actions:**
- `requested`: Workflow queued
- `in_progress`: Workflow started
- `completed`: Workflow finished

### workflow_job

Tracks individual job execution and steps:

```json
{
  "action": "completed",
  "workflow_job": {
    "id": 789,
    "run_id": 123456,
    "name": "Run Identifier",
    "steps": [
      {
        "name": "triggerId_abc-123",
        "status": "completed",
        "conclusion": "success"
      }
    ]
  }
}
```

**Key Behaviors:**
- Identifier job contains the trigger ID in step name
- Webhook listener extracts and links immediately (fast path)
- Main job steps tracked for progress monitoring

### pull_request

Tracks Wave repository PR updates:

```json
{
  "action": "synchronize",
  "pull_request": {
    "id": 456,
    "number": 123,
    "title": "Add optimization pass",
    "head": {
      "repo": {"full_name": "user/wave"},
      "ref": "feature/opt",
      "sha": "abc123"
    },
    "commits": 3,
    "state": "open"
  }
}
```

**Actions that trigger benchmarks:**
- `opened`: New PR created
- `synchronize`: New commits pushed
- `reopened`: PR reopened

**Actions that don't trigger:**
- `closed`: PR closed/merged
- No change in commit count

## Webhook Security

### Current Status

⚠️ **TODO**: GitHub webhook signature validation is not yet implemented.

### Recommended Implementation

```python
import hmac
import hashlib

def verify_webhook_signature(payload_body: bytes, signature: str, secret: str) -> bool:
    """Verify GitHub webhook signature."""
    expected = "sha256=" + hmac.new(
        secret.encode(),
        payload_body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

# In webhook handler:
signature = request.headers.get("X-Hub-Signature-256")
if not verify_webhook_signature(request.body, signature, WEBHOOK_SECRET):
    return Response("Invalid signature", status=401)
```

## Webhook Configuration

### GitHub Webhook Settings

**Payload URL**: `https://your-domain.com/webhook`

**Content type**: `application/json`

**Events to subscribe:**
- Workflow runs
- Workflow jobs
- Pull requests
- Pushes (optional, for monitoring)

**Active**: ✓ Enabled

### Repository Configuration

The webhook listener monitors two repositories:

1. **kernel-benchmark**: Workflow run tracking
   - Constant: `BENCH_REPO_NAME = "nod-ai/kernel-benchmark"`
   - Events: workflow_run, workflow_job

2. **Wave**: PR monitoring and auto-triggering
   - Constant: `WAVE_REPO_NAME = "iree-org/wave"`
   - Events: pull_request

## Running the Webhook Listener

```bash
# Development
python -m backend.listener

# Production (with supervisor)
[program:webhook-listener]
command=python -m backend.listener
directory=/path/to/backend
autostart=true
autorestart=true
```

**Port**: 2500 (configurable in `listener.py`)

## Webhook Reliability

### Fast Path (95%+ of cases)

1. Workflow dispatched with `trigger_id`
2. Workflow starts, identifier job runs
3. Webhook received with job event
4. Trigger ID extracted and linked **immediately**
5. Total time: < 1 second

### Backup Path (Network Issues)

If webhook is missed:
1. Trigger remains in DISPATCHED status
2. Event loop polls every 10 seconds
3. Queries GitHub for recent runs
4. Extracts trigger ID from identifier job
5. Links trigger to run
6. Total time: < 20 seconds

Both paths use the same `link_trigger_to_run()` function from `storage/triggers.py`.

## Monitoring Webhooks

### Check Webhook Deliveries

In GitHub repo settings → Webhooks → Recent Deliveries:
- ✓ Green: Successfully delivered
- ✗ Red: Delivery failed
- Response code and body shown

### Debug Webhook Issues

```python
import logging

# Enable debug logging in listener
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Check logs for:
# - "Linking trigger {id} to run {run_id}"
# - "No valid trigger ID found in identifier job"
# - "Failed to link trigger {id}"
```

### Webhook Health Metrics

Track these metrics for webhook health:
- Delivery success rate (from GitHub)
- Average linking time (webhook timestamp → link timestamp)
- Unlinked trigger count (query triggers with status=DISPATCHED)
- Event loop reconciliation count (triggers linked via backup path)

## Common Issues

### Issue: Webhook Not Received

**Symptoms:**
- Trigger stuck in DISPATCHED status
- No log entry for webhook event
- Event loop eventually links it

**Causes:**
- Network timeout
- Server temporarily down
- GitHub delivery failure

**Solution:**
- Event loop handles automatically within 10-20 seconds
- Check GitHub webhook delivery status
- Verify webhook endpoint is accessible

### Issue: Trigger ID Not Extracted

**Symptoms:**
- Workflow runs but trigger stays DISPATCHED
- Log: "No valid trigger ID found in identifier job"

**Causes:**
- Identifier job step name format incorrect
- Workflow YML not updated to new format
- Identifier job failed or skipped

**Solution:**
- Check workflow YML uses format: `triggerId_${{ inputs.trigger_id }}`
- Verify identifier job completed successfully
- Event loop will retry extraction from GitHub API

### Issue: Duplicate Linking

**Symptoms:**
- Multiple "Linking trigger" log entries for same trigger

**Causes:**
- Webhook and event loop both link simultaneously

**Solution:**
- Not a problem - `link_trigger_to_run()` is idempotent
- Second call is a no-op if already linked

## Best Practices

1. **Always include identifier job**: Every workflow needs the identifier job
2. **Use standard format**: Step name must be `triggerId_${{ inputs.trigger_id }}`
3. **Monitor deliveries**: Check GitHub webhook delivery status regularly
4. **Trust the backup**: Event loop will catch missed webhooks
5. **Log important events**: Log trigger linking for debugging
6. **Handle errors gracefully**: Don't crash on malformed payloads

## Related Documentation

- [Run Management System](../runs/README.md) - How triggers work
- [Storage Layer](../storage/README.md) - Trigger data models
- [Backend README](../README.md) - Overall architecture
