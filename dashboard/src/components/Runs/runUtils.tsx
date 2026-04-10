import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { BenchmarkRun, RunWithTrigger } from "../../types";
import type { RunRowData, SortState } from "./types";

const RUN_TYPE_COLORS: Record<string, { badge: string }> = {
  BENCHMARK: { badge: "bg-blue-100 text-blue-700" },
  TUNING: { badge: "bg-purple-100 text-purple-700" },
  E2E: { badge: "bg-green-100 text-green-700" },
  PR_UPDATE: { badge: "bg-indigo-100 text-indigo-700" },
  MANUAL_BENCH: { badge: "bg-blue-100 text-blue-700" },
  MANUAL_TUNING: { badge: "bg-purple-100 text-purple-700" },
  SCHEDULED: { badge: "bg-emerald-100 text-emerald-700" },
  REBASE: { badge: "bg-amber-100 text-amber-700" },
};

export function getStatusIcon(run: BenchmarkRun, size = "w-4 h-4") {
  if (["queued", "requested", "pending", "waiting"].includes(run.status)) {
    return <Clock className={`${size} text-blue-600`} />;
  }
  if (run.status === "in_progress") {
    return <Loader2 className={`${size} text-blue-600 animate-spin`} />;
  }
  if (run.status === "completed") {
    if (run.conclusion === "success") {
      return <CheckCircle className={`${size} text-green-600`} />;
    } else if (run.conclusion === "cancelled") {
      return <XCircle className={`${size} text-gray-500`} />;
    } else {
      return <AlertCircle className={`${size} text-red-600`} />;
    }
  }
  return <Clock className={`${size} text-gray-500`} />;
}

export function extractRowData(item: RunWithTrigger): RunRowData {
  const { run, trigger } = item;
  const displayName = trigger?.metadata?.name || run?.blobName || "Unknown Run";
  const runType = (trigger?.type || "manual_bench").toUpperCase();
  const colors = RUN_TYPE_COLORS[runType] || RUN_TYPE_COLORS.BENCHMARK;
  const isCompleted = run?.completed ?? false;
  const canNavigate = isCompleted && run?.hasArtifact;
  const itemId = run?._id || trigger?._id || "";
  const trackerName = (trigger?.metadata?.trackerName as string) || "";
  const machine = ((trigger?.machine || trigger?.metadata?.machine) as string) || "";
  const timestamp = new Date(trigger?.timestamp || run?.timestamp || new Date());
  const backendSpecs = (trigger?.metadata?.backendSpecs as any[]) || [];

  return { run, trigger, displayName, runType, colors, isCompleted, canNavigate, itemId, trackerName, machine, timestamp, backendSpecs };
}

export function sortRuns(items: RunWithTrigger[], sort: SortState): RunWithTrigger[] {
  const multiplier = sort.direction === "asc" ? 1 : -1;

  return [...items].sort((a, b) => {
    const da = extractRowData(a);
    const db = extractRowData(b);

    let cmp = 0;
    switch (sort.column) {
      case "name":
        cmp = da.displayName.localeCompare(db.displayName);
        break;
      case "type":
        cmp = da.runType.localeCompare(db.runType);
        break;
      case "tracker":
        cmp = da.trackerName.localeCompare(db.trackerName);
        break;
      case "machine":
        cmp = da.machine.localeCompare(db.machine);
        break;
      case "date":
        cmp = da.timestamp.getTime() - db.timestamp.getTime();
        break;
    }
    return cmp * multiplier;
  });
}

export function filterBySearch(items: RunWithTrigger[], query: string): RunWithTrigger[] {
  if (!query.trim()) return items;
  const lower = query.toLowerCase();
  return items.filter((item) => {
    const d = extractRowData(item);
    return (
      d.displayName.toLowerCase().includes(lower) ||
      d.trackerName.toLowerCase().includes(lower) ||
      d.machine.toLowerCase().includes(lower)
    );
  });
}
