import json
import logging
import os
from pathlib import Path
import traceback
from typing import Dict, List, override
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


class BenchmarkArtifactParser(RunArtifactParser):
    @override
    def _parse_from_local_path(self, local_path):
        """
        Parse kernel data from local path.
        
        Supports both formats:
        - New format: single merged_kernels.json file
        - Old format: nested directory structure with multiple JSON files
        """
        local_path = Path(local_path)
        
        # Check for new merged format
        merged_file = local_path / "merged_kernels.json"
        if merged_file.exists():
            logger.debug(f"Found merged kernel JSON at {merged_file}")
            return load_merged_kernel_json(merged_file)
        
        # Fall back to old nested directory format
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
            with open(merged_file_path, 'w') as f:
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
        if run.triggerId:
            try:
                trigger = RunTriggerDb.find_by_id(run.triggerId)
                if trigger and trigger.type == TriggerType.SCHEDULED.value:
                    tracker_id = trigger.metadata.get("trackerId")
                    tracker_name = trigger.metadata.get("trackerName")
                    logger.debug(f"Run {run_id} is linked to tracker {tracker_name} ({tracker_id})")
            except Exception as e:
                logger.warning(f"Failed to check trigger for tracker info: {e}")

        # Save performance statistics
        try:
            stats = BenchmarkRunStats(
                _id=str(uuid4()),
                runId=run_id,
                timestamp=datetime.now(timezone.utc),
                machine=run.machine,
                performance=performance,
                trackerId=tracker_id,
                trackerName=tracker_name,
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


def parse_bench_kernels_from_path(artifact_path: Path) -> List[Dict]:
    results = []
    logger.debug(f"Artifact path: {artifact_path}")

    for result_json in get_nested_files(artifact_path, "json"):
        result_data = load_bench_result_json(result_json)
        results.extend(result_data)

    if len(results) == 0:
        raise RuntimeError(
            f"Could not find kernels in local artifact directory {artifact_path}"
        )
    return results


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
