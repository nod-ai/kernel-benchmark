import { Cpu } from "lucide-react";
import { SUPPORTED_BACKENDS } from "../../../types";

interface BackendSelectorProps {
  selectedBackends: string[];
  onChange: (backends: string[]) => void;
  disabled?: boolean;
}

export default function BackendSelector({
  selectedBackends,
  onChange,
  disabled = false,
}: BackendSelectorProps) {
  const handleBackendToggle = (backend: string) => {
    if (selectedBackends.includes(backend)) {
      onChange(selectedBackends.filter((b) => b !== backend));
    } else {
      onChange([...selectedBackends, backend]);
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
            Select which backends to benchmark
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {SUPPORTED_BACKENDS.map((backend) => {
          const isSelected = selectedBackends.includes(backend);
          return (
            <button
              key={backend}
              type="button"
              onClick={() => handleBackendToggle(backend)}
              disabled={disabled}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isSelected
                  ? "bg-orange-600 text-white border-2 border-orange-700"
                  : "bg-gray-100 text-gray-700 border-2 border-gray-300 hover:bg-gray-200"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {backend}
            </button>
          );
        })}
      </div>
      {selectedBackends.length === 0 && (
        <p className="text-sm text-amber-600 mt-3">
          Please select at least one backend
        </p>
      )}
    </div>
  );
}
