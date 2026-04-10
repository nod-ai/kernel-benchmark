import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { SortColumn, SortState } from "./types";

interface SortHeaderProps {
  label: string;
  column: SortColumn;
  sort: SortState;
  onSort: (column: SortColumn) => void;
  className?: string;
}

export default function SortHeader({ label, column, sort, onSort, className = "" }: SortHeaderProps) {
  const isActive = sort.column === column;
  return (
    <th
      className={`px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer select-none hover:text-gray-900 transition-colors ${className}`}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          sort.direction === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  );
}
