import type { DispatchResult } from "../../utils/rocprof";

interface DispatchSelectorProps {
  dispatches: DispatchResult[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export default function DispatchSelector({
  dispatches,
  selectedIndex,
  onSelect,
}: DispatchSelectorProps) {
  if (dispatches.length <= 1) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Select Dispatch
      </h3>
      <div className="flex flex-wrap gap-2">
        {dispatches.map((d, i) => (
          <button
            key={d.id}
            onClick={() => onSelect(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              i === selectedIndex
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            }`}
          >
            <span className="font-semibold">Dispatch {d.id}</span>
            <span className="ml-2 text-xs opacity-75">{d.mfmaCount} MFMA</span>
          </button>
        ))}
      </div>
    </div>
  );
}
