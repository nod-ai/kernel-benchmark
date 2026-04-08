import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { WidgetProps } from "../types/dashboard";
import { resolveField } from "../utils/pipeline";

/**
 * Sortable data table.
 *
 * Columns are auto-detected from the first row's keys, or can be
 * restricted via mapping: set mapping.x to a comma-separated column list.
 */
export default function TableWidget({ config, data }: WidgetProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const columns = useMemo(() => {
    if (config.mapping.x) return config.mapping.x.split(",").map((s) => s.trim());
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  }, [config.mapping.x, data]);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      const aVal = resolveField(a, sortKey);
      const bVal = resolveField(b, sortKey);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const handleSort = (col: string) => {
    if (sortKey === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col);
      setSortDir("asc");
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No data for table
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm text-left">
        <thead className="sticky top-0 bg-gray-50 text-gray-600">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 font-medium cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap"
                onClick={() => handleSort(col)}
              >
                <span className="flex items-center gap-1">
                  {col}
                  {sortKey === col &&
                    (sortDir === "asc" ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
              {columns.map((col) => {
                const val = resolveField(row, col);
                const display =
                  val == null
                    ? ""
                    : typeof val === "number"
                      ? val % 1 === 0
                        ? val.toLocaleString()
                        : val.toFixed(3)
                      : String(val);
                return (
                  <td key={col} className="px-3 py-2 whitespace-nowrap text-gray-700">
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
