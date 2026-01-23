from backend.github_utils import get_repo
from backend.runs.manager import RunManager
from backend.runs.scheduling import TrackerScheduler
import time
import traceback

UPDATE_RUNS_INTERVAL = 10  # seconds
CHECK_TRACKERS_INTERVAL = 60  # seconds (check every minute)

repo = get_repo("bench")


def serve_event_loop():
    last_run_update_time = 0
    last_tracker_check_time = 0
    run_manager = RunManager()
    tracker_scheduler = TrackerScheduler()

    while True:
        now = time.time()

        if now - last_run_update_time >= UPDATE_RUNS_INTERVAL:
            try:
                run_manager.update_runs()
            except Exception:
                print("Exception occurred in update_runs:")
                traceback.print_exc()
            last_run_update_time = now

        if now - last_tracker_check_time >= CHECK_TRACKERS_INTERVAL:
            try:
                tracker_scheduler.check_and_trigger_due_trackers()
            except Exception:
                print("Exception in tracker scheduling:")
                traceback.print_exc()
            last_tracker_check_time = now

        time.sleep(1)


if __name__ == "__main__":
    serve_event_loop()
