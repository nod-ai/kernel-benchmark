from datetime import datetime, timezone
from uuid import uuid4
from tqdm import tqdm

from backend.runs import get_artifact_parser
from backend.runs.run_utils import parse_run_from_gh
from backend.runs.workflows import SUPPORTED_WORKFLOWS
from backend.github_utils import get_repo
from backend.storage.triggers import RunTrigger, RunTriggerDb, TriggerType, TriggerStatus
from .conversion import parse_pr_obj
from .types import *


def rebase_runs(limit=10):
    """
    Sync historical runs from GitHub to database.
    
    For each historical run found:
    1. Create WorkflowRunState if not exists
    2. Create a REBASE trigger if run doesn't have one
    3. Download and parse artifacts if missing
    """
    wave = get_repo("bench")

    for workflow in SUPPORTED_WORKFLOWS:
        gh_runs = wave.get_workflow(workflow.filename).get_runs(status="completed")

        i = 0
        for gh_run in gh_runs:
            run_id = str(gh_run.id)
            db_run = WorkflowRunDb.find_by_id(run_id)
            
            # Create run if it doesn't exist
            if not db_run:
                try:
                    db_run = parse_run_from_gh(gh_run)
                except:
                    continue
            
            # Create trigger for this run if it doesn't have one
            if not db_run.triggerId:
                trigger_id = _create_rebase_trigger(db_run, gh_run)
                if trigger_id:
                    db_run.triggerId = trigger_id

            # Download artifacts if missing
            if not db_run.hasArtifact:
                artifact_parser = get_artifact_parser(workflow.run_type)

                for artifact in gh_run.get_artifacts():
                    success, _ = artifact_parser.parse_and_save_artifact(
                        artifact, db_run
                    )
                    if success:
                        db_run.hasArtifact = True
                        break

            # Save run with updated trigger info
            WorkflowRunDb.upsert(db_run)

            i += 1
            if i >= limit:
                break


def _create_rebase_trigger(db_run, gh_run=None):
    """
    Create a REBASE type trigger for a historical run.
    
    Args:
        db_run: The WorkflowRunState from database
        gh_run: Optional GitHub run object for additional metadata
        
    Returns:
        Trigger ID if successful, None otherwise
    """
    try:
        trigger_id = str(uuid4())
        
        # Build metadata from run info
        metadata = {
            "rebase": True,
            "runType": db_run.type,
            "runId": db_run._id
        }
        
        if gh_run:
            metadata["workflowName"] = gh_run.name
            metadata["githubUrl"] = gh_run.html_url
        
        # Note: mappingId has been removed, all runs now use triggerId
        
        trigger = RunTrigger(
            _id=trigger_id,
            type=TriggerType.REBASE.value,
            status=TriggerStatus.LINKED.value,  # Already linked to existing run
            timestamp=db_run.timestamp,  # Use run's timestamp
            metadata=metadata,
            dispatchedAt=db_run.timestamp,
            runId=db_run._id,
            linkedAt=datetime.now(timezone.utc)
        )
        
        RunTriggerDb.upsert(trigger)
        return trigger_id
        
    except Exception as e:
        print(f"Failed to create rebase trigger for run {db_run._id}: {e}")
        return None


def rebase_pull_requests(limit=40):
    wave_repo = get_repo("wave")
    open_prs = wave_repo.get_pulls(state="all", sort="created", direction="desc")

    pbar = tqdm(total=limit, desc="Rebasing pull requests")

    i = 0
    for gh_pr in open_prs:
        pr_dict = gh_pr.raw_data
        pr = parse_pr_obj(pr_dict)
        RepoPullRequestDb.upsert(pr)

        i += 1
        pbar.update()
        if i >= limit:
            return

    pbar.close()


def rebase_all(mod_limit=40, perf_limit=20):
    rebase_pull_requests(mod_limit)
    rebase_runs(perf_limit)
