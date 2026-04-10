import { Filter, FileText } from "lucide-react";
import type { RunTypeFilter } from "./types";

const TYPE_OPTIONS: { value: RunTypeFilter; label: string }[] = [
  { value: "ALL", label: "ALL" },
  { value: "manual_bench", label: "Manual Bench" },
  { value: "pr_update", label: "PR Update" },
  { value: "manual_tuning", label: "Tuning" },
  { value: "scheduled", label: "Scheduled" },
];

interface RunFiltersProps {
  typeFilter: RunTypeFilter;
  onTypeFilterChange: (filter: RunTypeFilter) => void;
  onlyWithArtifacts: boolean;
  onArtifactsToggle: () => void;
}

export default function RunFilters({
  typeFilter,
  onTypeFilterChange,
  onlyWithArtifacts,
  onArtifactsToggle,
}: RunFiltersProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Filter className="w-4 h-4 text-gray-400" />
      {TYPE_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onTypeFilterChange(value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            typeFilter === value
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {label}
        </button>
      ))}

      <button
        onClick={onArtifactsToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
          onlyWithArtifacts
            ? "bg-purple-600 text-white shadow-sm"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
      >
        <FileText className="w-3.5 h-3.5" />
        Only With Artifacts
      </button>
    </div>
  );
}
