"""
Unified Trigger Service

This module provides a single entry point for triggering all workflow runs.
All workflow dispatches flow through trigger_run(), which handles:
- Creating triggers in the database
- Determining which workflow to dispatch
- Building workflow inputs from metadata
- Dispatching to GitHub Actions
- Updating trigger status

This consolidates logic that was previously scattered across:
- runs/workflows.py
- webhook/wave_update.py
- server.py endpoints
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from dataclass_wizard import asdict

from backend.github_utils.actions import trigger_workflow_dispatch
from backend.github_utils.commits import resolve_backend_specs_commits
from backend.github_utils.gist import create_gist
from backend.globals import BENCH_REPO_BRANCH
from backend.runs import RunType
from backend.runs.workflows import find_workflow
from backend.storage.triggers import (
    RunTrigger,
    RunTriggerDb,
    TriggerType,
    TriggerStatus,
    link_trigger_to_run,
)
from backend.storage.types import (
    KernelConfig,
    KernelConfigDb,
    TuningConfig,
    TuningConfigDb,
)

logger = logging.getLogger(__name__)

# Re-export for convenience
__all__ = ["trigger_run", "link_trigger_to_run", "TriggerType"]


def trigger_run(trigger_type: TriggerType, metadata: dict[str, Any]) -> Optional[str]:
    """
    Unified function to trigger any workflow run.

    This is the ONLY place where workflow runs should be triggered from.
    All trigger logic is consolidated here for simplicity and maintainability.

    This function queues the trigger instead of dispatching immediately.
    The RunScheduler in the event loop will dispatch queued triggers when machine
    resources are available and no tracker conflicts exist.

    Args:
        trigger_type: Type of trigger (PR_UPDATE, MANUAL_BENCHMARK, etc.)
        metadata: Type-specific metadata dictionary (MUST include "machine" and "branch")

    Returns:
        Trigger ID if successful, None if failed

    Example usage:
        # Wave PR update
        trigger_run(TriggerType.PR_UPDATE, {
            "prId": "123",
            "repoName": "iree-org/wave",
            "branchName": "feature/opt",
            "headSha": "abc123",
            "commits": 5,
            "machine": "mi325",  # REQUIRED
            "branch": "main"  # REQUIRED
        })

        # Manual benchmark
        trigger_run(TriggerType.MANUAL_BENCHMARK, {
            "tags": ["validation"],
            "machine": "mi325x",  # REQUIRED
            "branch": "main"  # REQUIRED
        })
    """
    trigger_id = str(uuid4())

    try:
        # Extract machine from metadata (REQUIRED)
        machine = metadata.get("machine")
        if not machine:
            raise ValueError("machine is required in metadata")

        # Extract branch from metadata (REQUIRED)
        branch = metadata.get("branch")
        if not branch:
            raise ValueError("branch is required in metadata")

        # Resolve commit hashes for backend specs if provided
        if "backendSpecs" in metadata and metadata["backendSpecs"]:
            logger.info("Resolving commit hashes for backend specs...")
            metadata["backendSpecs"] = resolve_backend_specs_commits(
                metadata["backendSpecs"]
            )

        # Create trigger in database with status=QUEUED
        # RunScheduler will dispatch it when machine is available
        trigger = RunTrigger(
            _id=trigger_id,
            type=trigger_type.value,
            status=TriggerStatus.QUEUED.value,
            timestamp=datetime.now(timezone.utc),
            metadata=metadata,
            machine=machine,
            branch=branch,
        )
        RunTriggerDb.upsert(trigger)
        logger.info(
            f"Queued trigger {trigger_id} of type {trigger_type.value} "
            f"for machine {machine} on branch {branch}"
        )

        return trigger_id

    except Exception as e:
        logger.error(f"Error in trigger_run: {e}")
        try:
            RunTriggerDb.update_by_id(
                trigger_id, {"status": TriggerStatus.FAILED.value, "error": str(e)}
            )
        except:
            pass
        return None


def _determine_workflow(
    trigger_type: TriggerType, metadata: dict[str, Any]
) -> Optional[str]:
    """
    Maps a trigger type to the appropriate workflow file.

    Args:
        trigger_type: The type of trigger
        metadata: Trigger metadata (may influence workflow selection)

    Returns:
        Workflow filename (e.g., "short_bench.yml") or None
    """
    if trigger_type == TriggerType.PR_UPDATE:
        return "short_bench.yml"
    elif trigger_type == TriggerType.MANUAL_BENCHMARK:
        return "short_bench.yml"
    elif trigger_type == TriggerType.MANUAL_TUNING:
        return "tune_kernels.yml"
    elif trigger_type == TriggerType.SCHEDULED:
        return "short_bench.yml"
    elif trigger_type == TriggerType.REBASE:
        # For historical runs, typically short bench
        return "short_bench.yml"
    else:
        logger.error(f"Unknown trigger type: {trigger_type}")
        return None


def _build_workflow_inputs(
    trigger_type: TriggerType, metadata: dict[str, Any], trigger_id: str
) -> dict[str, Any]:
    """
    Builds workflow inputs from trigger metadata.

    Different trigger types require different workflow inputs.
    This function handles all the complexity of:
    - Creating gists for kernels/configs
    - Formatting metadata into workflow input format
    - Adding the trigger_id for linking

    Args:
        trigger_type: The type of trigger
        metadata: Trigger-specific metadata
        trigger_id: The unique trigger ID to pass to workflow

    Returns:
        Dictionary of workflow inputs ready for GitHub Actions
    """
    inputs = {"trigger_id": trigger_id}

    if trigger_type == TriggerType.PR_UPDATE:
        # PR update: short benchmark with Wave branch info
        inputs.update(_build_pr_update_inputs(metadata))

    elif trigger_type == TriggerType.MANUAL_BENCHMARK:
        # Manual benchmark: load kernels by tags or IDs
        inputs.update(_build_benchmark_inputs(metadata))

    elif trigger_type == TriggerType.MANUAL_TUNING:
        # Tuning: create gist with kernels to tune
        inputs.update(_build_tuning_inputs(metadata))

    elif trigger_type == TriggerType.SCHEDULED:
        # Scheduled tracker run: uses same logic as manual benchmarks
        inputs.update(_build_benchmark_inputs(metadata))

    return inputs


def _build_pr_update_inputs(metadata: dict[str, Any]) -> dict[str, Any]:
    """Build inputs for Wave PR update triggers."""
    # Load all kernels configured for workflow runs
    problems = KernelConfigDb.find_all({"workflow": "all"})
    logger.info(f"Loaded {len(problems)} kernels for PR benchmark")

    # Create gist with problems
    problems_json = [asdict(p) for p in problems]
    problems_gist = create_gist(problems_json)

    # Find latest tuning configs
    tuned_configs = _find_latest_tuned_configs(problems)
    logger.info(f"Loaded {len(tuned_configs)} tuning configs for PR benchmark")
    tuned_configs_json = [asdict(c) for c in tuned_configs]
    tuned_configs_gist = create_gist(tuned_configs_json)

    return {
        "machine": metadata.get("machine", "mi325"),
        "problems_url": problems_gist.raw_url,
        "tuned_config_url": tuned_configs_gist.raw_url,
        "pr_repository": metadata.get("repoName"),
        "pr_branch": metadata.get("branchName"),
        "pr_headsha": metadata.get("headSha"),
    }


def _build_benchmark_inputs(metadata: dict[str, Any]) -> dict[str, Any]:
    """
    Build inputs for benchmark triggers (manual or scheduled).
    
    Consolidated function that handles both manual benchmarks and scheduled tracker runs.
    Both use the same workflow (short_bench.yml) with the same input structure.
    
    Args:
        metadata: Trigger metadata which may contain:
            - kernelIds: List of specific kernel IDs to benchmark
            - tags: List of tags to filter kernels
            - backends: List of backends or comma-separated string
            - machine: Target machine (default: "mi325")
            - repoName, branchName, headSha: Optional PR info for manual runs
            - trackerId, trackerName, blobName: Optional tracker info for scheduled runs
    
    Returns:
        Dictionary of workflow inputs for short_bench.yml
    """
    # Determine which kernels to benchmark
    if "kernelIds" in metadata:
        # Specific kernel IDs provided
        kernel_ids = metadata["kernelIds"]
        problems = [KernelConfigDb.find_by_id(kid) for kid in kernel_ids]
        problems = [p for p in problems if p is not None]
    elif "tags" in metadata:
        # Tags provided - query by tags
        tags = metadata["tags"]
        query = " or ".join([f"tag eq '{tag}'" for tag in tags])
        problems = KernelConfigDb.query(query)
    else:
        # No selection - use all workflow kernels
        problems = KernelConfigDb.find_all({"workflow": "all"})

    logger.info(f"Loaded {len(problems)} kernels for benchmark")

    # Create gist with problems
    problems_json = [asdict(p) for p in problems]
    problems_gist = create_gist(problems_json)

    # Find latest tuning configs
    tuned_configs = _find_latest_tuned_configs(problems)
    tuned_configs_json = [asdict(c) for c in tuned_configs]
    tuned_configs_gist = create_gist(tuned_configs_json)

    inputs = {
        "machine": metadata.get("machine", "mi325"),
        "problems_url": problems_gist.raw_url,
        "tuned_config_url": tuned_configs_gist.raw_url,
    }

    # Backend specifications with commit hashes
    if "backendSpecs" in metadata and metadata["backendSpecs"]:
        backend_specs_gist = create_gist(metadata["backendSpecs"])
        inputs["backend_specs_url"] = backend_specs_gist.raw_url
        logger.info(
            f"Created backend specs gist with {len(metadata['backendSpecs'])} specs"
        )
        # Derive selected_backend from backendSpecs (backendParam takes priority)
        backend_names = []
        for spec in metadata["backendSpecs"]:
            param = spec.get("backendParam") or spec.get("backend")
            if param and param not in backend_names:
                backend_names.append(param)
        if backend_names:
            inputs["selected_backend"] = ",".join(backend_names)

    # Fallback: use backends list if no backendSpecs provided
    elif "backends" in metadata:
        if isinstance(metadata["backends"], list):
            inputs["selected_backend"] = ",".join(metadata["backends"])
        else:
            inputs["selected_backend"] = metadata["backends"]

    # Optional PR info (for manual runs)
    if "repoName" in metadata:
        inputs["pr_repository"] = metadata["repoName"]
    if "branchName" in metadata:
        inputs["pr_branch"] = metadata["branchName"]
    if "headSha" in metadata:
        inputs["pr_headsha"] = metadata["headSha"]

    return inputs


def _build_tuning_inputs(metadata: dict[str, Any]) -> dict[str, Any]:
    """Build inputs for tuning triggers."""
    # Get kernels to tune
    kernel_ids = metadata.get("kernelIds", [])
    kernels = [KernelConfigDb.find_by_id(kid) for kid in kernel_ids]
    kernels = [k for k in kernels if k is not None]

    logger.info(f"Creating tuning request for {len(kernels)} kernels")

    # Create gist with kernels
    kernels_json = [asdict(k) for k in kernels]
    gist = create_gist(kernels_json)

    return {
        "problems_url": gist.raw_url,
        "num_trials": str(metadata.get("numTrials", 75)),
        "backend": metadata.get("backend", "wave"),
    }


def _find_latest_tuned_configs(problems: list[KernelConfig]) -> list[TuningConfig]:
    """
    Find the latest tuning configuration for each problem.

    This was previously in workflows.py, moved here for consolidation.
    """
    problem_configs = {p.name: None for p in problems}

    all_configs = TuningConfigDb.find_all()
    for config in all_configs:
        name = config.kernel_name
        if name not in problem_configs:
            continue

        if (
            problem_configs[name] is None
            or config.timestamp > problem_configs[name].timestamp
        ):
            problem_configs[name] = config

    return [config for config in problem_configs.values() if config]


def _dispatch_workflow(workflow_file: str, inputs: dict[str, Any], branch_name: Optional[str] = None) -> bool:
    """
    Dispatches a workflow to GitHub Actions.

    Args:
        workflow_file: Workflow filename (e.g., "short_bench.yml")
        inputs: Workflow inputs dictionary
        branch_name: Optional branch name to use (defaults to BENCH_REPO_BRANCH)

    Returns:
        True if dispatch succeeded, False otherwise
    """
    try:
        target_branch = branch_name or BENCH_REPO_BRANCH
        return trigger_workflow_dispatch(
            repo_id="bench",
            branch_name=target_branch,
            workflow_id=workflow_file,
            inputs=inputs,
        )
    except Exception as e:
        logger.error(f"Error dispatching workflow {workflow_file}: {e}")
        return False
