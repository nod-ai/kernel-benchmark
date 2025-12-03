import { FaUser, FaCode } from "react-icons/fa";

export type ViewMode = "user-friendly" | "engineer-friendly";

interface ViewToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export default function ViewToggle({
  currentView,
  onViewChange,
}: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
      <button
        onClick={() => onViewChange("user-friendly")}
        className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 text-sm font-medium ${
          currentView === "user-friendly"
            ? "bg-white text-blue-600 shadow-sm"
            : "text-gray-600 hover:text-gray-800"
        }`}
      >
        <FaUser className="text-xs" />
        User Friendly
      </button>
      <button
        onClick={() => onViewChange("engineer-friendly")}
        className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 text-sm font-medium ${
          currentView === "engineer-friendly"
            ? "bg-white text-blue-600 shadow-sm"
            : "text-gray-600 hover:text-gray-800"
        }`}
      >
        <FaCode className="text-xs" />
        Engineer Friendly
      </button>
    </div>
  );
}
