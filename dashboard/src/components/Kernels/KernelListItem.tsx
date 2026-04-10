import { useState } from "react";
import {
  ChevronRight,
  Clock,
  Settings,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { KernelConfig, TuningConfig, WorkflowType } from "../../types";
import { getTimeStringRelative, toTitleCase } from "../../utils/utils";
import { twMerge } from "tailwind-merge";

function TuningConfigView({ config }: { config: TuningConfig }) {
  const ignoredAttributes = new Set([
    "arithmetic_intensity",
    "mean_microseconds",
    "problem",
  ]);

  const formatValue = (value: any): string => {
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object" && value !== null)
      return Object.entries(value)
        .map(([k, v]) => `${k} = ${v}`)
        .join(", ");
    return String(value);
  };

  const formatAttributeName = (name: string): string =>
    name
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-600 font-medium">
          Tuning Configuration
        </span>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {getTimeStringRelative(config.timestamp)}
        </span>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {Object.entries(config.result.hyperparams)
          .filter(([key]) => !ignoredAttributes.has(key))
          .map(([key, value]) => (
            <div key={key} className="text-sm">
              <span className="font-medium text-gray-700">
                {formatAttributeName(key)}:
              </span>{" "}
              <span className="text-gray-500">{formatValue(value)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

const WORKFLOW_LABELS: Record<WorkflowType, string> = {
  all: "All Benchmarks",
  e2e: "E2E Only",
  none: "Disabled",
};

interface KernelListItemProps {
  kernel: KernelConfig;
  index: number;
  tuningResults?: TuningConfig[];
  inProgress?: boolean;
  isActive?: boolean;
  onToggle?: (id: string, state: boolean) => void;
  onMouseDown?: (index: number) => void;
  onMouseUp?: (index: number) => void;
  attributeOrder?: string[];
  hideTag?: boolean;
}

export function KernelListItem({
  kernel,
  index,
  tuningResults = [],
  inProgress = false,
  isActive = false,
  onToggle,
  onMouseDown,
  onMouseUp,
  attributeOrder,
  hideTag = false,
}: KernelListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const lastTuned =
    tuningResults.length > 0
      ? getTimeStringRelative(tuningResults[0].timestamp)
      : null;
  const hasTuningConfigs = tuningResults.length > 0;

  const handleMainClick = () => {
    if (hasTuningConfigs) {
      setIsExpanded(!isExpanded);
    } else if (onToggle) {
      onToggle(kernel._id, !isActive);
    }
  };

  return (
    <div
      className={twMerge(
        "w-full rounded-lg border transition-all duration-150",
        isActive
          ? "border-blue-400 bg-blue-50/60 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50"
      )}
    >
      <div
        className={twMerge(
          "cursor-pointer select-none flex items-center justify-between w-full px-3 py-2",
          hasTuningConfigs && isExpanded ? "border-b border-gray-100" : ""
        )}
        onClick={handleMainClick}
        onMouseDown={(e) => {
          if (onMouseDown) onMouseDown(index);
          e.stopPropagation();
        }}
        onMouseUp={(e) => {
          if (onMouseUp) onMouseUp(index);
          e.stopPropagation();
        }}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {onToggle && (
            <input
              type="checkbox"
              className="w-4 h-4 flex-shrink-0 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              checked={isActive}
              onChange={() => onToggle(kernel._id, !isActive)}
              onClick={(e) => e.stopPropagation()}
            />
          )}

          {hasTuningConfigs && (
            <ChevronRight
              className={twMerge(
                "w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform duration-150",
                isExpanded ? "rotate-90" : ""
              )}
            />
          )}

          {/* Identifiers */}
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {toTitleCase(kernel.kernelType)}
          </span>
          {!hideTag && (
            <span className="text-xs text-gray-500 font-mono truncate max-w-[120px]">
              {kernel.tag}
            </span>
          )}

          {/* Problem dimensions (ordered by kernel type definition when available) */}
          <span className="text-gray-300 select-none">|</span>
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {(attributeOrder
              ? attributeOrder
                  .filter((name) => name in kernel.problem)
                  .map((name) => [name, kernel.problem[name]] as const)
                  .concat(
                    Object.entries(kernel.problem).filter(
                      ([name]) => !attributeOrder.includes(name)
                    )
                  )
              : Object.entries(kernel.problem)
            ).map(([dimName, dimValue]) => (
              <span
                key={dimName}
                className="inline-flex items-center text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded"
              >
                <span className="font-medium text-gray-700">{dimName}</span>
                <span className="text-gray-300 mx-1">=</span>
                {String(dimValue)}
              </span>
            ))}
          </div>
        </div>

        {/* Right side: status */}
        <div className="flex items-center gap-3 text-xs text-gray-400 flex-shrink-0 ml-3">
          <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-500">
            {WORKFLOW_LABELS[kernel.workflow]}
          </span>

          {inProgress ? (
            <span className="flex items-center gap-1.5 text-blue-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Tuning...
            </span>
          ) : lastTuned ? (
            <span className="flex items-center gap-1.5" title="Last tuned">
              <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />
              {lastTuned}
            </span>
          ) : (
            <span className="flex items-center gap-1.5" title="Never tuned">
              <Clock className="w-3.5 h-3.5" />
              Not tuned
            </span>
          )}
        </div>
      </div>

      {hasTuningConfigs && isExpanded && (
        <div className="p-4 bg-gray-50/50 space-y-3">
          <h3 className="font-medium text-gray-700 text-sm flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" />
            Tuning Configurations
            <span className="text-xs text-gray-400 font-normal">
              ({tuningResults.length})
            </span>
          </h3>
          {tuningResults.map((config) => (
            <TuningConfigView key={config._id} config={config} />
          ))}
        </div>
      )}
    </div>
  );
}
