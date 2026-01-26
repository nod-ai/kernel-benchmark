import logging
import traceback
from backend.github_utils import create_gist, get_repo
from backend.github_utils.gist import load_gist_by_id
from backend.runs import RunType, get_artifact_parser
from backend.runs.run_utils import find_incomplete_runs, get_run_by_blob_name
from backend.runs.tracker import get_run_tracker
from backend.runs.trigger_service import trigger_run, TriggerType
from backend.runs.scheduling import validate_tracker_no_overlap
from backend.storage.rebase import rebase_all, rebase_pull_requests
from backend.storage.types import *
from backend.storage.utils import test_logger
from backend.webhook.wave_update import WaveUpdateListener
from backend.storage.auth import get_blob_client

from uuid import uuid4
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from dataclass_wizard import fromdict, asdict
from functools import wraps
import jwt
from datetime import datetime, timezone, timedelta
import os
from werkzeug.security import check_password_hash, generate_password_hash
from dotenv import load_dotenv

directory_client = get_blob_client()

app = Flask(__name__)
CORS(app, supports_credentials=True)

load_dotenv()
app.config["SECRET_KEY"] = os.getenv("PEM_FILE")
app.config["PASSWORD_HASH"] = os.getenv("PASSWORD_HASH")

logger = logging.getLogger(__name__)


@app.route("/")
def home():
    return jsonify({"message": "Flask server with CORS is running on port 3000."})


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization")

        if not token:
            return jsonify({"message": "Token is missing"}), 401

        try:
            if token.startswith("Bearer "):
                token = token[7:]

            data = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Token is invalid"}), 401

        return f(*args, **kwargs)

    return decorated


@app.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    password = data.get("password")

    if not password:
        return jsonify({"message": "Password is required"}), 400

    if check_password_hash(app.config["PASSWORD_HASH"], password):
        token = jwt.encode(
            {"exp": datetime.now(timezone.utc) + timedelta(minutes=30)},
            app.config["SECRET_KEY"],
            algorithm="HS256",
        )

        response = make_response(jsonify({"message": "Login successful"}))
        response.set_cookie(
            "auth_token",
            token,
            max_age=30 * 60,
            httponly=True,
            secure=True,
            samesite="Lax",
        )
        return response

    return jsonify({"message": "Invalid password"}), 401


@app.route("/auth/verify", methods=["GET"])
def verify():
    token = request.cookies.get("auth_token")

    if not token:
        return jsonify({"authenticated": False}), 200

    try:
        jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        return jsonify({"authenticated": True}), 200
    except:
        return jsonify({"authenticated": False}), 200


@app.route("/auth/logout", methods=["POST"])
def logout():
    response = make_response(jsonify({"message": "Logout successful"}))
    response.set_cookie("auth_token", "", expires=0)
    return response


@app.route("/pull_requests")
def get_pull_requests():
    modifications = RepoPullRequestDb.find_all()
    return jsonify([asdict(modification) for modification in modifications])


@app.route("/runs")
def get_all_runs():
    runs = WorkflowRunDb.find_all({"type": RunType.BENCHMARK.name})
    return jsonify([asdict(run) for run in runs])


@app.route("/performances")
def get_all_perfs():
    perfs = WorkflowRunDb.find_all({"type": RunType.E2E.name})
    return jsonify([asdict(perf) for perf in perfs])


@app.route("/api/runs", methods=["GET"])
def get_runs():
    """Get all workflow runs with optional pagination and type filtering."""
    try:
        # Get query parameters
        page = request.args.get("page", default=1, type=int)
        page_size = request.args.get("page_size", default=50, type=int)
        run_type = request.args.get("type", default=None, type=str)
        has_artifact = request.args.get("has_artifact", default=None, type=str)
        completed_only = request.args.get("completed_only", default=None, type=str)

        # Validate pagination parameters
        if page < 1:
            return jsonify({"error": "Page must be >= 1"}), 400
        if page_size < 1 or page_size > 1000:
            return jsonify({"error": "Page size must be between 1 and 1000"}), 400

        # Query database with optional type filter
        query = {"type": run_type} if run_type else None
        all_runs = WorkflowRunDb.find_all(query)

        # Apply artifact filter if specified
        if has_artifact is not None:
            has_artifact_bool = has_artifact.lower() == "true"
            all_runs = [run for run in all_runs if run.hasArtifact == has_artifact_bool]

        # Apply completed filter if specified
        if completed_only is not None:
            completed_only_bool = completed_only.lower() == "true"
            if completed_only_bool:
                all_runs = [run for run in all_runs if run.completed]
            else:
                all_runs = [run for run in all_runs if not run.completed]

        # Sort by timestamp (most recent first)
        all_runs.sort(key=lambda r: r.timestamp, reverse=True)

        # Calculate counts (from unfiltered query for totals)
        query_for_counts = {"type": run_type} if run_type else None
        all_runs_for_counts = WorkflowRunDb.find_all(query_for_counts)
        if has_artifact is not None:
            has_artifact_bool = has_artifact.lower() == "true"
            all_runs_for_counts = [
                run
                for run in all_runs_for_counts
                if run.hasArtifact == has_artifact_bool
            ]

        total = len(all_runs)
        ongoing_count = sum(1 for run in all_runs_for_counts if not run.completed)
        completed_count = sum(1 for run in all_runs_for_counts if run.completed)

        # Calculate pagination
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size

        # Get paginated results
        runs_page = all_runs[start_idx:end_idx]

        return jsonify(
            {
                "runs": [asdict(run) for run in runs_page],
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size,
                "ongoing_count": ongoing_count,
                "completed_count": completed_count,
            }
        )

    except Exception as e:
        logger.error(f"Error getting runs: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Failed to get runs: {str(e)}"}), 500


@app.route("/api/runs/<run_id>", methods=["DELETE"])
# @token_required
def delete_run(run_id):
    """Delete a workflow run and its associated blob artifact."""
    try:
        # Find the run
        run = WorkflowRunDb.find_by_id(run_id)

        if not run:
            return jsonify({"error": "Run not found"}), 404

        # Delete blob artifact if it exists
        if run.hasArtifact and run.blobName:
            try:
                directory_client.rm(run.blobName, recursive=True)
                logger.info(f"Deleted blob artifact: {run.blobName}")
            except Exception as blob_error:
                logger.warning(f"Failed to delete blob {run.blobName}: {blob_error}")
                # Continue with database deletion even if blob deletion fails

        # Delete from database
        success = WorkflowRunDb.delete_by_id(run_id)

        if success:
            return jsonify({"message": "Run deleted successfully"}), 200
        else:
            return jsonify({"error": "Failed to delete run from database"}), 500

    except Exception as e:
        logger.error(f"Error deleting run {run_id}: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Failed to delete run: {str(e)}"}), 500


@app.route("/artifact/<blob_name>")
def get_artifact_by_run_id(blob_name):
    new_kernels = get_artifact_parser(RunType.BENCHMARK).load_data(blob_name)
    if new_kernels:
        return jsonify(new_kernels)
    else:
        return "Failed to gather artifact data", 500


@app.route("/workflow/pr/trigger", methods=["POST"])
def trigger_pr_workflow():
    """Trigger a benchmark workflow for a pull request."""
    response_data = request.get_json()

    pr_data = response_data["pr"]
    config_data = response_data["config"]
    kernel_selection = config_data["kernelSelection"]

    # Build metadata for trigger
    metadata = {
        "machine": config_data.get("machine", "mi325"),
    }

    # Optional PR info for manual runs
    if pr_data.get("repoName"):
        metadata["repoName"] = pr_data["repoName"]
    if pr_data.get("branchName"):
        metadata["branchName"] = pr_data["branchName"]
    if pr_data.get("mappingId"):  # Legacy field name (actually headSha)
        metadata["headSha"] = pr_data["mappingId"]

    # Handle kernel selection
    if kernel_selection["type"] == "specific-tags":
        tags = kernel_selection["tags"]
        # Query to verify we have kernels
        bench_kernels = KernelConfigDb.query(
            " or ".join([f"tag eq '{tag}'" for tag in tags])
        )
        if len(bench_kernels) == 0:
            return jsonify({"error": "No kernels found for specified tags"}), 500
        logger.info(
            f"Loaded {len(bench_kernels)} kernels for benchmark with {len(tags)} tags"
        )
        metadata["tags"] = tags
    elif kernel_selection["type"] == "specific-ids" and "ids" in kernel_selection:
        metadata["kernelIds"] = kernel_selection["ids"]

    # Use unified trigger service
    trigger_id = trigger_run(TriggerType.PR_UPDATE, metadata)

    if trigger_id:
        return jsonify({"triggerId": trigger_id, "message": "Success"}), 200
    else:
        return jsonify({"error": "Failed to trigger run"}), 500


@app.route("/workflow/manual/trigger", methods=["POST"])
def trigger_manual_workflow():
    """Trigger a manual benchmark workflow."""
    response_data = request.get_json()

    if not response_data or "config" not in response_data:
        return jsonify({"error": "Missing config in request body"}), 400

    config_data = response_data["config"]

    # Validate required fields
    if "name" not in config_data or not config_data["name"]:
        return jsonify({"error": "Missing required field: name"}), 400
    if "machine" not in config_data or not config_data["machine"]:
        return jsonify({"error": "Missing required field: machine"}), 400
    if "backends" not in config_data or not config_data["backends"]:
        return jsonify({"error": "Missing required field: backends"}), 400
    if (
        not isinstance(config_data["backends"], list)
        or len(config_data["backends"]) == 0
    ):
        return jsonify({"error": "backends must be a non-empty array"}), 400
    if "kernelSelection" not in config_data:
        return jsonify({"error": "Missing required field: kernelSelection"}), 400

    kernel_selection = config_data["kernelSelection"]

    # Build metadata for trigger
    metadata = {
        "name": config_data["name"],
        "machine": config_data["machine"],
        "backends": config_data["backends"],
    }

    # Handle kernel selection
    if kernel_selection["type"] == "all-quick":
        # Get all quick kernels
        bench_kernels = KernelConfigDb.query("workflow eq 'all'")
        if len(bench_kernels) == 0:
            return jsonify({"error": "No quick kernels found"}), 500
        metadata["kernelIds"] = [k._id for k in bench_kernels]
        logger.info(f"Loaded {len(bench_kernels)} quick kernels for manual benchmark")
    elif kernel_selection["type"] == "specific-tags":
        tags = kernel_selection["tags"]
        if not tags or len(tags) == 0:
            return jsonify({"error": "No tags specified for kernel selection"}), 400
        # Query to verify we have kernels
        bench_kernels = KernelConfigDb.query(
            " or ".join([f"tag eq '{tag}'" for tag in tags])
        )
        if len(bench_kernels) == 0:
            return jsonify({"error": "No kernels found for specified tags"}), 500
        logger.info(
            f"Loaded {len(bench_kernels)} kernels for manual benchmark with {len(tags)} tags"
        )
        metadata["tags"] = tags
    elif kernel_selection["type"] == "specific-ids" and "ids" in kernel_selection:
        if not kernel_selection["ids"] or len(kernel_selection["ids"]) == 0:
            return jsonify({"error": "No kernel IDs specified"}), 400
        metadata["kernelIds"] = kernel_selection["ids"]
    else:
        return jsonify({"error": "Invalid kernel selection type"}), 400

    # Use unified trigger service with MANUAL_BENCHMARK type
    trigger_id = trigger_run(TriggerType.MANUAL_BENCHMARK, metadata)

    if trigger_id:
        return jsonify({"triggerId": trigger_id, "message": "Success"}), 200
    else:
        return jsonify({"error": "Failed to trigger manual benchmark"}), 500


@app.route("/workflow/cancel", methods=["POST"])
def cancel_workflow():
    payload = request.get_json()
    run_id = int(payload["runId"])
    cancel_success = get_repo("bench").get_workflow_run(run_id).cancel()
    if cancel_success:
        return "Success", 200
    else:
        return "Failure", 500


@app.route("/rebase", methods=["POST"])
def rebase_prs():
    # rebase_all()
    rebase_pull_requests()
    modifications = RepoPullRequestDb.find_all()
    performances = []
    # performances = WorkflowRunDb.find_all({"type": RunType.E2E.name})
    return jsonify(
        {
            "modifications": [asdict(modification) for modification in modifications],
            "performances": [asdict(perf) for perf in performances],
        }
    )


@app.route("/tune", methods=["POST"])
def tune_kernels():
    payload = request.get_json()
    kernel_ids = [str(id) for id in payload["kernel_ids"]]

    # Build metadata for tuning trigger
    metadata = {
        "kernelIds": kernel_ids,
        "numTrials": payload.get("numTrials", 75),
        "backend": payload.get("backend", "wave"),
    }

    # Use unified trigger service
    trigger_id = trigger_run(TriggerType.MANUAL_TUNING, metadata)

    if trigger_id:
        return jsonify({"triggerId": trigger_id, "message": "Success"}), 200
    else:
        return jsonify({"error": "Failed to trigger tuning"}), 500


@app.route("/tune/results", methods=["GET"])
def get_tuned_results():
    tuned_results = TuningConfigDb.find_all()
    return jsonify([asdict(t) for t in tuned_results])


@app.route("/tune/runs", methods=["GET"])
def get_tuning_runs():
    runs = find_incomplete_runs(RunType.TUNING)

    tuning_kernels = []
    for run in runs:
        # Get kernels from trigger metadata
        if run.triggerId:
            try:
                from backend.storage.triggers import RunTriggerDb

                trigger = RunTriggerDb.find_by_id(run.triggerId)
                if trigger and "kernelIds" in trigger.metadata:
                    # Get kernels by IDs
                    kernel_ids = trigger.metadata["kernelIds"]
                    kernels = [KernelConfigDb.find_by_id(kid) for kid in kernel_ids]
                    kernels = [asdict(k) for k in kernels if k is not None]
                    tuning_kernels.extend(kernels)
            except Exception as e:
                logger.warning(f"Failed to get kernels for run {run._id}: {e}")

    return jsonify(
        {
            "runs": [asdict(r) for r in runs],
            "kernels": tuning_kernels,
        }
    )


@app.route("/benchmark_stats", methods=["GET"])
def get_all_benchmark_stats():
    """Get all benchmark run statistics from the database."""
    stats = BenchmarkRunStatsDb.find_all()
    return jsonify([asdict(s) for s in stats])


@app.route("/benchmark_stats/<run_id>", methods=["GET"])
def get_benchmark_stat_by_run_id(run_id):
    """Get benchmark statistics for a specific run."""
    stats = BenchmarkRunStatsDb.find_all({"runId": str(run_id)})
    if len(stats) == 0:
        return "Failed to find benchmark stats", 404
    return jsonify(asdict(stats[0]))


# DEPRECATED: Old change_stats endpoints - kept for backward compatibility
# These return empty results as we no longer compute change statistics
@app.route("/change_stats", methods=["GET"])
def get_all_change_stats():
    """DEPRECATED: Use /benchmark_stats instead."""
    return jsonify([])


@app.route("/change_stats/<run_id>", methods=["GET"])
def get_change_stat_by_run_id(run_id):
    """DEPRECATED: Use /benchmark_stats/<run_id> instead."""
    return jsonify({}), 404


@app.route("/kernel_types", methods=["GET"])
def get_all_kernel_types():
    """Get all kernel types from the database."""
    kernel_types = KernelTypeDb.find_all()
    return jsonify([asdict(kt) for kt in kernel_types])


@app.route("/kernel_types", methods=["POST"])
# @token_required
def add_kernel_type():
    """Add a new kernel type to the database."""
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ["_id", "name", "displayName", "attributes"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Create kernel type from the request data
        kernel_type = fromdict(KernelTypeDefinition, data)

        # Check if kernel type with this ID already exists
        existing = KernelTypeDb.find_by_id(kernel_type._id)
        if existing:
            return jsonify({"error": "Kernel type with this ID already exists"}), 409

        # Save to database
        success = KernelTypeDb.upsert(kernel_type)

        if success:
            return jsonify(asdict(kernel_type)), 201
        else:
            return jsonify({"error": "Failed to save kernel type"}), 500

    except Exception as e:
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Invalid data: {str(e)}"}), 400


@app.route("/kernel_types/<kernel_type_id>", methods=["PUT"])
# @token_required
def update_kernel_type(kernel_type_id):
    """Update an existing kernel type."""
    try:
        data = request.get_json()

        # Check if kernel type exists
        existing = KernelTypeDb.find_by_id(kernel_type_id)
        if not existing:
            return jsonify({"error": "Kernel type not found"}), 404

        # Update the kernel type
        updated = KernelTypeDb.update_by_id(kernel_type_id, data)

        if updated:
            return jsonify(asdict(updated)), 200
        else:
            return jsonify({"error": "Failed to update kernel type"}), 500

    except Exception as e:
        return jsonify({"error": f"Invalid data: {str(e)}"}), 400


@app.route("/kernel_types/<kernel_type_id>", methods=["DELETE"])
# @token_required
def remove_kernel_type(kernel_type_id):
    """Remove a kernel type from the database."""
    try:
        # Check if kernel type exists
        existing = KernelTypeDb.find_by_id(kernel_type_id)
        if not existing:
            return jsonify({"error": "Kernel type not found"}), 404

        # Delete the kernel type
        success = KernelTypeDb.delete_by_id(kernel_type_id)

        if success:
            return jsonify({"message": "Kernel type deleted successfully"}), 200
        else:
            return jsonify({"error": "Failed to delete kernel type"}), 500

    except Exception as e:
        return jsonify({"error": f"Error deleting kernel type: {str(e)}"}), 500


@app.route("/kernels", methods=["GET"])
def get_all_kernels():
    """Get all kernel configurations from the database."""
    kernels = KernelConfigDb.find_all()
    return jsonify([asdict(k) for k in kernels])


@app.route("/kernels", methods=["POST"])
# @token_required
def add_kernels():
    """Add multiple new kernel configurations to the database."""
    try:
        data = request.get_json()

        # Expect either a single kernel config or a list of kernel configs
        if not isinstance(data, list):
            kernel_configs = [data]
        else:
            kernel_configs = data

        if not kernel_configs:
            return jsonify({"error": "No kernel configurations provided"}), 400

        created_kernels = []

        for kernel_data in kernel_configs:
            # Validate required fields (excluding _id as it can be auto-generated)
            required_fields = [
                "name",
                "kernelType",
                "tag",
                "machines",
                "workflow",
                "problem",
            ]
            for field in required_fields:
                if field not in kernel_data:
                    return jsonify({"error": f"Missing required field: {field}"}), 400

            # Generate unique ID if not provided
            if "_id" not in kernel_data or not kernel_data["_id"]:
                kernel_data["_id"] = str(uuid4())

            # Create kernel config from the request data
            kernel_config = fromdict(KernelConfig, kernel_data)
            created_kernels.append(kernel_config)

        # Save all kernel configs to database
        success = KernelConfigDb.upsert_many(created_kernels)

        if success:
            return jsonify([asdict(k) for k in created_kernels]), 201
        else:
            return jsonify({"error": "Failed to save kernel configurations"}), 500

    except Exception as e:
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Invalid data: {str(e)}"}), 400


@app.route("/kernels/<kernel_id>", methods=["PUT"])
# @token_required
def update_kernel(kernel_id):
    """Update an existing kernel configuration."""
    try:
        data = request.get_json()

        # Check if kernel config exists
        existing = KernelConfigDb.find_by_id(kernel_id)
        if not existing:
            return jsonify({"error": "Kernel configuration not found"}), 404

        # Update the kernel config
        updated = KernelConfigDb.update_by_id(kernel_id, data)

        if updated:
            return jsonify(asdict(updated)), 200
        else:
            return jsonify({"error": "Failed to update kernel configuration"}), 500

    except Exception as e:
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Invalid data: {str(e)}"}), 400


@app.route("/kernels/batch", methods=["PUT"])
# @token_required
def update_kernels_batch():
    """Update multiple kernel configurations using batched transactions."""
    try:
        data = request.get_json()

        # Expect a list of update dictionaries
        if not isinstance(data, list):
            return jsonify({"error": "Expected a list of update objects"}), 400

        if not data:
            return jsonify({"error": "No kernel updates provided"}), 400

        # Validate that each update has an _id field
        for i, update_dict in enumerate(data):
            if not isinstance(update_dict, dict):
                return jsonify({"error": f"Update at index {i} must be an object"}), 400
            if "_id" not in update_dict:
                return (
                    jsonify(
                        {"error": f"Update at index {i} missing required '_id' field"}
                    ),
                    400,
                )

        # Perform batched update
        success = KernelConfigDb.update_many(data)

        if success:
            return (
                jsonify(
                    {
                        "message": f"Successfully updated {len(data)} kernel configurations",
                        "updated_count": len(data),
                    }
                ),
                200,
            )
        else:
            return jsonify({"error": "Failed to update kernel configurations"}), 500

    except Exception as e:
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Invalid data: {str(e)}"}), 400


@app.route("/kernels", methods=["DELETE"])
# @token_required
def remove_kernels():
    """Remove multiple kernel configurations from the database."""
    try:
        data = request.get_json()

        # Expect a list of kernel IDs to delete
        if not data or "ids" not in data:
            return jsonify({"error": "Missing 'ids' field in request body"}), 400

        kernel_ids = data["ids"]
        if not isinstance(kernel_ids, list):
            return jsonify({"error": "'ids' must be a list"}), 400

        if not kernel_ids:
            return jsonify({"error": "No kernel IDs provided"}), 400

        success = KernelConfigDb.delete_many_by_ids(kernel_ids)

        # Return appropriate status code based on results
        if success:
            return f"Successfully deleted {len(kernel_ids)} kernels", 200
        else:
            return "Failed to delete one or more kernels", 400

    except Exception as e:
        logger.error(traceback.format_exc())
        return f"Error deleting kernel configurations: {str(e)}", 500


@app.route("/api/trackers", methods=["GET"])
def get_trackers():
    """Get all trackers."""
    try:
        trackers = TrackerDb.find_all()
        return jsonify([asdict(tracker) for tracker in trackers])
    except Exception as e:
        logger.error(f"Error getting trackers: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Failed to get trackers: {str(e)}"}), 500


@app.route("/api/trackers", methods=["POST"])
# @token_required
def create_tracker():
    """Create a new tracker."""
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "Request body is required"}), 400

        # Validate required fields
        required_fields = [
            "name",
            "blobName",
            "tags",
            "backends",
            "machine",
            "schedule",
        ]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Validate schedule
        schedule_data = data["schedule"]
        schedule_required = ["isInterval", "startDate", "timeOfDay"]
        for field in schedule_required:
            if field not in schedule_data:
                return (
                    jsonify({"error": f"Missing required schedule field: {field}"}),
                    400,
                )

        # Create tracker with generated ID
        tracker_data = {
            "_id": str(uuid4()),
            "name": data["name"],
            "blobName": data["blobName"],
            "tags": data["tags"],
            "backends": data["backends"],
            "machine": data["machine"],
            "schedule": schedule_data,
            "isActive": data.get("isActive", True),
            "createdAt": datetime.now(timezone.utc),
        }

        tracker = fromdict(Tracker, tracker_data)

        # Validate no overlap with existing trackers
        is_valid, error_msg = validate_tracker_no_overlap(tracker)
        if not is_valid:
            return jsonify({"error": error_msg}), 409

        TrackerDb.upsert(tracker)

        return jsonify(asdict(tracker)), 201

    except Exception as e:
        logger.error(f"Error creating tracker: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Failed to create tracker: {str(e)}"}), 500


@app.route("/api/trackers/<tracker_id>", methods=["PUT"])
# @token_required
def update_tracker(tracker_id):
    """Update an existing tracker."""
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "Request body is required"}), 400

        # Find existing tracker
        existing_tracker = TrackerDb.find_by_id(tracker_id)
        if not existing_tracker:
            return jsonify({"error": "Tracker not found"}), 404

        # Update schedule if provided
        schedule_data = asdict(existing_tracker.schedule)
        if "schedule" in data:
            schedule_data = data["schedule"]

        # Update tracker fields
        tracker_data = {
            "_id": tracker_id,
            "name": data.get("name", existing_tracker.name),
            "blobName": data.get("blobName", existing_tracker.blobName),
            "tags": data.get("tags", existing_tracker.tags),
            "backends": data.get("backends", existing_tracker.backends),
            "machine": data.get("machine", existing_tracker.machine),
            "schedule": schedule_data,
            "isActive": data.get("isActive", existing_tracker.isActive),
            "createdAt": existing_tracker.createdAt,
        }

        updated_tracker = fromdict(Tracker, tracker_data)

        # Validate no overlap with existing trackers
        # Important: Only validate if tracker is being activated or is already active
        # This allows deactivating conflicting trackers, but prevents activating
        # a tracker that would conflict
        if updated_tracker.isActive:
            is_valid, error_msg = validate_tracker_no_overlap(
                updated_tracker, tracker_id=tracker_id
            )
            if not is_valid:
                return jsonify({"error": error_msg}), 409

        success = TrackerDb.upsert(updated_tracker)

        if success:
            return jsonify(asdict(updated_tracker)), 200
        else:
            return jsonify({"error": "Failed to update tracker"}), 500

    except Exception as e:
        logger.error(f"Error updating tracker {tracker_id}: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Failed to update tracker: {str(e)}"}), 500


@app.route("/api/trackers/<tracker_id>", methods=["DELETE"])
# @token_required
def delete_tracker(tracker_id):
    """Delete a tracker."""
    try:
        tracker = TrackerDb.find_by_id(tracker_id)

        if not tracker:
            return jsonify({"error": "Tracker not found"}), 404

        success = TrackerDb.delete_by_id(tracker_id)

        if success:
            return jsonify({"message": "Tracker deleted successfully"}), 200
        else:
            return jsonify({"error": "Failed to delete tracker"}), 500

    except Exception as e:
        logger.error(f"Error deleting tracker {tracker_id}: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Failed to delete tracker: {str(e)}"}), 500


@app.route("/api/triggers", methods=["GET"])
def get_triggers():
    """Get all triggers with optional filtering."""
    try:
        from backend.storage.triggers import RunTriggerDb

        # Get query parameters for filtering
        trigger_type = request.args.get("type")
        status = request.args.get("status")
        limit = request.args.get("limit", type=int)

        # Build query
        if trigger_type and status:
            query = f"type eq '{trigger_type}' and status eq '{status}'"
        elif trigger_type:
            query = f"type eq '{trigger_type}'"
        elif status:
            query = f"status eq '{status}'"
        else:
            query = None

        # Get triggers
        if query:
            triggers = RunTriggerDb.query(query)
        else:
            triggers = RunTriggerDb.find_all()

        # Sort by timestamp (most recent first)
        triggers.sort(key=lambda t: t.timestamp, reverse=True)

        # Apply limit if specified
        if limit:
            triggers = triggers[:limit]

        return jsonify([asdict(t) for t in triggers])

    except Exception as e:
        logger.error(f"Error getting triggers: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Failed to get triggers: {str(e)}"}), 500


@app.route("/api/triggers/<trigger_id>", methods=["GET"])
def get_trigger(trigger_id):
    """Get a specific trigger with its linked run info."""
    try:
        from backend.storage.triggers import RunTriggerDb

        trigger = RunTriggerDb.find_by_id(trigger_id)

        if not trigger:
            return jsonify({"error": "Trigger not found"}), 404

        trigger_data = asdict(trigger)

        # If trigger is linked to a run, include run info
        if trigger.runId:
            try:
                run = WorkflowRunDb.find_by_id(trigger.runId)
                if run:
                    trigger_data["run"] = asdict(run)
            except:
                pass

        return jsonify(trigger_data)

    except Exception as e:
        logger.error(f"Error getting trigger {trigger_id}: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Failed to get trigger: {str(e)}"}), 500


@app.route("/api/runs/<run_id>/trigger", methods=["GET"])
def get_run_trigger(run_id):
    """Get the trigger that caused a specific run."""
    try:
        from backend.storage.triggers import RunTriggerDb

        # Get the run
        run = WorkflowRunDb.find_by_id(run_id)

        if not run:
            return jsonify({"error": "Run not found"}), 404

        # Get trigger by triggerId or by querying runId
        if run.triggerId:
            trigger = RunTriggerDb.find_by_id(run.triggerId)
        else:
            # Fallback: search by runId
            triggers = RunTriggerDb.query(f"runId eq '{run_id}'")
            trigger = triggers[0] if triggers else None

        if not trigger:
            return jsonify({"error": "No trigger found for this run"}), 404

        return jsonify(asdict(trigger))

    except Exception as e:
        logger.error(f"Error getting trigger for run {run_id}: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Failed to get trigger: {str(e)}"}), 500


def serve_backend(port=3000):
    app.run("0.0.0.0", port=port)


if __name__ == "__main__":
    serve_backend()
