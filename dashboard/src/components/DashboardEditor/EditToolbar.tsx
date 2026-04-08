import { Plus, Save, X, Pencil } from "lucide-react";

interface EditToolbarProps {
  isEditing: boolean;
  isSaving?: boolean;
  onToggleEdit: () => void;
  onAddWidget: () => void;
  onSave: () => void;
  onDiscard: () => void;
  hasUnsavedChanges: boolean;
}

export default function EditToolbar({
  isEditing,
  isSaving = false,
  onToggleEdit,
  onAddWidget,
  onSave,
  onDiscard,
  hasUnsavedChanges,
}: EditToolbarProps) {
  if (!isEditing) {
    return (
      <button
        onClick={onToggleEdit}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
        Edit Dashboard
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
      <span className="text-sm font-medium text-amber-800 mr-2">
        Editing
      </span>
      <button
        onClick={onAddWidget}
        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Widget
      </button>
      <button
        onClick={onSave}
        disabled={!hasUnsavedChanges || isSaving}
        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        <Save className="w-3.5 h-3.5" />
        {isSaving ? "Saving..." : "Save"}
      </button>
      <button
        onClick={onDiscard}
        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
        Cancel
      </button>
    </div>
  );
}
