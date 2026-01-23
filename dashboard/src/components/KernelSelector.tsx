import { Tag, AlertTriangle, Target, Database, Filter } from "lucide-react";
import type { KernelConfig } from "../types";

// For backward compatibility with BenchmarkConfirmationModal
export interface KernelSelectionWithType {
  type: "all-quick" | "specific-tags";
  tags?: string[];
}

export type KernelSelection = string[] | KernelSelectionWithType;

interface KernelSelectorProps {
  selection: KernelSelection;
  onChange: (selection: KernelSelection) => void;
  kernels: KernelConfig[];
  availableTags: string[];
  disabled?: boolean;
  tagsOnly?: boolean; // If true, only show tag selection (for trackers)
}

export default function KernelSelector({
  selection,
  onChange,
  kernels,
  availableTags,
  disabled = false,
  tagsOnly = false,
}: KernelSelectorProps) {
  // Determine if we're using the simple array format or the object format
  const isArrayFormat = Array.isArray(selection);
  const selectedTags = isArrayFormat
    ? selection
    : selection.type === "specific-tags"
      ? selection.tags || []
      : [];
  const selectionType = isArrayFormat
    ? "specific-tags"
    : selection.type;

  const handleTagToggle = (tag: string) => {
    if (isArrayFormat) {
      const newTags = selection.includes(tag)
        ? selection.filter((t) => t !== tag)
        : [...selection, tag];
      onChange(newTags);
    } else {
      const currentTags = selection.tags || [];
      const newTags = currentTags.includes(tag)
        ? currentTags.filter((t) => t !== tag)
        : [...currentTags, tag];
      onChange({
        ...selection,
        tags: newTags,
      });
    }
  };

  const handleTypeChange = (newType: "all-quick" | "specific-tags") => {
    if (!isArrayFormat) {
      onChange({
        type: newType,
        tags: newType === "specific-tags" ? [] : undefined,
      });
    }
  };

  // Calculate kernel counts
  const quickKernelCount = kernels.filter((k) => k.workflow === "all").length;
  const selectedKernelCount = selectedTags.length > 0
    ? kernels.filter((k) => selectedTags.includes(k.tag)).length
    : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-lg">
          <Target className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">
            {tagsOnly ? "Kernel Tags *" : "Kernel Selection *"}
          </h4>
          <p className="text-sm text-gray-600">
            {tagsOnly
              ? "Select kernel tags to track and benchmark"
              : "Choose which kernels to benchmark"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Option 1: All Quick Kernels (only if not tagsOnly) */}
        {!tagsOnly && (
          <div
            className={`border border-gray-200 rounded-lg p-4 ${
              selectionType === "all-quick" ? "bg-blue-50 border-blue-200" : ""
            }`}
          >
            <div className="flex items-start gap-3 mb-3">
              <input
                type="radio"
                name="kernelSelection"
                checked={selectionType === "all-quick"}
                onChange={() => handleTypeChange("all-quick")}
                disabled={disabled}
                className="mt-0.5 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-4 h-4 text-blue-600" />
                  <h5 className="font-medium text-gray-900">
                    Use all quick benchmark kernels
                  </h5>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                    {quickKernelCount} kernels
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Benchmark all kernels configured for quick workflow execution
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Option 2: Specific Tags (or only option if tagsOnly) */}
        <div
          className={`border border-gray-200 rounded-lg p-4 ${
            selectionType === "specific-tags" || tagsOnly
              ? "bg-purple-50 border-purple-200"
              : ""
          }`}
        >
          <div className="flex items-start gap-3 mb-3">
            {!tagsOnly && (
              <input
                type="radio"
                name="kernelSelection"
                checked={selectionType === "specific-tags"}
                onChange={() => handleTypeChange("specific-tags")}
                disabled={disabled}
                className="mt-0.5 border-gray-300 text-purple-600 focus:ring-purple-500"
              />
            )}
            <div className="flex-1">
              {!tagsOnly && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Filter className="w-4 h-4 text-purple-600" />
                    <h5 className="font-medium text-gray-900">
                      Only benchmark specific tags
                    </h5>
                    {selectedKernelCount > 0 && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                        {selectedKernelCount} kernels
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Select specific kernel tags to benchmark
                  </p>
                </>
              )}

              {(selectionType === "specific-tags" || tagsOnly) && (
                <div className="space-y-3">
                  {tagsOnly && selectedKernelCount > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <span className="text-sm text-purple-800 font-medium">
                        {selectedKernelCount} kernels selected
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      const tagKernelCount = kernels.filter(
                        (k) => k.tag === tag
                      ).length;

                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleTagToggle(tag)}
                          disabled={disabled}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                            isSelected
                              ? "bg-purple-600 text-white border-purple-700"
                              : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <Tag className="w-3 h-3" />
                          <span className="font-medium">{tag}</span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              isSelected
                                ? "bg-purple-700 text-purple-100"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {tagKernelCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedTags.length === 0 && (
                    <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Please select at least one tag to continue</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
