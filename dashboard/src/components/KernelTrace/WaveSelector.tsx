import type { WaveResult } from "../../utils/rocprof";

interface WaveSelectorProps {
  waves: WaveResult[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export default function WaveSelector({
  waves,
  selectedIndex,
  onSelect,
}: WaveSelectorProps) {
  if (waves.length <= 1) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Wave</h3>
      <div className="flex flex-wrap gap-2">
        {waves.map((w, i) => (
          <button
            key={w.waveName}
            onClick={() => onSelect(i)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              i === selectedIndex
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            }`}
          >
            {w.waveName}
          </button>
        ))}
      </div>
    </div>
  );
}
