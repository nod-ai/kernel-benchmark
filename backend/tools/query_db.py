"""
Database query tool for debugging. Supports querying all repositories
defined in backend/storage/types.py and backend/storage/triggers.py.

Usage:
    python -m backend.tools.query_db <table> [options]

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
    --id ID              Find a specific entity by ID
    --filter FILTER      OData filter string (e.g. "status eq 'completed'")
    --fields F1,F2,...   Only show specific fields (comma-separated)
    --limit N            Limit number of results
    --count              Only show count of matching entities
    --sort FIELD         Sort by field (prefix with - for descending, e.g. -timestamp)
    --json               Output as raw JSON instead of formatted table

Examples:
    python -m backend.tools.query_db runs --filter "completed eq false" --fields _id,status,completed,triggerId
    python -m backend.tools.query_db runs --filter "status eq 'completed' and completed eq false"
    python -m backend.tools.query_db triggers --filter "status eq 'linked'" --fields _id,runId,status,type
    python -m backend.tools.query_db runs --id 12345678
    python -m backend.tools.query_db runs --count
    python -m backend.tools.query_db triggers --sort -timestamp --limit 10
"""

import argparse
import json
import sys
from dataclasses import asdict
from datetime import datetime

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


def serialize_value(v):
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, (dict, list)):
        return json.dumps(v, default=str)
    return v


def format_table(entities, field_list=None):
    """Format entities as a readable text table."""
    if not entities:
        print("(no results)")
        return

    rows = []
    for entity in entities:
        d = asdict(entity)
        if field_list:
            d = {k: v for k, v in d.items() if k in field_list}
        rows.append({k: serialize_value(v) for k, v in d.items()})

    if not rows:
        print("(no results)")
        return

    headers = list(rows[0].keys())
    col_widths = {h: len(h) for h in headers}
    for row in rows:
        for h in headers:
            val = str(row.get(h, ""))
            if len(val) > 80:
                val = val[:77] + "..."
            col_widths[h] = max(col_widths[h], len(val))

    header_line = " | ".join(h.ljust(col_widths[h]) for h in headers)
    separator = "-+-".join("-" * col_widths[h] for h in headers)
    print(header_line)
    print(separator)

    for row in rows:
        values = []
        for h in headers:
            val = str(row.get(h, ""))
            if len(val) > 80:
                val = val[:77] + "..."
            values.append(val.ljust(col_widths[h]))
        print(" | ".join(values))


def main():
    parser = argparse.ArgumentParser(description="Query database tables for debugging")
    parser.add_argument("table", choices=TABLES.keys(), help="Table to query")
    parser.add_argument("--id", help="Find entity by ID")
    parser.add_argument("--filter", help="OData filter string")
    parser.add_argument("--fields", help="Comma-separated list of fields to display")
    parser.add_argument("--limit", type=int, help="Limit number of results")
    parser.add_argument("--count", action="store_true", help="Only show count")
    parser.add_argument("--sort", help="Sort by field (prefix with - for descending)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()
    repo = TABLES[args.table]
    field_list = args.fields.split(",") if args.fields else None

    if args.id:
        entity = repo.find_by_id(args.id)
        if entity is None:
            print(f"No entity found with id '{args.id}' in {args.table}")
            sys.exit(1)
        entities = [entity]
    elif args.filter:
        entities = repo.query(args.filter)
    else:
        entities = repo.find_all()

    if args.sort:
        descending = args.sort.startswith("-")
        sort_field = args.sort.lstrip("-")
        try:
            entities.sort(
                key=lambda e: getattr(e, sort_field, None) or "",
                reverse=descending,
            )
        except Exception as e:
            print(f"Warning: could not sort by '{sort_field}': {e}", file=sys.stderr)

    if args.count:
        print(f"Count: {len(entities)}")
        return

    if args.limit:
        entities = entities[: args.limit]

    print(f"\n=== {args.table} ({len(entities)} results) ===\n")

    if args.json:
        data = []
        for entity in entities:
            d = asdict(entity)
            if field_list:
                d = {k: v for k, v in d.items() if k in field_list}
            data.append(d)
        print(json.dumps(data, indent=2, default=str))
    else:
        format_table(entities, field_list)


if __name__ == "__main__":
    main()
