import { useState } from "react";
import { ChevronRight, CheckSquare, Square } from "lucide-react";
import { twMerge } from "tailwind-merge";
import type { KernelConfig, TuningResults } from "../../types";
import { KernelListItem } from "./KernelListItem";
import TagContextMenu from "./TagContextMenu";

interface TagGroupProps {
  tag: string;
  kernels: KernelConfig[];
  tuningResults: TuningResults;
  inProgress?: Set<string>;
  activeKernels?: Set<string>;
  toggleKernels?: (ids: string[], state: boolean) => void;
  forceExpanded?: boolean;
  attributeOrder?: string[];
  onRenameTag: (tag: string) => void;
  onMergeTag: (tag: string) => void;
  onDeleteTag: (tag: string) => void;
}

export default function TagGroup({
  tag,
  kernels,
  tuningResults,
  inProgress,
  activeKernels,
  toggleKernels,
  forceExpanded,
  attributeOrder,
  onRenameTag,
  onMergeTag,
  onDeleteTag,
}: TagGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const expanded = forceExpanded ?? isExpanded;

  const selectedCount = activeKernels
    ? kernels.filter((k) => activeKernels.has(k._id)).length
    : 0;
  const allSelected = toggleKernels && selectedCount === kernels.length && kernels.length > 0;

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!toggleKernels) return;
    const ids = kernels.map((k) => k._id);
    toggleKernels(ids, !allSelected);
  };

  const handleToggle = (id: string, state: boolean) => {
    if (toggleKernels) toggleKernels([id], state);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Tag Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <ChevronRight
            className={twMerge(
              "w-4 h-4 text-gray-400 transition-transform duration-200",
              expanded ? "rotate-90" : ""
            )}
          />
          <h3 className="text-sm font-semibold text-gray-800">{tag}</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {kernels.length} kernel{kernels.length !== 1 ? "s" : ""}
          </span>
          {selectedCount > 0 && (
            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              {selectedCount} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {toggleKernels && (
            <button
              onClick={handleSelectAll}
              className={twMerge(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border",
                allSelected
                  ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
              )}
            >
              {allSelected ? (
                <>
                  <Square className="w-3 h-3" />
                  Deselect
                </>
              ) : (
                <>
                  <CheckSquare className="w-3 h-3" />
                  Select All
                </>
              )}
            </button>
          )}
          <TagContextMenu
            onRename={() => onRenameTag(tag)}
            onMerge={() => onMergeTag(tag)}
            onDelete={() => onDeleteTag(tag)}
          />
        </div>
      </div>

      {/* Kernel List */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2 bg-gray-50/50">
          {kernels.map((kernel, index) => (
            <KernelListItem
              key={kernel._id}
              kernel={kernel}
              index={index}
              tuningResults={tuningResults[kernel.name]}
              inProgress={inProgress && inProgress.has(kernel._id)}
              isActive={activeKernels?.has(kernel._id)}
              onToggle={toggleKernels ? handleToggle : undefined}
              attributeOrder={attributeOrder}
              hideTag
            />
          ))}
        </div>
      )}
    </div>
  );
}
