import { useEffect, useState } from "react";
import {
  Clock,
  ChevronDown,
  ChevronRight,
  Loader2,
  Trash2,
  FileText,
  StopCircle,
} from "lucide-react";
import type { RunWithTrigger } from "../../types";
import { toTitleCase, formatElapsedTime } from "../../utils/utils";
import { extractRowData, getStatusIcon } from "./runUtils";
import RunDetailPanel from "./RunDetailPanel";

const NUM_COLUMNS = 8;

interface RunRowProps {
  item: RunWithTrigger;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: (runId: string) => void;
  onCancel: (runId: string) => void;
  onNavigate: (blobName: string) => void;
}

export default function RunRow({ item, isExpanded, onToggleExpand, onDelete, onCancel, onNavigate }: RunRowProps) {
  const { run, trigger, displayName, runType, colors, isCompleted, canNavigate, itemId, trackerName, machine, timestamp } = extractRowData(item);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("");

  useEffect(() => {
    if (run?.status === "in_progress" && run?.timestamp) {
      const update = () => setElapsedTime(formatElapsedTime(new Date(run.timestamp)));
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [run?.status, run?.timestamp]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this run? This will also delete its artifact if it exists.")) {
      setIsDeleting(true);
      try {
        await onDelete(itemId);
      } catch {
        alert("Failed to delete run. Please try again.");
        setIsDeleting(false);
      }
    }
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to cancel this run? This will stop the workflow execution.")) {
      setIsCancelling(true);
      try {
        await onCancel(itemId);
      } catch {
        alert("Failed to cancel run. Please try again.");
        setIsCancelling(false);
      }
    }
  };

  const handleRowClick = () => {
    if (canNavigate && run) {
      onNavigate(run.blobName);
    } else {
      onToggleExpand();
    }
  };

  return (
    <>
      <tr
        onClick={handleRowClick}
        className={`border-b border-gray-100 transition-colors ${
          canNavigate ? "cursor-pointer hover:bg-blue-50/60" : "cursor-pointer hover:bg-gray-50"
        } ${isDeleting ? "opacity-40" : ""}`}
      >
        {/* Status + expand chevron */}
        <td className="px-3 py-2.5 whitespace-nowrap w-10">
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
              className="p-0.5 rounded hover:bg-gray-200 transition-colors"
            >
              {isExpanded
                ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              }
            </button>
            {run ? getStatusIcon(run) : <Clock className="w-4 h-4 text-gray-400" />}
          </div>
        </td>

        {/* Name */}
        <td className="px-3 py-2.5 max-w-xs">
          <div className="truncate text-sm font-medium text-gray-900" title={displayName}>
            {displayName}
          </div>
          {run?.status === "in_progress" && (
            <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-medium text-green-700">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              Running{elapsedTime && ` (${elapsedTime})`}
            </span>
          )}
          {!run && trigger && trigger.status !== "linked" && (
            <span className="text-[11px] text-yellow-600 font-medium">{toTitleCase(trigger.status)}</span>
          )}
        </td>

        {/* Type */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${colors.badge}`}>
            {toTitleCase(runType.replace(/_/g, " "))}
          </span>
        </td>

        {/* Tracker (hidden on small screens) */}
        <td className="px-3 py-2.5 whitespace-nowrap hidden md:table-cell">
          <span className="text-sm text-gray-600">{trackerName || <span className="text-gray-300">&mdash;</span>}</span>
        </td>

        {/* Machine (hidden on small screens) */}
        <td className="px-3 py-2.5 whitespace-nowrap hidden md:table-cell">
          <span className="text-sm text-gray-600">{machine || <span className="text-gray-300">&mdash;</span>}</span>
        </td>

        {/* Date */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <span className="text-sm text-gray-500">{timestamp.toLocaleDateString()}</span>
          <div className="text-[11px] text-gray-400">{timestamp.toLocaleTimeString()}</div>
        </td>

        {/* Artifact */}
        <td className="px-3 py-2.5 whitespace-nowrap text-center w-10">
          {run?.hasArtifact && (
            <span title="Has artifact">
              <FileText className="w-4 h-4 text-gray-500 mx-auto" />
            </span>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-2.5 whitespace-nowrap text-right w-20">
          <div className="flex items-center justify-end gap-1">
            {!isCompleted && run && (
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="p-1.5 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors disabled:opacity-50"
                title="Cancel run"
              >
                {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
              </button>
            )}
            {isCompleted && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                title="Delete run"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </td>
      </tr>

      {isExpanded && <RunDetailPanel item={item} colSpan={NUM_COLUMNS} />}
    </>
  );
}
