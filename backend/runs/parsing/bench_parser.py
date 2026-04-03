import json
import logging
import os
from pathlib import Path
import traceback
from typing import Any, Dict, List, Optional, override
from uuid import uuid4

import pandas as pd

from datetime import datetime, timezone

from backend.perf.statistics import compute_performance_statistics
from backend.storage.auth import get_blob_client
from backend.storage.triggers import RunTriggerDb, TriggerType
from backend.storage.types import BenchmarkRunStats, BenchmarkRunStatsDb, WorkflowRunDb
from backend.storage.utils import convert_dict_case, get_nested_files
from .artifact_parsing import RunArtifactParser

logger = logging.getLogger(__name__)

PROFILING_DIR_NAME = "profiling"


class BenchmarkArtifactParser(RunArtifactParser):
    @override
    def _parse_from_local_path(self, local_path):
        """
        Parse kernel data from local path.

        Supports both formats:
        - New format: single merged_kernels.json file
        - Old format: nested directory structure with multiple JSON files

        The profiling/ subdirectory is excluded from benchmark JSON scanning.
        """
        local_path = Path(local_path)

        if local_path.is_file():
            logger.debug(f"Found merged kernel JSON at {local_path}")
            return load_merged_kernel_json(local_path)
        else:
            logger.debug(f"Using nested directory parsing for {local_path}")
            return parse_bench_kernels_from_path(local_path)

    @override
    def _save_artifact(self, local_path, artifact_data, run):
        dir_client = get_blob_client()
        blob_name = run.blobName
        run_id = run._id

        # Create merged JSON file from parsed kernel data
        merged_file_path = local_path / "merged_kernels.json"
        try:
            logger.debug(f"Creating merged kernel JSON file at {merged_file_path}")
            with open(merged_file_path, "w") as f:
                json.dump(artifact_data, f)
        except Exception as e:
            logger.error(f"Failed to create merged kernel JSON: {e}")
            return False

        # Upload single merged file to blob
        try:
            logger.debug(f"Uploading merged artifact to azure path {blob_name}")
            dir_client.upload_file(str(merged_file_path), blob_name)
        except Exception as e:
            logger.error(f"Blob {blob_name} already exists or upload failed: {e}")
            return False

        # Compute performance statistics for this run
        try:
            logger.debug(f"Computing performance statistics for run {run_id}")
            performance = compute_performance_statistics(artifact_data)
        except Exception as e:
            logger.error(
                f"Failed to compute performance statistics for run {run_id}: {e}",
                "".join(traceback.format_exception(e)),
            )
            return False

        # Check if this is a tracker run
        tracker_id = None
        tracker_name = None
        backend_specs = None
        if run.triggerId:
            try:
                trigger = RunTriggerDb.find_by_id(run.triggerId)
                if trigger:
                    if "trackerId" in trigger.metadata:
                        tracker_id = trigger.metadata.get("trackerId")
                        tracker_name = trigger.metadata.get(
                            "trackerName", "Unknown Tracker"
                        )
                        logger.debug(
                            f"Run {run_id} is linked to tracker {tracker_name} ({tracker_id})"
                        )
                    # Get backend specs from trigger metadata
                    if "backendSpecs" in trigger.metadata:
                        backend_specs = trigger.metadata.get("backendSpecs")
                        logger.debug(
                            f"Run {run_id} has {len(backend_specs)} backend specifications"
                        )
            except Exception as e:
                logger.warning(f"Failed to check trigger for tracker info: {e}")

        # Extract and upload profiling data (rocprof dumps)
        profiling_manifest = _extract_and_upload_profiling(local_path, blob_name)

        # Save performance statistics
        try:
            stats = BenchmarkRunStats(
                _id=str(uuid4()),
                runId=run_id,
                timestamp=run.timestamp,
                machine=run.machine,
                performance=performance,
                trackerId=tracker_id,
                trackerName=tracker_name,
                backendSpecs=backend_specs,
                profilingManifest=profiling_manifest,
            )
            BenchmarkRunStatsDb.upsert(stats)
            logger.info(f"Saved performance statistics for run {run_id}")
            return True
        except Exception as e:
            logger.error(
                f"Failed to save performance statistics for run {run_id}: {e}",
                "".join(traceback.format_exception(e)),
            )
            return False


# ---------------------------------------------------------------------------
# Profiling data extraction
# ---------------------------------------------------------------------------

def _find_profiling_dir(local_path: Path) -> Optional[Path]:
    """
    Locate the profiling directory inside the extracted artifact.

    The artifact is extracted to local_path/benchmark-results/. The profiling
    data lives at benchmark-results/profiling/ (placed there by run_bench.sh).
    """
    candidates = [
        local_path / "benchmark-results" / PROFILING_DIR_NAME,
        local_path / PROFILING_DIR_NAME,
    ]
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    # Recursive fallback: look for a profiling dir with a manifest anywhere
    for manifest in local_path.rglob(f"{PROFILING_DIR_NAME}/manifest.json"):
        return manifest.parent
    return None


def _extract_and_upload_profiling(
    local_path: Path, blob_name: str
) -> Optional[Dict[str, Any]]:
    """
    Find profiling data in the extracted artifact, upload each kernel's
    dump directory as a separate blob, and return the manifest.

    Blob layout:
        {blob_name}_profiling_manifest   -> manifest JSON file
        {blob_name}_profiling/{dump_key} -> individual kernel dump dirs
    """
    profiling_dir = _find_profiling_dir(local_path)
    if not profiling_dir:
        logger.debug("No profiling directory found in artifact")
        return None

    manifest_path = profiling_dir / "manifest.json"
    if not manifest_path.exists():
        logger.debug("No profiling manifest.json found")
        return None

    try:
        with open(manifest_path) as f:
            manifest = json.load(f)
    except Exception as e:
        logger.warning(f"Failed to read profiling manifest: {e}")
        return None

    if not manifest:
        logger.debug("Profiling manifest is empty")
        return None

    dir_client = get_blob_client()

    # Upload the manifest itself as a blob for direct retrieval
    try:
        dir_client.upload_file(
            str(manifest_path), f"{blob_name}_profiling_manifest"
        )
        logger.debug(f"Uploaded profiling manifest for {blob_name}")
    except Exception as e:
        logger.warning(f"Failed to upload profiling manifest blob: {e}")

    # Upload each kernel's dump directory as a separate blob directory
    dumps_dir = profiling_dir / "dumps"
    uploaded_count = 0
    if dumps_dir.is_dir():
        for dump_dir in sorted(dumps_dir.iterdir()):
            if not dump_dir.is_dir():
                continue
            try:
                dir_client.upload_dir(
                    str(dump_dir), f"{blob_name}_profiling"
                )
                uploaded_count += 1
            except Exception as e:
                logger.warning(
                    f"Failed to upload profiling dump {dump_dir.name}: {e}"
                )

    total_kernels = sum(len(kernels) for kernels in manifest.values())
    logger.info(
        f"Uploaded profiling data for {uploaded_count}/{total_kernels} kernel(s) "
        f"under {blob_name}_profiling"
    )
    return manifest


# ---------------------------------------------------------------------------
# Benchmark JSON parsing
# ---------------------------------------------------------------------------

def parse_bench_kernels_from_path(artifact_path: Path) -> List[Dict]:
    results = []
    logger.debug(f"Artifact path: {artifact_path}")

    for result_json in get_nested_files(artifact_path, "json"):
        if _is_profiling_path(result_json):
            continue
        try:
            result_data = load_bench_result_json(result_json)
            results.extend(result_data)
        except Exception as e:
            logger.debug(f"Skipping non-benchmark JSON {result_json}: {e}")
            continue

    if len(results) == 0:
        raise RuntimeError(
            f"Could not find kernels in local artifact directory {artifact_path}"
        )
    return results


def _is_profiling_path(path: Path) -> bool:
    """Return True if the path is inside a profiling directory."""
    return PROFILING_DIR_NAME in path.parts


def load_bench_result_json(json_path: os.PathLike) -> List[Dict]:
    with open(json_path, "r") as file:
        results = json.load(file)

    results = [
        {
            **convert_dict_case(result),
            "id": str(uuid4()),
            "dtype": result["shape"].get("dtype") or result["shape"].get("input_dtype"),
        }
        for result in results
    ]

    return results


def load_merged_kernel_json(json_path: os.PathLike) -> List[Dict]:
    """
    Load kernel data from a merged JSON file.

    This is the new format where all kernel results are in a single JSON file.
    The data is already processed and just needs to be loaded.

    Args:
        json_path: Path to the merged_kernels.json file

    Returns:
        List of kernel dictionaries
    """
    with open(json_path, "r") as file:
        results = json.load(file)

    if not isinstance(results, list):
        raise ValueError(f"Expected list in merged kernel JSON, got {type(results)}")

    logger.debug(f"Loaded {len(results)} kernels from merged JSON")
    return results
