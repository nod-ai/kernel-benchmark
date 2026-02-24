import { Cpu, X, Plus } from "lucide-react";
import { SUPPORTED_BACKENDS } from "../../../types";
import type { BackendSpec } from "../../../types";
import { getBackendSpecsByType } from "../../../utils/backendSpecs";
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
  const [selectedBackend, setSelectedBackend] = useState<string>("");
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [showCustomModal, setShowCustomModal] = useState<string | null>(null);
  
  const backendSpecsByType = getBackendSpecsByType();

  // Remove a backend spec from the list
  const handleRemove = (index: number) => {
    onChange(selectedBackendSpecs.filter((_, i) => i !== index));
  };

  // Add a new backend spec
  const handleAdd = () => {
    if (!selectedBackend || !selectedVariant) return;

    if (selectedVariant === "__ADD_CUSTOM__") {
      setShowCustomModal(selectedBackend);
      return;
    }

    const spec = backendSpecsByType[selectedBackend]?.find(
      (s) => s.id === selectedVariant
    );

    if (spec) {
      onChange([...selectedBackendSpecs, spec]);
      setSelectedBackend("");
      setSelectedVariant("");
    }
  };

  // Handle custom spec creation
  const handleCustomSpecCreate = (customSpec: BackendSpec) => {
    onChange([...selectedBackendSpecs, customSpec]);
    setShowCustomModal(null);
    setSelectedBackend("");
    setSelectedVariant("");
  };

  // Get available variants for selected backend
  const availableVariants = selectedBackend
    ? backendSpecsByType[selectedBackend] || []
    : [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-8 h-8 bg-orange-100 rounded-lg">
          <Cpu className="w-4 h-4 text-orange-600" />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">Backend Specifications *</h4>
          <p className="text-sm text-gray-600">
            Add one or more backends to benchmark
          </p>
        </div>
      </div>

      {/* Selected backends list */}
      {selectedBackendSpecs.length > 0 && (
        <div className="mb-4 space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Selected Backends:
          </label>
          <div className="space-y-2">
            {selectedBackendSpecs.map((spec, index) => (
              <div
                key={`${spec.id}-${index}`}
                className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{spec.name}</div>
                  {spec.backendParam && spec.backendParam !== spec.backend && (
                    <div className="text-xs text-gray-600 font-mono">
                      CLI: --backend {spec.backendParam}
                    </div>
                  )}
                  {spec.remoteRepository && (
                    <div className="text-xs text-gray-500 mt-1">
                      {spec.remoteRepository} @ {spec.branch || "main"}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  disabled={disabled}
                  className="ml-3 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add backend form */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Add Backend:
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Backend type selector */}
          <div>
            <select
              value={selectedBackend}
              onChange={(e) => {
                setSelectedBackend(e.target.value);
                setSelectedVariant("");
              }}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select Backend Type</option>
              {SUPPORTED_BACKENDS.map((backend) => (
                <option key={backend} value={backend}>
                  {backend.charAt(0).toUpperCase() + backend.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Variant selector */}
          <div>
            <select
              value={selectedVariant}
              onChange={(e) => setSelectedVariant(e.target.value)}
              disabled={disabled || !selectedBackend}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select Specification</option>
              {availableVariants.map((spec) => (
                <option key={spec.id} value={spec.id}>
                  {spec.name}
                </option>
              ))}
              {selectedBackend && (
                <option value="__ADD_CUSTOM__" className="font-semibold text-blue-600">
                  + Add new backend specification
                </option>
              )}
            </select>
          </div>
        </div>

        {/* Add button */}
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled || !selectedBackend || !selectedVariant}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add Backend
        </button>
      </div>

      {selectedBackendSpecs.length === 0 && (
        <p className="text-sm text-amber-600 mt-3">
          Please add at least one backend
        </p>
      )}

      {/* Custom Backend Specification Modal */}
      {showCustomModal && (
        <CustomBackendSpecModal
          backend={showCustomModal}
          onSave={(customSpec) => handleCustomSpecCreate(customSpec)}
          onCancel={() => {
            setShowCustomModal(null);
            setSelectedBackend("");
            setSelectedVariant("");
          }}
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
              What to pass to --backend flag (defaults to "{backend}" if empty)
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
