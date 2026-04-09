import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronUp, ChevronDown, Activity } from "lucide-react";
import type { WidgetProps } from "../types/dashboard";
import { resolveField } from "../utils/pipeline";
import { findDumpKeyForKernel } from "../utils/rocprof";

export default function TableWidget({
  config,
  data,
  profilingManifest,
  blobName,
}: WidgetProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const navigate = useNavigate();

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

  const hasRocprof = !!profilingManifest;

  const handleTraceClick = (row: Record<string, any>) => {
    const name = String(row.name || "");
    if (!name || !blobName || !profilingManifest) return;
    const dumpKey = findDumpKeyForKernel(profilingManifest, name, row.backend);
    if (dumpKey) {
      navigate(
        `/trace/${encodeURIComponent(blobName)}?dumpKey=${encodeURIComponent(dumpKey)}&kernel=${encodeURIComponent(name)}`
      );
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
            {hasRocprof && (
              <th className="px-2 py-2 font-medium whitespace-nowrap w-8">
                <Activity className="w-3.5 h-3.5 text-gray-400" />
              </th>
            )}
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
          {sorted.map((row, i) => {
            const kernelName = String(row.name || "");
            const dumpKey = hasRocprof
              ? findDumpKeyForKernel(profilingManifest!, kernelName, row.backend)
              : null;

            return (
              <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                {hasRocprof && (
                  <td className="px-2 py-2 whitespace-nowrap">
                    {dumpKey ? (
                      <button
                        onClick={() => handleTraceClick(row)}
                        className="text-emerald-600 hover:text-emerald-700 transition-colors"
                        title="View kernel trace"
                      >
                        <Activity className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-gray-200">
                        <Activity className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>
                )}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
