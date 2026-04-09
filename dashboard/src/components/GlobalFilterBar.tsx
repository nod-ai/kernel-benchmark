import { useMemo, useState } from "react";
import { Filter, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import type { GlobalFilterConfig, GlobalFilterType } from "../types/dashboard";
import { resolveField } from "../utils/pipeline";
import { getValueColor } from "../utils/color";

interface GlobalFilterBarProps {
  filters: GlobalFilterConfig[];
  values: Record<string, any>;
  rawData: Record<string, any>[];
  onChange: (filterId: string, value: any) => void;
  isEditing?: boolean;
  onAddFilter?: (filter: GlobalFilterConfig) => void;
  onUpdateFilter?: (filter: GlobalFilterConfig) => void;
  onDeleteFilter?: (filterId: string) => void;
  /** Fields currently used as mapping.color in one or more widgets */
  colorByFields?: Set<string>;
}

const FILTER_TYPE_LABELS: Record<GlobalFilterType, string> = {
  single: "Single select",
  multi: "Multi select",
  range: "Numeric range",
  date_range: "Date range",
};

function chipStyle(
  isActive: boolean,
  colorField: boolean,
): string {
  if (!colorField) {
    return isActive
      ? "bg-blue-600 text-white border-blue-600"
      : "bg-white text-gray-600 border-gray-300 hover:border-gray-400";
  }
  if (isActive) {
    return "text-white border-transparent";
  }
  return "border-gray-200 hover:border-gray-300";
}

function chipInlineStyle(
  isActive: boolean,
  colorField: boolean,
  optionValue: string,
): React.CSSProperties | undefined {
  if (!colorField) return undefined;
  try {
    const c = getValueColor(optionValue);
    if (isActive) {
      return { backgroundColor: c.alpha(0.85).string(), borderColor: c.alpha(0.9).string() };
    }
    return {
      backgroundColor: c.alpha(0.1).string(),
      borderColor: c.alpha(0.3).string(),
      color: c.darken(0.3).string(),
    };
  } catch {
    return undefined;
  }
}

export default function GlobalFilterBar({
  filters,
  values,
  rawData,
  onChange,
  isEditing = false,
  onAddFilter,
  onUpdateFilter,
  onDeleteFilter,
  colorByFields,
}: GlobalFilterBarProps) {
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const allFields = useMemo(() => {
    if (rawData.length === 0) return [];
    const fieldSet = new Set<string>();
    for (const row of rawData.slice(0, 50)) {
      for (const key of Object.keys(row)) {
        if (typeof row[key] !== "object" || row[key] === null) {
          fieldSet.add(key);
        }
      }
    }
    return [...fieldSet].sort();
  }, [rawData]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
          {isEditing && (
            <span className="text-xs text-gray-400">(auto-applied to all widgets)</span>
          )}
        </div>
        {isEditing && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Filter
          </button>
        )}
      </div>

      {showAddForm && (
        <FilterForm
          allFields={allFields}
          onSave={(filter) => {
            onAddFilter?.(filter);
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div className="flex flex-wrap gap-4 items-start">
        {filters.map((f) =>
          isEditing && editingFilterId === f.id ? (
            <FilterForm
              key={f.id}
              initial={f}
              allFields={allFields}
              onSave={(updated) => {
                onUpdateFilter?.(updated);
                setEditingFilterId(null);
              }}
              onCancel={() => setEditingFilterId(null)}
            />
          ) : (
            <div key={f.id} className="flex items-start gap-1">
              <GlobalFilterInput
                filter={f}
                value={values[f.id]}
                rawData={rawData}
                onChange={(val) => onChange(f.id, val)}
                isColorCoded={colorByFields?.has(f.field) ?? false}
              />
              {isEditing && (
                <div className="flex gap-0.5 ml-1 mt-0.5 flex-shrink-0">
                  <button
                    onClick={() => setEditingFilterId(f.id)}
                    className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                    title="Edit filter"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDeleteFilter?.(f.id)}
                    className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                    title="Remove filter"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )
        )}
        {filters.length === 0 && !showAddForm && (
          <p className="text-xs text-gray-400 italic">
            {isEditing
              ? 'Click "Add Filter" to create a global filter.'
              : "No filters configured."}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Inline filter create / edit form ─── */

interface FilterFormProps {
  initial?: GlobalFilterConfig;
  allFields: string[];
  onSave: (filter: GlobalFilterConfig) => void;
  onCancel: () => void;
}

function FilterForm({ initial, allFields, onSave, onCancel }: FilterFormProps) {
  const [field, setField] = useState(initial?.field ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [type, setType] = useState<GlobalFilterType>(initial?.type ?? "single");

  const handleSave = () => {
    if (!field) return;
    const id =
      initial?.id ??
      `gf-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    onSave({ id, field, label: label || field, type });
  };

  return (
    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-2">
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500">Field:</label>
        {allFields.length > 0 ? (
          <select
            className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
            value={field}
            onChange={(e) => {
              setField(e.target.value);
              if (!label || label === field) setLabel(e.target.value);
            }}
          >
            <option value="">Select…</option>
            {allFields.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        ) : (
          <input
            className="w-28 px-2 py-1 border border-gray-300 rounded text-xs"
            placeholder="field name"
            value={field}
            onChange={(e) => setField(e.target.value)}
          />
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500">Label:</label>
        <input
          className="w-28 px-2 py-1 border border-gray-300 rounded text-xs"
          placeholder="display label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500">Type:</label>
        <select
          className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
          value={type}
          onChange={(e) => setType(e.target.value as GlobalFilterType)}
        >
          {(Object.keys(FILTER_TYPE_LABELS) as GlobalFilterType[]).map((t) => (
            <option key={t} value={t}>{FILTER_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleSave}
        disabled={!field}
        className="p-1.5 text-green-600 hover:bg-green-100 rounded disabled:opacity-40 transition-colors"
        title="Save"
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        onClick={onCancel}
        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
        title="Cancel"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ─── Individual filter value input ─── */

interface GlobalFilterInputProps {
  filter: GlobalFilterConfig;
  value: any;
  rawData: Record<string, any>[];
  onChange: (value: any) => void;
  isColorCoded?: boolean;
}

function GlobalFilterInput({ filter, value, rawData, onChange, isColorCoded = false }: GlobalFilterInputProps) {
  const options = useMemo(() => {
    if (filter.type === "date_range" || filter.type === "range") return [];
    const vals = rawData.map((row) => resolveField(row, filter.field));
    return [...new Set(vals.filter((v) => v != null).map(String))].sort();
  }, [rawData, filter.field, filter.type]);

  if (filter.type === "single") {
    const selected = value ?? "";
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
          {filter.label}:
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {options.map((opt) => {
            const active = selected === opt;
            return (
              <button
                key={opt}
                onClick={() => onChange(opt)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${chipStyle(active, isColorCoded)}`}
                style={chipInlineStyle(active, isColorCoded, opt)}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (filter.type === "multi") {
    const selected: string[] = Array.isArray(value) ? value : options;
    const toggle = (opt: string) => {
      if (selected.includes(opt)) {
        const next = selected.filter((v) => v !== opt);
        onChange(next.length === 0 ? options : next);
      } else {
        onChange([...selected, opt]);
      }
    };
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
          {filter.label}:
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {options.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${chipStyle(active, isColorCoded)}`}
                style={chipInlineStyle(active, isColorCoded, opt)}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (filter.type === "range") {
    const current = value ?? { min: "", max: "" };
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
          {filter.label}:
        </span>
        <input
          type="number"
          placeholder="min"
          className="w-20 px-2 py-1 border border-gray-300 rounded text-xs"
          value={current.min ?? ""}
          onChange={(e) => onChange({ ...current, min: e.target.value ? Number(e.target.value) : undefined })}
        />
        <span className="text-gray-400 text-xs">-</span>
        <input
          type="number"
          placeholder="max"
          className="w-20 px-2 py-1 border border-gray-300 rounded text-xs"
          value={current.max ?? ""}
          onChange={(e) => onChange({ ...current, max: e.target.value ? Number(e.target.value) : undefined })}
        />
      </div>
    );
  }

  if (filter.type === "date_range") {
    const current = value ?? { start: "", end: "" };
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
          {filter.label}:
        </span>
        <input
          type="date"
          className="px-2 py-1 border border-gray-300 rounded text-xs"
          value={current.start ?? ""}
          onChange={(e) => onChange({ ...current, start: e.target.value })}
        />
        <span className="text-gray-400 text-xs">to</span>
        <input
          type="date"
          className="px-2 py-1 border border-gray-300 rounded text-xs"
          value={current.end ?? ""}
          onChange={(e) => onChange({ ...current, end: e.target.value })}
        />
      </div>
    );
  }

  return null;
}
