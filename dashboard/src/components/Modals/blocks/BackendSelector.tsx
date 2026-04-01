import { Cpu, ChevronDown, Plus } from "lucide-react";
import { SUPPORTED_BACKENDS } from "../../../types";
import type { BackendSpec } from "../../../types";
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
  const [showCustomModal, setShowCustomModal] = useState<string | null>(null);
  const backendSpecsByType = getBackendSpecsByType();

  // Check if a backend type is selected (any variant)
  const isBackendTypeSelected = (backend: string) => {
    return selectedBackendSpecs.some((spec) => spec.backend === backend);
  };

  // Check if a specific spec is selected
  const isSpecSelected = (specId: string) => {
    return selectedBackendSpecs.some((spec) => spec.id === specId);
  };

  // Get all selected specs for a backend type
  const getSelectedSpecs = (backend: string): BackendSpec[] => {
    return selectedBackendSpecs.filter((spec) => spec.backend === backend);
  };

  // Toggle backend on/off (defaults to default spec)
  const handleBackendToggle = (backend: string) => {
    if (isBackendTypeSelected(backend)) {
      // Remove all specs of this backend type
      onChange(selectedBackendSpecs.filter((spec) => spec.backend !== backend));
      if (expandedBackend === backend) {
        setExpandedBackend(null);
      }
    } else {
      // Add default spec
      const defaultSpec = getDefaultBackendSpec(backend);
      if (defaultSpec) {
        onChange([...selectedBackendSpecs, defaultSpec]);
      }
    }
  };

  // Toggle a specific variant on/off
  const handleVariantToggle = (backend: string, specId: string) => {
    const spec = backendSpecsByType[backend]?.find((s) => s.id === specId);
    if (!spec) return;

    if (isSpecSelected(specId)) {
      // Remove this spec
      const remaining = selectedBackendSpecs.filter((s) => s.id !== specId);
      onChange(remaining);
    } else {
      // Add this spec
      onChange([...selectedBackendSpecs, spec]);
    }
  };

  // Handle custom spec creation
  const handleCustomSpecCreate = (customSpec: BackendSpec) => {
    onChange([...selectedBackendSpecs, customSpec]);
    setShowCustomModal(null);
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SUPPORTED_BACKENDS.map((backend) => {
          const isSelected = isBackendTypeSelected(backend);
          const selectedSpecs = getSelectedSpecs(backend);
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
                  <span className="capitalize">
                    {backend}
                    {selectedSpecs.length > 1 && (
                      <span className="ml-1 text-xs opacity-80">
                        ({selectedSpecs.length} selected)
                      </span>
                    )}
                  </span>
                </button>

                {/* Expand/collapse variants */}
                {isSelected && hasVariants && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedBackend(
                        expandedBackend === backend ? null : backend
                      )
                    }
                    disabled={disabled}
                    className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Show variants"
                  >
                    <ChevronDown
                      className={`w-4 h-4 text-gray-600 transition-transform ${
                        expandedBackend === backend ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                )}
              </div>

              {/* Variant checkboxes (multi-select) */}
              {isSelected && hasVariants && expandedBackend === backend && (
                <div className="ml-2 space-y-1">
                  {variants.map((spec) => {
                    const checked = isSpecSelected(spec.id);
                    return (
                      <label
                        key={spec.id}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          checked
                            ? "bg-orange-50 border-orange-300"
                            : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleVariantToggle(backend, spec.id)}
                          disabled={disabled}
                          className="mt-0.5 w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {spec.name}
                          </div>
                          {spec.backendParam && spec.backendParam !== spec.backend && (
                            <div className="text-xs text-gray-600 font-mono">
                              CLI: --backend {spec.backendParam}
                            </div>
                          )}
                          {spec.remoteRepository && (
                            <div className="text-xs text-gray-500 font-mono truncate">
                              {spec.remoteRepository}
                              {spec.branch && ` @ ${spec.branch}`}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}

                  {/* Add custom spec button */}
                  <button
                    type="button"
                    onClick={() => setShowCustomModal(backend)}
                    disabled={disabled}
                    className="flex items-center gap-2 w-full p-2.5 rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    Add custom specification
                  </button>
                </div>
              )}

              {/* Single variant info (for backends with only one spec) */}
              {isSelected && !hasVariants && selectedSpecs[0] && expandedBackend === backend && (
                <div className="ml-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1.5">
                  <div className="flex gap-2">
                    <span className="font-semibold text-gray-600 min-w-[80px]">
                      Name:
                    </span>
                    <span className="text-gray-800">{selectedSpecs[0].name}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-gray-600 min-w-[80px]">
                      Repository:
                    </span>
                    <span className="text-gray-800 font-mono">
                      {selectedSpecs[0].remoteRepository}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-gray-600 min-w-[80px]">
                      Branch:
                    </span>
                    <span className="text-gray-800 font-mono">
                      {selectedSpecs[0].branch}
                    </span>
                  </div>
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

      {/* Custom Backend Specification Modal */}
      {showCustomModal && (
        <CustomBackendSpecModal
          backend={showCustomModal}
          onSave={(customSpec) => handleCustomSpecCreate(customSpec)}
          onCancel={() => setShowCustomModal(null)}
        />
      )}
    </div>
  );
}

// Custom Backend Specification Modal Component
interface CustomBackendSpecModalProps {
  backend: string;
  onSave: (spec: BackendSpec) => void;
  onCancel: () => void;
}

function CustomBackendSpecModal({ backend, onSave, onCancel }: CustomBackendSpecModalProps) {
  const [name, setName] = useState(`${backend} (Custom)`);
  const [repository, setRepository] = useState("");
  const [branch, setBranch] = useState("main");
  const [backendParam, setBackendParam] = useState("");

  const handleSave = () => {
    if (!repository.trim()) {
      alert("Please enter a repository URL");
      return;
    }

    const customSpec: BackendSpec = {
      id: `${backend}-custom-${Date.now()}`,
      name: name.trim() || `${backend} (Custom)`,
      backend: backend,
      backendParam: backendParam.trim() || backend,
      remoteRepository: repository.trim(),
      branch: branch.trim() || "main",
      isDefault: false,
    };

    onSave(customSpec);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Add Custom {backend.charAt(0).toUpperCase() + backend.slice(1)} Specification
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              placeholder={`e.g., ${backend} (My Branch)`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CLI Parameter
            </label>
            <input
              type="text"
              value={backendParam}
              onChange={(e) => setBackendParam(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-mono text-sm"
              placeholder={`e.g., ${backend}_custom`}
            />
            <p className="text-xs text-gray-500 mt-1">
              What to pass to --backend flag (defaults to &quot;{backend}&quot; if empty)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Repository *
            </label>
            <input
              type="text"
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-mono text-sm"
              placeholder="owner/repo (e.g., iree-org/wave)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch / Commit
            </label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-mono text-sm"
              placeholder="main"
            />
            <p className="text-xs text-gray-500 mt-1">
              Branch name or full commit hash
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition-colors"
          >
            Add Specification
          </button>
        </div>
      </div>
    </div>
  );
}
