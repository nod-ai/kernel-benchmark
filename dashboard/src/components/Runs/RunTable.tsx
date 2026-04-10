import { useState } from "react";
import { FileText } from "lucide-react";
import type { RunWithTrigger } from "../../types";
import type { SortColumn, SortState } from "./types";
import SortHeader from "./SortHeader";
import RunRow from "./RunRow";

interface RunTableProps {
  items: RunWithTrigger[];
  sort: SortState;
  onSort: (column: SortColumn) => void;
  onDelete: (runId: string) => void;
  onCancel: (runId: string) => void;
  onNavigate: (blobName: string) => void;
}

export default function RunTable({ items, sort, onSort, onDelete, onCancel, onNavigate }: RunTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full min-w-[700px]">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-3 py-3 w-10" />
            <SortHeader label="Name" column="name" sort={sort} onSort={onSort} />
            <SortHeader label="Type" column="type" sort={sort} onSort={onSort} />
            <SortHeader label="Tracker" column="tracker" sort={sort} onSort={onSort} className="hidden md:table-cell" />
            <SortHeader label="Machine" column="machine" sort={sort} onSort={onSort} className="hidden md:table-cell" />
            <SortHeader label="Date" column="date" sort={sort} onSort={onSort} />
            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-10">
              <span title="Artifact"><FileText className="w-3.5 h-3.5 mx-auto opacity-50" /></span>
            </th>
            <th className="px-3 py-3 w-20" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const id = item.run?._id || item.trigger?._id || "";
            return (
              <RunRow
                key={id}
                item={item}
                isExpanded={expandedIds.has(id)}
                onToggleExpand={() => toggleExpand(id)}
                onDelete={onDelete}
                onCancel={onCancel}
                onNavigate={onNavigate}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
