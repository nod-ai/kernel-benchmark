import logging
from backend.github_utils import get_repo
from backend.globals import BENCH_REPO_NAME
from backend.runs.run_utils import parse_run_from_json
from backend.runs.workflows import WorkflowRunInfo, find_workflow
from backend.storage.auth import get_blob_client
from backend.storage.triggers import link_trigger_to_run
from backend.storage.types import *
from dataclass_wizard import asdict
import json

logger = logging.getLogger(__name__)


def jsonify(model) -> str:
    return json.dumps(asdict(model), indent=4)


WORKFLOW_TO_RUN_TYPE = {
    "Short Benchmark": "bench",
    "Tune Wave Kernels": "tune",
}

class WorkflowListener:
    def __init__(self):
        self._repo = get_repo("bench")
        self._storage_client = get_blob_client()

    def _handle_workflow_run_requested(
        self, workflow_info: WorkflowRunInfo, run_payload: dict
    ):
        logger.info(f"New run requested")
        run_data = run_payload["workflow_run"]
        run = parse_run_from_json(run_data)
        logger.info(f"Adding new run {run._id} on machine {run.machine}")
        logger.debug(f"Run details:\n{jsonify(run)}")
        WorkflowRunDb.upsert(run)

    def _handle_workflow_run_progress(
        self, workflow_info: WorkflowRunInfo, run_payload: dict
    ):
        run_data = run_payload["workflow_run"]
        run_id = str(run_data["id"])
        run_type = workflow_info.run_type.name

        if WorkflowRunDb.find_by_id(run_id):
            WorkflowRunDb.update_by_id(
                run_id,
                {
                    "status": run_data["status"],
                    "conclusion": run_data["conclusion"],
                    "completed": run_data["status"] == "completed",
                    "timestamp": datetime.fromisoformat(run_data["created_at"]),
                },
            )
        else:
            run = parse_run_from_json(run_data)
            logger.info(f"In progress run {run._id} not found. Adding to database")
            logger.debug(f"Run details:\n{jsonify(run)}")
            WorkflowRunDb.upsert(run)


    def handle_workflow_run_payload(self, run_payload: dict):
        if run_payload["workflow_run"]["event"] != "workflow_dispatch":
            return
        if run_payload["repository"]["full_name"] != BENCH_REPO_NAME:
            return

        workflow_info = find_workflow(name=run_payload["workflow_run"]["name"])
        if not workflow_info:
            return

        handler = {
            "requested": self._handle_workflow_run_requested,
            "in_progress": self._handle_workflow_run_progress,
            "completed": self._handle_workflow_run_progress,
        }

        handler[run_payload["action"]](workflow_info, run_payload)

    def handle_workflow_job_payload(self, job_payload: dict):
        if job_payload["repository"]["full_name"] != BENCH_REPO_NAME:
            return
        
        job_name = job_payload["workflow_job"]["name"]
        workflow_info = find_workflow(main_job=job_name)
        
        # Check if this is an identifier job
        is_identifier_job = "identifier" in job_name.lower()
        
        run_id = str(job_payload["workflow_job"]["run_id"])
        steps = job_payload["workflow_job"]["steps"]

        logger.info(f"updating job: {json.dumps(steps, indent=4)}")

        # Extract trigger ID from identifier job and link
        if is_identifier_job:
            trigger_id = self._extract_trigger_id_from_steps(steps)
            if trigger_id and trigger_id != "undefined":
                logger.info(f"Linking trigger {trigger_id} to run {run_id}")
                link_success = link_trigger_to_run(trigger_id, run_id)
                if link_success:
                    # Update run with trigger ID
                    try:
                        WorkflowRunDb.update_by_id(run_id, {
                            "triggerId": trigger_id,
                            "steps": steps
                        })
                    except Exception as e:
                        logger.error(f"Failed to update run {run_id} with triggerId: {e}")
                else:
                    logger.warning(f"Failed to link trigger {trigger_id} to run {run_id}")
            else:
                logger.debug(f"No valid trigger ID found in identifier job for run {run_id}")
        
        # Update steps for all jobs
        if workflow_info:
            try:
                WorkflowRunDb.update_by_id(run_id, {"steps": steps})
            except Exception as e:
                logger.error(f"Failed to update run {run_id} steps: {e}")
    
    def _extract_trigger_id_from_steps(self, steps: list[dict]) -> Optional[str]:
        """
        Extract trigger ID from identifier job steps.
        
        Looks for step names like "triggerId_abc-123-def" and extracts the ID.
        """
        for step in steps:
            step_name = step.get("name", "")
            if step_name.startswith("triggerId_"):
                trigger_id = step_name.split("triggerId_", 1)[1]
                return trigger_id
        return None
