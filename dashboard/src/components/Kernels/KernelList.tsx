import type { KernelConfig, TuningResults } from "../../types";
import { useState } from "react";
import { twMerge } from "tailwind-merge";
import { CheckSquare, Square, Users } from "lucide-react";
import { KernelListItem } from "./KernelListItem";

interface KernelListProps {
  kernels: KernelConfig[];
  tuningResults: TuningResults;
  inProgress?: Set<string>;
  toggleKernels?: (ids: string[], state: boolean) => void;
  activeKernels?: Set<string>;
}

export default function KernelList({
  kernels,
  tuningResults,
  inProgress,
  toggleKernels,
  activeKernels,
}: KernelListProps) {
  const [selectStart, setSelectStart] = useState<number | undefined>(undefined);

  const allSelected =
    toggleKernels &&
    activeKernels &&
    kernels.every((k) => activeKernels.has(k._id));

  const handleToggle = (id: string, state: boolean) => {
    if (toggleKernels) {
      toggleKernels([id], state);
      setSelectStart(undefined);
    }
  };

  const handleMouseDown = (index: number) => {
    setSelectStart(index);
  };

  const handleMouseUp = (index: number) => {
    if (!selectStart || !toggleKernels || !activeKernels) return;
    if (selectStart === index) return;

    const start = Math.min(selectStart, index);
    const end = Math.max(selectStart, index) + 1;
    toggleKernels(
      kernels.slice(start, end).map((k) => k._id),
      !activeKernels.has(kernels[selectStart]._id)
    );
    setSelectStart(undefined);
  };

  return (
    <div className="flex flex-col w-full gap-4 px-4">
      {toggleKernels && activeKernels && kernels.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="w-4 h-4" />
            <span>
              {activeKernels.size} of {kernels.length} kernel
              {kernels.length !== 1 ? "s" : ""} selected
            </span>
          </div>

          <button
            className={twMerge(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 shadow-sm border",
              allSelected
                ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-300"
                : "bg-green-50 hover:bg-green-100 text-green-700 border-green-200 hover:border-green-300"
            )}
            onClick={() => {
              toggleKernels(
                kernels.map((k) => k._id),
                !allSelected
              );
            }}
          >
            {allSelected ? (
              <>
                <Square className="w-4 h-4" />
                Deselect All
              </>
            ) : (
              <>
                <CheckSquare className="w-4 h-4" />
                Select All
              </>
            )}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {kernels.map((kernel, index) => (
          <KernelListItem
            key={kernel._id}
            kernel={kernel}
            index={index}
            tuningResults={tuningResults[kernel.name]}
            inProgress={inProgress && inProgress.has(kernel._id)}
            isActive={activeKernels?.has(kernel._id)}
            onToggle={toggleKernels ? handleToggle : undefined}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          />
        ))}
      </div>

      {kernels.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Users className="w-12 h-12 mb-3 text-gray-300" />
          <p className="text-lg font-medium">No kernels found</p>
          <p className="text-sm">
            Try adjusting your filters to see more results.
          </p>
        </div>
      )}
    </div>
  );
}
