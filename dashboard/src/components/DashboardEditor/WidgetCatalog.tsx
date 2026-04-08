import { useState } from "react";
import {
  PieChart,
  BarChart3,
  TrendingUp,
  Hash,
  Table,
  ScatterChart,
  Check,
} from "lucide-react";
import type { WidgetType } from "../../types/dashboard";
import { WIDGET_TYPE_META } from "../../types/dashboard";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  PieChart,
  BarChart3,
  TrendingUp,
  Hash,
  Table,
  ScatterChart,
};

interface WidgetCatalogProps {
  onSelect: (type: WidgetType) => void;
  onClose: () => void;
}

export default function WidgetCatalog({ onSelect, onClose }: WidgetCatalogProps) {
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null);

  const types = Object.entries(WIDGET_TYPE_META) as [WidgetType, (typeof WIDGET_TYPE_META)[WidgetType]][];

  const handleConfirm = () => {
    if (selectedType) {
      onSelect(selectedType);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Add Widget</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-auto">
          {types.map(([type, meta]) => {
            const Icon = ICON_MAP[meta.icon] ?? Hash;
            const isSelected = selectedType === type;
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isSelected ? "text-blue-600" : "text-blue-600"}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-medium ${isSelected ? "text-blue-800" : "text-gray-800"}`}>
                      {meta.label}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{meta.description}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedType}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
