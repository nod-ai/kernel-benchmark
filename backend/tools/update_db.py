"""
Database update tool for debugging/fixing records. Supports updating entities
in all repositories defined in backend/storage/types.py and backend/storage/triggers.py.

Usage:
    python -m backend.tools.update_db <table> --id ID --set KEY=VALUE [KEY=VALUE ...]

Tables:
    runs          - WorkflowRunState (workflowrunstates2)
    triggers      - RunTrigger (runtriggers)
    stats         - BenchmarkRunStats (benchmarkrunstats)
    trackers      - Tracker (trackers2)
    kerneltypes   - KernelTypeDefinition (kerneltypes)
    kernels       - KernelConfig (kernelconfigs)
    tuning        - TuningConfig (tuningconfigsnew3)
    prs           - RepoPullRequest (repopullrequests)

Options:
    --id ID              Entity ID to update (required)
    --set KEY=VALUE      Fields to update (repeatable). Values are auto-parsed:
                           true/false  -> bool
                           integers    -> int
                           floats      -> float
                           json:{...}  -> parsed JSON object
                           otherwise   -> string
    --dry-run            Show what would be updated without applying changes
    -y, --yes            Skip confirmation prompt

Examples:
    python -m backend.tools.update_db runs --id 24167221765 --set hasArtifact=true
    python -m backend.tools.update_db runs --id 24167221765 --set hasArtifact=true completed=false
    python -m backend.tools.update_db runs --id 24167221765 --set hasArtifact=true --dry-run
    python -m backend.tools.update_db triggers --id abc-123 --set status=linked
"""

import argparse
import json
import sys
from dataclasses import asdict

from backend.storage.types import (
    WorkflowRunDb,
    BenchmarkRunStatsDb,
    TrackerDb,
    KernelTypeDb,
    KernelConfigDb,
    TuningConfigDb,
    RepoPullRequestDb,
)
from backend.storage.triggers import RunTriggerDb

TABLES = {
    "runs": WorkflowRunDb,
    "triggers": RunTriggerDb,
    "stats": BenchmarkRunStatsDb,
    "trackers": TrackerDb,
    "kerneltypes": KernelTypeDb,
    "kernels": KernelConfigDb,
    "tuning": TuningConfigDb,
    "prs": RepoPullRequestDb,
}


def parse_value(raw: str):
    if raw.lower() == "true":
        return True
    if raw.lower() == "false":
        return False
    if raw.startswith("json:"):
        return json.loads(raw[5:])
    try:
        return int(raw)
    except ValueError:
        pass
    try:
        return float(raw)
    except ValueError:
        pass
    return raw


def parse_set_args(set_args: list[str]) -> dict:
    updates = {}
    for pair in set_args:
        if "=" not in pair:
            print(f"Error: invalid --set format '{pair}', expected KEY=VALUE", file=sys.stderr)
            sys.exit(1)
        key, raw_value = pair.split("=", 1)
        updates[key] = parse_value(raw_value)
    return updates


def main():
    parser = argparse.ArgumentParser(description="Update database entities for debugging")
    parser.add_argument("table", choices=TABLES.keys(), help="Table to update")
    parser.add_argument("--id", required=True, help="Entity ID to update")
    parser.add_argument("--set", nargs="+", required=True, dest="set_args",
                        help="Fields to set as KEY=VALUE pairs")
    parser.add_argument("--dry-run", action="store_true", help="Preview without applying")
    parser.add_argument("-y", "--yes", action="store_true", help="Skip confirmation")

    args = parser.parse_args()
    repo = TABLES[args.table]
    updates = parse_set_args(args.set_args)

    entity = repo.find_by_id(args.id)
    if entity is None:
        print(f"Error: no entity found with id '{args.id}' in {args.table}")
        sys.exit(1)

    current = asdict(entity)
    print(f"\n=== Update {args.table} id={args.id} ===\n")
    print("Changes:")
    for key, new_val in updates.items():
        old_val = current.get(key, "<missing>")
        marker = " (no change)" if old_val == new_val else ""
        print(f"  {key}: {old_val!r} -> {new_val!r}{marker}")

    if args.dry_run:
        print("\n[dry-run] No changes applied.")
        return

    if not args.yes:
        confirm = input("\nApply these changes? [y/N] ").strip().lower()
        if confirm not in ("y", "yes"):
            print("Aborted.")
            return

    try:
        repo.update_by_id(args.id, updates)
        print(f"\nSuccessfully updated {args.table} id={args.id}")
    except Exception as e:
        print(f"\nError updating: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
