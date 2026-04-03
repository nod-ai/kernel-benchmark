import argparse
import time
import traceback

from backend.github_utils import get_repo
from backend.runs.manager import RunManager
from backend.runs.scheduling import TrackerScheduler, RunScheduler

UPDATE_RUNS_INTERVAL = 10  # seconds
CHECK_TRACKERS_INTERVAL = 60  # seconds (check every minute)
CHECK_QUEUE_INTERVAL = 30  # seconds (check every 30 seconds)

ALL_HANDLERS = ["run_manager", "tracker_scheduler", "run_scheduler"]

repo = get_repo("bench")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Backend event loop with optional handler selection.",
        epilog=(
            "Examples:\n"
            "  python -m backend.event_loop                          # all handlers (production)\n"
            "  python -m backend.event_loop --handlers run_manager   # only run tracking/reconciliation\n"
            "  python -m backend.event_loop --once                   # single iteration then exit\n"
            "  python -m backend.event_loop --handlers run_manager --once\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--handlers",
        nargs="+",
        choices=ALL_HANDLERS,
        default=ALL_HANDLERS,
        metavar="HANDLER",
        help=(
            "Which handlers to enable (default: all). Choices: "
            "run_manager (status updates + trigger reconciliation), "
            "tracker_scheduler (scheduled tracker runs), "
            "run_scheduler (dispatch queued triggers)."
        ),
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one iteration of each enabled handler then exit.",
    )
    return parser.parse_args()


def serve_event_loop(handlers=None, once=False):
    if handlers is None:
        handlers = ALL_HANDLERS
    enabled = set(handlers)

    print(f"Event loop starting | handlers={sorted(enabled)} | once={once}")

    last_run_update_time = 0
    last_tracker_check_time = 0
    last_queue_check_time = 0

    run_manager = RunManager() if "run_manager" in enabled else None
    tracker_scheduler = TrackerScheduler() if "tracker_scheduler" in enabled else None
    run_scheduler = RunScheduler() if "run_scheduler" in enabled else None

    while True:
        now = time.time()

        if run_manager and now - last_run_update_time >= UPDATE_RUNS_INTERVAL:
            try:
                run_manager.update_runs()
            except Exception:
                print("Exception occurred in update_runs:")
                traceback.print_exc()
            last_run_update_time = now

        if tracker_scheduler and now - last_tracker_check_time >= CHECK_TRACKERS_INTERVAL:
            try:
                tracker_scheduler.check_and_trigger_due_trackers()
            except Exception:
                print("Exception in tracker scheduling:")
                traceback.print_exc()
            last_tracker_check_time = now

        if run_scheduler and now - last_queue_check_time >= CHECK_QUEUE_INTERVAL:
            try:
                run_scheduler.check_and_dispatch_queued_runs()
            except Exception:
                print("Exception in run scheduling:")
                traceback.print_exc()
            last_queue_check_time = now

        if once:
            print("Single iteration complete, exiting.")
            break

        time.sleep(1)


if __name__ == "__main__":
    args = parse_args()
    serve_event_loop(handlers=args.handlers, once=args.once)
