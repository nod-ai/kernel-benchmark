import { Monitor } from "lucide-react";
import { AVAILABLE_MACHINES } from "../../../types";

interface MachineSelectorProps {
  machine: string;
  onChange: (machine: string) => void;
  disabled?: boolean;
}

export default function MachineSelector({
  machine,
  onChange,
  disabled = false,
}: MachineSelectorProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg">
          <Monitor className="w-4 h-4 text-green-600" />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">Target Machine *</h4>
          <p className="text-sm text-gray-600">
            Hardware platform for benchmark execution
          </p>
        </div>
      </div>
      <div className="flex flex-row gap-3 w-full">
        {AVAILABLE_MACHINES.map((availableMachine) => (
          <label
            key={availableMachine}
            className="flex grow items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <input
              type="radio"
              name="machine"
              value={availableMachine}
              checked={machine === availableMachine}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span className="font-medium text-gray-900">
              {availableMachine}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
