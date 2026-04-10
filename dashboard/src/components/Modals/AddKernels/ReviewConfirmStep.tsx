import { Check, Tag, Settings, Monitor, AlertTriangle } from "lucide-react";
import {
  AVAILABLE_MACHINES,
  type KernelTypeDefinition,
  type WorkflowType,
} from "../../../types";
import type { KernelInputData } from "../../../utils/kernelTypes";

export interface RuntimeConfig {
  workflow: WorkflowType;
  machines: string[];
}

interface ReviewConfirmStepProps {
  kernelType: KernelTypeDefinition;
  kernels: KernelInputData[];
  config: RuntimeConfig;
  onConfigChange: (config: RuntimeConfig) => void;
  disabled?: boolean;
}

const WORKFLOW_OPTIONS = [
  {
    value: "none" as const,
    label: "Never run (Disabled)",
    desc: "Kernels will be stored but not executed in any workflows",
  },
  {
    value: "e2e" as const,
    label: "End-to-end nightly only",
    desc: "Run only in comprehensive nightly workflows",
  },
  {
    value: "all" as const,
    label: "Both workflows",
    desc: "Run in both quick benchmarks and nightly end-to-end workflows",
  },
];

function formatValue(
  value: string | boolean | number,
  attributeType: string
): string {
  if (attributeType === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export default function ReviewConfirmStep({
  kernelType,
  kernels,
  config,
  onConfigChange,
  disabled = false,
}: ReviewConfirmStepProps) {
  const validKernels = kernels.filter((k) => k.isValid);
  const validCount = validKernels.length;
  const uniqueTags = Array.from(new Set(validKernels.map((k) => k.tag.trim())));

  const toggleMachine = (machine: string) => {
    onConfigChange({
      ...config,
      machines: config.machines.includes(machine)
        ? config.machines.filter((m) => m !== machine)
        : [...config.machines, machine],
    });
  };

  return (
    <div className="space-y-4">
      {/* Kernel Tags Summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
            <Tag className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Kernel Tags</h4>
            <p className="text-sm text-gray-600">
              {validCount} kernel{validCount !== 1 ? "s" : ""} ready
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {uniqueTags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200 font-mono"
            >
              {tag || "(no tag)"}
            </span>
          ))}
        </div>
      </div>

      {/* Machine Selection */}
      <div
        className={`rounded-xl p-5 shadow-sm transition-colors ${
          config.machines.length === 0
            ? "bg-red-50 border-2 border-red-300"
            : "bg-white border border-gray-200"
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-lg ${
              config.machines.length === 0 ? "bg-red-100" : "bg-green-100"
            }`}
          >
            <Monitor
              className={`w-4 h-4 ${
                config.machines.length === 0
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Target Machines *</h4>
            <p className="text-sm text-gray-600">
              Hardware platforms for execution
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {AVAILABLE_MACHINES.map((machine) => (
            <label
              key={machine}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={config.machines.includes(machine)}
                onChange={() => toggleMachine(machine)}
                disabled={disabled}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-medium text-gray-900">
                {machine}
              </span>
            </label>
          ))}
        </div>
        {config.machines.length === 0 && (
          <p className="text-sm text-red-600 font-medium mt-2">
            Please select at least one machine
          </p>
        )}
      </div>

      {/* Workflow Selection */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-lg">
            <Settings className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">
              Workflow Configuration *
            </h4>
            <p className="text-sm text-gray-600">
              Execution scheduling preferences
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {WORKFLOW_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <input
                type="radio"
                name="add-workflow"
                value={opt.value}
                checked={config.workflow === opt.value}
                onChange={() =>
                  onConfigChange({ ...config, workflow: opt.value })
                }
                disabled={disabled}
                className="mt-0.5 border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {opt.label}
                </span>
                <p className="text-xs text-gray-600">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Kernels Review */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
            <Check className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">
              Review {validCount} Kernel{validCount !== 1 ? "s" : ""}
            </h4>
            <p className="text-sm text-gray-600">
              {kernelType.displayName} configuration
            </p>
          </div>
        </div>

        {validCount > 50 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <AlertTriangle className="w-5 h-5 text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              Detailed review hidden for {validCount} kernels. They will still
              be validated and added correctly.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {validKernels.map((kernel, index) => (
              <div
                key={kernel.id}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    Kernel {index + 1}
                  </span>
                  <span className="ml-auto text-xs font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    {kernel.tag}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {kernelType.attributes.map((attr) => (
                    <span
                      key={attr.name}
                      className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200"
                    >
                      <span className="font-medium">{attr.name}:</span>{" "}
                      {formatValue(kernel.values[attr.name], attr.type)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
