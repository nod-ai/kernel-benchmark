import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Download,
  ChevronRight,
  ChevronDown,
  GripVertical,
  X as XIcon,
} from "lucide-react";
import type { CsvExportColumn } from "../../types/dashboard";

interface FieldNode {
  key: string;
  path: string;
  children: FieldNode[];
}

export interface CsvDownloadModalProps {
  data: Record<string, any>[];
  onClose: () => void;
  isTrackerDashboard?: boolean;
  savedCsvConfig?: CsvExportColumn[] | null;
  onSaveCsvConfig?: (columns: CsvExportColumn[]) => Promise<void>;
}

type CheckState = "checked" | "unchecked" | "indeterminate";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function discoverFieldTree(data: Record<string, any>[]): FieldNode[] {
  type TreeMap = Map<string, TreeMap>;
  const tree: TreeMap = new Map();

  function visit(obj: any, treeNode: TreeMap) {
    if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return;
    for (const key of Object.keys(obj)) {
      if (!treeNode.has(key)) {
        treeNode.set(key, new Map());
      }
      const val = obj[key];
      if (val != null && typeof val === "object" && !Array.isArray(val)) {
        visit(val, treeNode.get(key)!);
      }
    }
  }

  for (const row of data) {
    visit(row, tree);
  }

  function mapToNodes(map: TreeMap, parentPath: string): FieldNode[] {
    const nodes: FieldNode[] = [];
    for (const [key, childMap] of map) {
      const path = parentPath ? `${parentPath}.${key}` : key;
      const children = mapToNodes(childMap, path);
      nodes.push({ key, path, children });
    }
    return nodes;
  }

  return mapToNodes(tree, "");
}

function collectLeafPaths(nodes: FieldNode[]): string[] {
  const paths: string[] = [];
  function walk(node: FieldNode) {
    if (node.children.length === 0) {
      paths.push(node.path);
    } else {
      for (const child of node.children) walk(child);
    }
  }
  for (const n of nodes) walk(n);
  return paths;
}

function resolveValue(row: Record<string, any>, path: string): any {
  const parts = path.split(".");
  let current: any = row;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

function escapeCsvValue(val: any): string {
  if (val == null) return "";
  const str = typeof val === "object" ? JSON.stringify(val) : String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function columnsEqual(
  a: CsvExportColumn[] | null | undefined,
  b: CsvExportColumn[]
): boolean {
  if (!a || a.length !== b.length) return false;
  return a.every(
    (col, i) => col.path === b[i].path && col.renameTo === b[i].renameTo
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function IndeterminateCheckbox({
  state,
  onChange,
}: {
  state: CheckState;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = state === "indeterminate";
    }
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={state === "checked"}
      onChange={onChange}
      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
    />
  );
}

function FieldTreeNode({
  node,
  depth,
  onToggle,
  getSelectionState,
}: {
  node: FieldNode;
  depth: number;
  onToggle: (node: FieldNode) => void;
  getSelectionState: (node: FieldNode) => CheckState;
}) {
  const [expanded, setExpanded] = useState(true);
  const state = getSelectionState(node);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 hover:bg-gray-50/80 rounded-md transition-colors"
        style={{ paddingLeft: depth * 20 + 4 }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 hover:bg-gray-200 rounded flex-shrink-0"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>
        ) : (
          <span className="w-[18px] flex-shrink-0" />
        )}
        <IndeterminateCheckbox
          state={state}
          onChange={() => onToggle(node)}
        />
        <span
          className={`text-sm truncate ${
            hasChildren ? "font-medium text-gray-700" : "text-gray-600"
          }`}
        >
          {node.key}
        </span>
        {hasChildren && (
          <span className="text-xs text-gray-400 flex-shrink-0">
            ({node.children.length})
          </span>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 border-l-2 border-gray-200"
            style={{ left: depth * 20 + 17 }}
          />
          {node.children.map((child) => (
            <FieldTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onToggle={onToggle}
              getSelectionState={getSelectionState}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CsvDownloadModal({
  data,
  onClose,
  isTrackerDashboard = false,
  savedCsvConfig,
  onSaveCsvConfig,
}: CsvDownloadModalProps) {
  const fieldTree = useMemo(() => discoverFieldTree(data), [data]);
  const allLeaves = useMemo(() => collectLeafPaths(fieldTree), [fieldTree]);

  const [selectedColumns, setSelectedColumns] = useState<CsvExportColumn[]>(
    () => {
      if (savedCsvConfig && savedCsvConfig.length > 0) {
        const validPaths = new Set(allLeaves);
        return savedCsvConfig.filter((col) => validPaths.has(col.path));
      }
      return [];
    }
  );

  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Drag-and-drop state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const selectedPathSet = useMemo(
    () => new Set(selectedColumns.map((c) => c.path)),
    [selectedColumns]
  );

  // ---- Tree toggle logic ----

  const toggleNode = useCallback((node: FieldNode) => {
    if (node.children.length === 0) {
      setSelectedColumns((prev) => {
        if (prev.some((c) => c.path === node.path)) {
          return prev.filter((c) => c.path !== node.path);
        }
        return [...prev, { path: node.path, renameTo: node.key }];
      });
    } else {
      const leaves = collectLeafPaths([node]);
      setSelectedColumns((prev) => {
        const currentPaths = new Set(prev.map((c) => c.path));
        const allSelected = leaves.every((p) => currentPaths.has(p));
        if (allSelected) {
          const removeSet = new Set(leaves);
          return prev.filter((c) => !removeSet.has(c.path));
        }
        const toAdd = leaves
          .filter((p) => !currentPaths.has(p))
          .map((p) => ({ path: p, renameTo: p.split(".").pop()! }));
        return [...prev, ...toAdd];
      });
    }
  }, []);

  const getNodeSelectionState = useCallback(
    (node: FieldNode): CheckState => {
      if (node.children.length === 0) {
        return selectedPathSet.has(node.path) ? "checked" : "unchecked";
      }
      const leaves = collectLeafPaths([node]);
      const sel = leaves.filter((p) => selectedPathSet.has(p)).length;
      if (sel === 0) return "unchecked";
      if (sel === leaves.length) return "checked";
      return "indeterminate";
    },
    [selectedPathSet]
  );

  // ---- Bulk actions ----

  const selectAll = useCallback(() => {
    setSelectedColumns((prev) => {
      const currentPaths = new Set(prev.map((c) => c.path));
      const toAdd = allLeaves
        .filter((p) => !currentPaths.has(p))
        .map((p) => ({ path: p, renameTo: p.split(".").pop()! }));
      return [...prev, ...toAdd];
    });
  }, [allLeaves]);

  const deselectAll = useCallback(() => setSelectedColumns([]), []);

  // ---- Right-panel handlers ----

  const handleRename = useCallback((path: string, newName: string) => {
    setSelectedColumns((prev) =>
      prev.map((c) => (c.path === path ? { ...c, renameTo: newName } : c))
    );
  }, []);

  const handleRemove = useCallback((path: string) => {
    setSelectedColumns((prev) => prev.filter((c) => c.path !== path));
  }, []);

  // ---- Drag-and-drop reorder ----
  // overIdx is an *insertion gap* index: 0 = before first item, N = after last.

  const handleDragStart = useCallback(
    (e: React.DragEvent, idx: number) => {
      setDragIdx(idx);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(idx));
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      setOverIdx(e.clientY > midY ? idx + 1 : idx);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (dragIdx === null || overIdx === null) {
        setDragIdx(null);
        setOverIdx(null);
        return;
      }
      const insertAt = dragIdx < overIdx ? overIdx - 1 : overIdx;
      if (insertAt !== dragIdx) {
        setSelectedColumns((prev) => {
          const next = [...prev];
          const [moved] = next.splice(dragIdx, 1);
          next.splice(insertAt, 0, moved);
          return next;
        });
      }
      setDragIdx(null);
      setOverIdx(null);
    },
    [dragIdx, overIdx]
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  // ---- Download ----

  const handleDownload = useCallback(() => {
    if (selectedColumns.length === 0) return;

    const headers = selectedColumns.map((c) => escapeCsvValue(c.renameTo));
    const rows = data.map((row) =>
      selectedColumns.map((c) => escapeCsvValue(resolveValue(row, c.path)))
    );

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kernel-data.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (isTrackerDashboard && onSaveCsvConfig) {
      const hasExisting = savedCsvConfig && savedCsvConfig.length > 0;
      const changed = !columnsEqual(savedCsvConfig, selectedColumns);
      if (!hasExisting || changed) {
        setShowSavePrompt(true);
        return;
      }
    }

    onClose();
  }, [selectedColumns, data, isTrackerDashboard, onSaveCsvConfig, savedCsvConfig, onClose]);

  // ---- Save config (tracker only) ----

  const handleSaveConfig = useCallback(async () => {
    if (!onSaveCsvConfig) return;
    setIsSavingConfig(true);
    try {
      await onSaveCsvConfig(selectedColumns);
    } finally {
      setIsSavingConfig(false);
      setShowSavePrompt(false);
      onClose();
    }
  }, [onSaveCsvConfig, selectedColumns, onClose]);

  // ---- Render ----

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 flex flex-col max-h-[85vh] relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Download as CSV
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Select columns, rename them, and drag to reorder
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex-1 flex min-h-0 border-b border-gray-200">
          {/* ---- Left: tree selector ---- */}
          <div className="w-1/2 flex flex-col border-r border-gray-200">
            <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Select Columns
              </span>
              <span className="flex-1" />
              <button
                onClick={selectAll}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                All
              </button>
              <button
                onClick={deselectAll}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium"
              >
                None
              </button>
            </div>
            <div className="flex-1 overflow-auto px-4 py-2">
              {fieldTree.map((node) => (
                <FieldTreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  onToggle={toggleNode}
                  getSelectionState={getNodeSelectionState}
                />
              ))}
            </div>
          </div>

          {/* ---- Right: ordered + renameable list ---- */}
          <div className="w-1/2 flex flex-col">
            <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Column Order &amp; Rename
              </span>
              <span className="text-xs text-gray-400 ml-auto">
                {selectedColumns.length} of {allLeaves.length}
              </span>
            </div>
            <div className="flex-1 overflow-auto px-3 py-2">
              {selectedColumns.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  Select columns from the tree
                </div>
              ) : (
                selectedColumns.map((col, idx) => {
                  const isLast = idx === selectedColumns.length - 1;
                  const showTop =
                    dragIdx !== null && dragIdx !== idx && overIdx === idx;
                  const showBottom =
                    dragIdx !== null &&
                    dragIdx !== idx &&
                    isLast &&
                    overIdx === idx + 1;
                  return (
                    <div
                      key={col.path}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 py-1.5 px-2 rounded-md transition-all ${
                        dragIdx === idx
                          ? "opacity-40"
                          : showTop
                            ? "border-t-2 border-blue-400"
                            : showBottom
                              ? "border-b-2 border-blue-400"
                              : ""
                      } ${dragIdx === null ? "hover:bg-gray-50" : ""}`}
                    >
                      <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab flex-shrink-0" />
                      <span
                        className="text-xs text-gray-400 truncate w-28 flex-shrink-0"
                        title={col.path}
                      >
                        {col.path}
                      </span>
                      <input
                        type="text"
                        value={col.renameTo}
                        onChange={(e) =>
                          handleRename(col.path, e.target.value)
                        }
                        className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white"
                      />
                      <button
                        onClick={() => handleRemove(col.path)}
                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded flex-shrink-0 transition-colors"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={selectedColumns.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            Download CSV ({selectedColumns.length} columns)
          </button>
        </div>

        {/* Save-config prompt overlay (tracker dashboards only) */}
        {showSavePrompt && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 rounded-xl">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4 border border-gray-200">
              <h3 className="text-base font-semibold text-gray-800 mb-2">
                Save CSV Configuration?
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Save this column selection, naming, and order so future CSV
                exports from this tracker use the same defaults.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowSavePrompt(false);
                    onClose();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isSavingConfig ? "Saving…" : "Save for Tracker"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
