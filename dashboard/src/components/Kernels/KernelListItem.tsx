// KernelListItem.tsx
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
import { getBackendColor } from "../../utils/color";
import type { ColorInstance } from "color";
import Color from "color";
import { twMerge } from "tailwind-merge";

interface ItemTagProps {
  color?: ColorInstance | string;
  colorHash?: string;
  label: string;
  variant?: "default" | "primary" | "secondary";
}

function ItemTag({
  color,
  colorHash,
  label,
  variant = "default",
}: ItemTagProps) {
  if (!color && variant === "default") {
    color = getBackendColor(colorHash || label);
  }

  let tagClasses =
    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors";

  if (variant === "primary") {
    tagClasses += " bg-blue-100 text-blue-800 border border-blue-200";
  } else if (variant === "secondary") {
    tagClasses += " bg-gray-100 text-gray-700 border border-gray-200";
  } else {
    const colorStr = Color(color).lighten(0.4).string();
    const textColor = Color(color).darken(0.3).string();
    return (
      <div
        style={{ backgroundColor: colorStr, color: textColor }}
        className={tagClasses}
      >
        {label}
      </div>
    );
  }

  return <div className={tagClasses}>{label}</div>;
}

interface TuningConfigViewProps {
  config: TuningConfig;
}

function TuningConfigView({ config }: TuningConfigViewProps) {
  const ignoredAttributes = new Set([
    "arithmetic_intensity",
    "mean_microseconds",
    // "tflops",
    "problem",
  ]);

  const formatValue = (value: any): string => {
    if (Array.isArray(value)) {
      return value.join(", ");
    } else if (typeof value === "object" && value !== null) {
      return Object.entries(value)
        .map(([k, v]) => `${k} = ${v}`)
        .join(", ");
    }
    return String(value);
  };

  const formatAttributeName = (name: string): string => {
    return name
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="w-4 h-4 text-gray-500" />
        <div className="text-sm text-gray-600 font-medium">
          Tuning Configuration
        </div>
        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {getTimeStringRelative(config.timestamp)}
        </div>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {Object.entries(config.result.hyperparams)
          .filter(([key]) => !ignoredAttributes.has(key))
          .map(([key, value]) => (
            <div key={key} className="text-sm">
              <span className="font-medium text-gray-700">
                {formatAttributeName(key)}:
              </span>{" "}
              <span className="text-gray-600">{formatValue(value)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

interface KernelListItemProps {
  kernel: KernelConfig;
  index: number;
  tuningResults?: TuningConfig[];
  inProgress?: boolean;
  isActive?: boolean;
  onToggle?: (id: string, state: boolean) => void;
  onMouseDown?: (index: number) => void;
  onMouseUp?: (index: number) => void;
}

export function KernelListItem({
  kernel,
  index,
  tuningResults,
  inProgress = false,
  isActive = false,
  onToggle,
  onMouseDown,
  onMouseUp,
}: KernelListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  tuningResults = tuningResults || [];
  const lastTuned =
    tuningResults.length > 0
      ? getTimeStringRelative(tuningResults[0].timestamp)
      : "Never";

  const hasTuningConfigs = tuningResults.length > 0;

  const handleMainClick = () => {
    if (hasTuningConfigs) {
      setIsExpanded(!isExpanded);
    } else if (onToggle) {
      onToggle(kernel._id, !isActive);
    }
  };

  // Determine the card styling based on state
  const getCardClasses = () => {
    const baseClasses =
      "w-full bg-white rounded-lg border-2 shadow-sm transition-all duration-200 hover:shadow-md";

    if (isActive) {
      return `${baseClasses} border-purple-400 bg-purple-50 shadow-purple-100`;
    } else if (hasTuningConfigs) {
      return `${baseClasses} border-blue-200 hover:border-blue-300 hover:bg-blue-50`;
    } else {
      return `${baseClasses} border-gray-200 hover:border-gray-300 hover:bg-gray-50`;
    }
  };

  const getWorkflowLabel = (workflow: WorkflowType) => {
    if (workflow === "all") return "All Benchmarks";
    if (workflow === "e2e") return "E2E Only";
    return "Disabled";
  };

  return (
    <div className={getCardClasses()}>
      <div
        className={twMerge(
          "cursor-pointer select-none flex items-center justify-between w-full p-2",
          hasTuningConfigs && isExpanded ? "border-b border-gray-200" : ""
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
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {onToggle && (
            <div className="flex-shrink-0">
              <input
                type="checkbox"
                className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
                checked={isActive}
                onChange={() => onToggle(kernel._id, !isActive)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {hasTuningConfigs && (
            <div className="flex-shrink-0">
              <ChevronRight
                className={twMerge(
                  "w-4 h-4 text-gray-400 transition-transform duration-200",
                  isExpanded ? "rotate-90" : ""
                )}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <ItemTag label={toTitleCase(kernel.kernelType)} variant="primary" />
            <ItemTag label={kernel.tag} variant="secondary" />
            <div className="w-2"></div>

            {Object.entries(kernel.problem).map(([dimName, dimValue]) => (
              <ItemTag
                key={`${dimName}_${dimValue}`}
                label={`${dimName} = ${dimValue}`}
                colorHash={`dim_${dimName}`}
              />
            ))}

            <div className="w-2"></div>
            <ItemTag label={getWorkflowLabel(kernel.workflow)} />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600 flex-shrink-0">
          {inProgress ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-blue-600 font-medium">
                Tuning in progress...
              </span>
            </>
          ) : (
            <>
              <Clock className="w-4 h-4" />
              <span>Last tuned: {lastTuned}</span>
            </>
          )}
          {hasTuningConfigs && (
            <div className="flex items-center gap-1 ml-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-green-600 font-medium">
                {tuningResults.length} config
                {tuningResults.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {hasTuningConfigs && isExpanded && (
        <div className="p-4 bg-gray-50 space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Tuning Configurations
          </h3>
          {tuningResults.map((config) => (
            <TuningConfigView key={config._id} config={config} />
          ))}
        </div>
      )}
    </div>
  );
}
