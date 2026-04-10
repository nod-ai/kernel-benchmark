import type { RunWithTrigger } from "../../types";

export type RunTypeFilter = "ALL" | "pr_update" | "manual_bench" | "manual_tuning" | "scheduled" | "rebase";

export type SortColumn = "name" | "type" | "tracker" | "machine" | "date";
export type SortDirection = "asc" | "desc";

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

export interface RunRowData {
  run: RunWithTrigger["run"];
  trigger: RunWithTrigger["trigger"];
  displayName: string;
  runType: string;
  colors: { badge: string };
  isCompleted: boolean;
  canNavigate: boolean | undefined;
  itemId: string;
  trackerName: string;
  machine: string;
  timestamp: Date;
  backendSpecs: any[];
}
