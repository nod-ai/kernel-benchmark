import { Cpu, ChevronDown, Info } from "lucide-react";
import { SUPPORTED_BACKENDS, BackendSpec } from "../../../types";
import {
  getBackendSpecsByType,
  getDefaultBackendSpec,
} from "../../../utils/backendSpecs";
import { useState } from "react";

interface BackendSelectorProps {
  selectedBackendSpecs: BackendSpec[];
  onChange: (specs: BackendSpec[]) => void;
  disabled?: boolean;
}

export default function BackendSelector({
  selectedBackendSpecs,
  onChange,
  disabled = false,
}: BackendSelectorProps) {
  const [expandedBackend, setExpandedBackend] = useState<string | null>(null);
  const backendSpecsByType = getBackendSpecsByType();

  // Check if a backend type is selected (any variant)
  const isBackendTypeSelected = (backend: string) => {
    return selectedBackendSpecs.some((spec) => spec.backend === backend);
  };

  // Get the selected spec for a backend type
  const getSelectedSpec = (backend: string): BackendSpec | undefined => {
    return selectedBackendSpecs.find((spec) => spec.backend === backend);
  };

  // Toggle backend on/off (defaults to default spec)
  const handleBackendToggle = (backend: string) => {
    if (isBackendTypeSelected(backend)) {
      // Remove all specs of this backend type
      onChange(selectedBackendSpecs.filter((spec) => spec.backend !== backend));
    } else {
      // Add default spec
      const defaultSpec = getDefaultBackendSpec(backend);
      if (defaultSpec) {
        onChange([...selectedBackendSpecs, defaultSpec]);
      }
    }
  };

  // Change the variant for a backend
  const handleVariantChange = (backend: string, specId: string) => {
    const newSpec = backendSpecsByType[backend]?.find((s) => s.id === specId);
    if (newSpec) {
      onChange([
        ...selectedBackendSpecs.filter((spec) => spec.backend !== backend),
        newSpec,
      ]);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-8 h-8 bg-orange-100 rounded-lg">
          <Cpu className="w-4 h-4 text-orange-600" />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">Backends *</h4>
          <p className="text-sm text-gray-600">
            Select which backends to benchmark and their variants
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {SUPPORTED_BACKENDS.map((backend) => {
          const isSelected = isBackendTypeSelected(backend);
          const selectedSpec = getSelectedSpec(backend);
          const variants = backendSpecsByType[backend] || [];
          const hasVariants = variants.length > 1;

          return (
            <div key={backend} className="space-y-2">
              {/* Backend toggle button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBackendToggle(backend)}
                  disabled={disabled}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-orange-600 text-white border-2 border-orange-700"
                      : "bg-gray-100 text-gray-700 border-2 border-gray-300 hover:bg-gray-200"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="capitalize">{backend}</span>
                </button>

                {/* Variant selector dropdown */}
                {isSelected && hasVariants && (
                  <div className="relative">
                    <select
                      value={selectedSpec?.id || ""}
                      onChange={(e) => handleVariantChange(backend, e.target.value)}
                      disabled={disabled}
                      className="px-3 py-2.5 pr-8 border-2 border-orange-600 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-orange-500 focus:border-orange-600 outline-none appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ minWidth: "200px" }}
                    >
                      {variants.map((spec) => (
                        <option key={spec.id} value={spec.id}>
                          {spec.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                )}

                {/* Info button for selected spec */}
                {isSelected && selectedSpec && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedBackend(
                        expandedBackend === backend ? null : backend
                      )
                    }
                    className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Show backend details"
                  >
                    <Info className="w-4 h-4 text-gray-600" />
                  </button>
                )}
              </div>

              {/* Expanded backend info */}
              {isSelected && selectedSpec && expandedBackend === backend && (
                <div className="ml-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1.5">
                  <div className="flex gap-2">
                    <span className="font-semibold text-gray-600 min-w-[80px]">
                      Name:
                    </span>
                    <span className="text-gray-800">{selectedSpec.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-gray-600 min-w-[80px]">
                      Repository:
                    </span>
                    <span className="text-gray-800 font-mono">
                      {selectedSpec.remoteRepository}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-gray-600 min-w-[80px]">
                      Branch:
                    </span>
                    <span className="text-gray-800 font-mono">
                      {selectedSpec.branch}
                    </span>
                  </div>
                  {selectedSpec.commitHash && (
                    <div className="flex gap-2">
                      <span className="font-semibold text-gray-600 min-w-[80px]">
                        Commit:
                      </span>
                      <span className="text-gray-800 font-mono">
                        {selectedSpec.commitHash}
                      </span>
                    </div>
                  )}
                  {!selectedSpec.commitHash && (
                    <div className="flex gap-2">
                      <span className="font-semibold text-gray-600 min-w-[80px]">
                        Commit:
                      </span>
                      <span className="text-gray-500 italic">
                        Latest from branch
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedBackendSpecs.length === 0 && (
        <p className="text-sm text-amber-600 mt-3">
          Please select at least one backend
        </p>
      )}
    </div>
  );
}
