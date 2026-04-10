import { useState, useRef, useEffect } from "react";
import { MoreVertical, Pencil, Merge, Trash2 } from "lucide-react";

interface TagContextMenuProps {
  onRename: () => void;
  onMerge: () => void;
  onDelete: () => void;
}

export default function TagContextMenu({
  onRename,
  onMerge,
  onDelete,
}: TagContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const items = [
    { label: "Rename Tag", icon: Pencil, onClick: onRename, color: "text-gray-700" },
    { label: "Merge into...", icon: Merge, onClick: onMerge, color: "text-gray-700" },
    { label: "Delete All Kernels", icon: Trash2, onClick: onDelete, color: "text-red-600" },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Tag actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                item.onClick();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm ${item.color} hover:bg-gray-50 transition-colors`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
