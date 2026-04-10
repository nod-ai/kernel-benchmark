import { Plus, Save, X, Pencil, GripVertical, Lock, Download, Pin, PinOff } from "lucide-react";

interface EditToolbarProps {
  isEditing: boolean;
  isSaving?: boolean;
  isAuthenticated: boolean;
  onToggleEdit: () => void;
  onRequestAuth: () => void;
  onAddWidget: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onDownloadCsv: () => void;
  hasUnsavedChanges: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  showPin?: boolean;
}

export default function EditToolbar({
  isEditing,
  isSaving = false,
  isAuthenticated,
  onToggleEdit,
  onRequestAuth,
  onAddWidget,
  onSave,
  onDiscard,
  onDownloadCsv,
  hasUnsavedChanges,
  isPinned = false,
  onTogglePin,
  showPin = false,
}: EditToolbarProps) {
  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        {!isAuthenticated ? (
          <button
            onClick={onRequestAuth}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 border border-gray-200 hover:border-gray-300 hover:text-gray-500 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            View only — Authenticate to edit
          </button>
        ) : (
          <button
            onClick={onToggleEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Dashboard
          </button>
        )}
        <button
          onClick={onDownloadCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download as CSV
        </button>
        {showPin && onTogglePin && (
          <button
            onClick={onTogglePin}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              isPinned
                ? "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400"
                : "text-gray-600 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            }`}
            title={isPinned ? "Unpin from home" : "Pin to home"}
          >
            {isPinned ? (
              <PinOff className="w-3.5 h-3.5" />
            ) : (
              <Pin className="w-3.5 h-3.5" />
            )}
            {isPinned ? "Unpin" : "Pin to Home"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex items-center justify-between bg-amber-50 border-2 border-amber-300 rounded-lg px-5 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <GripVertical className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-bold text-amber-800 uppercase tracking-wide">
            Edit Mode
          </span>
        </div>
        <span className="text-xs text-amber-600">
          Drag widgets to rearrange &bull; Click gear to configure
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onAddWidget}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Widget
        </button>
        <button
          onClick={onSave}
          disabled={!hasUnsavedChanges || isSaving}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onDiscard}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}
