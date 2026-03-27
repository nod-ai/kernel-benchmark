import logging
from typing import List, Optional

from backend.github_utils.auth import get_repo
from backend.runs import RunType
from backend.runs.run_utils import find_incomplete_runs
from backend.runs.tracker import get_run_tracker
from backend.storage.auth import get_blob_client
from backend.storage.triggers import RunTriggerDb, TriggerStatus, link_trigger_to_run
from backend.storage.types import WorkflowRunState

logger = logging.getLogger(__name__)


class RunManager:
    def __init__(self, runs: Optional[List[WorkflowRunState]] = None):
        if not runs:
            runs = []
        self._trackers = {run._id: get_run_tracker(run) for run in runs}
        self._dir_client = get_blob_client()
        self.load_incomplete_runs()

    def load_incomplete_runs(self):
        runs = find_incomplete_runs()
        for run in runs:
            self.track_run(run)

    def track_run(self, run: WorkflowRunState):
        if run._id not in self._trackers:
            self._trackers[run._id] = get_run_tracker(run)

    def remove_run(self, run_id: str):
        del self._trackers[run_id]

    def update_runs(self):
        self.load_incomplete_runs()
        completed_runs = []

        for run_id, tracker in self._trackers.items():
            if not tracker.is_complete():
                logger.debug(f"Updating ongoing run_{run_id}")
                tracker.update()
            elif tracker.is_success() and not tracker.has_artifact():
                logger.debug(f"Saving artifact for completed run_{run_id}")
                artifact_success = tracker.save_artifact()
                if not artifact_success:
                    logger.error(
                        f"Could not save artifact for run_{run_id}: Untracking run"
                    )
                    completed_runs.append(run_id)
            else:
                completed_runs.append(run_id)

        for completed_run_id in completed_runs:
            self.remove_run(completed_run_id)
        
        # Reconcile unlinked triggers (backup path when webhooks are missed)
        self.reconcile_unlinked_triggers()
    
    def reconcile_unlinked_triggers(self):
        """
        Find dispatched triggers that haven't been linked to runs yet.
        
        This is the backup mechanism for when webhook events are missed.
        It queries GitHub for recent runs and tries to match them to unlinked triggers.
        """
        try:
            # Find triggers that have been dispatched but not linked
            unlinked_query = f"status eq '{TriggerStatus.DISPATCHED.value}'"
            unlinked_triggers = RunTriggerDb.query(unlinked_query)
            
            if not unlinked_triggers:
                return
            
            logger.info(f"Found {len(unlinked_triggers)} unlinked triggers, attempting reconciliation")
            
            # Get recent workflow runs from GitHub (last 100)
            repo = get_repo("bench")
            recent_runs = list(repo.get_workflow_runs()[:100])
            
            linked_count = 0
            for trigger in unlinked_triggers:
                trigger_id = trigger._id
                
                # Try to find a matching run
                for gh_run in recent_runs:
                    # Extract trigger ID from run's identifier job
                    run_trigger_id = self._extract_trigger_id_from_run(gh_run)
                    
                    if run_trigger_id == trigger_id:
                        logger.info(f"Found matching run {gh_run.id} for trigger {trigger_id}")
                        run_id = str(gh_run.id)
                        
                        # Ensure WorkflowRunState exists (webhook may have been missed)
                        try:
                            from backend.storage.types import WorkflowRunDb
                            existing = WorkflowRunDb.find_by_id(run_id)
                            if not existing:
                                from backend.runs.run_utils import parse_run_from_gh
                                run_state = parse_run_from_gh(gh_run)
                                run_state.triggerId = trigger_id
                                run_state.machine = trigger.machine
                                WorkflowRunDb.upsert(run_state)
                                logger.info(f"Created WorkflowRunState for missed run {run_id}")
                            else:
                                WorkflowRunDb.update_by_id(run_id, {"triggerId": trigger_id})
                        except Exception as e:
                            logger.error(f"Failed to ensure WorkflowRunState for run {run_id}: {e}")
                        
                        # Link trigger to run
                        if link_trigger_to_run(trigger_id, run_id):
                            linked_count += 1
                            # Track the new run so artifact gets processed
                            try:
                                run_state = WorkflowRunDb.find_by_id(run_id)
                                if run_state:
                                    self.track_run(run_state)
                            except Exception:
                                pass
                            break
            
            if linked_count > 0:
                logger.info(f"Successfully linked {linked_count} triggers via reconciliation")
                
        except Exception as e:
            logger.error(f"Error during trigger reconciliation: {e}")
    
    def _extract_trigger_id_from_run(self, gh_run) -> Optional[str]:
        """
        Extract trigger ID from a GitHub workflow run's identifier job.
        
        Returns:
            Trigger ID if found, None otherwise
        """
        try:
            # Look through jobs to find the identifier job
            for job in gh_run.jobs():
                if "identifier" in job.name.lower():
                    # Look through steps for triggerId
                    for step in job.steps:
                        if step.name.startswith("triggerId_"):
                            trigger_id = step.name.split("triggerId_", 1)[1]
                            if trigger_id != "undefined":
                                return trigger_id
        except Exception as e:
            logger.debug(f"Failed to extract trigger ID from run {gh_run.id}: {e}")
        
        return None
