import { useState, useMemo } from "react";
import { Plus, Trash2, AlertTriangle, CircleCheck } from "lucide-react";
import type {
  WidgetConfig,
  WidgetType,
  DataSourceType,
  Transform,
  AggregateFunction,
  FilterOperator,
} from "../../types/dashboard";
import { validateExpression } from "../../utils/formula";

interface WidgetConfigModalProps {
  initial: WidgetConfig;
  rawData?: Record<string, any>[];
  onSave: (config: WidgetConfig) => void;
  onCancel: () => void;
}

const DATA_SOURCE_OPTIONS: DataSourceType[] = [
  "kernels",
  "runs",
  "benchmark_stats",
  "tracker_performance",
];

const AGGREGATE_FUNCTIONS: AggregateFunction[] = [
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "geo_mean",
  "count_where",
];

const FILTER_OPERATORS: FilterOperator[] = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "not_in",
  "contains",
];

interface MappingField {
  key: string;
  label: string;
  placeholder: string;
}

const WIDGET_MAPPING_FIELDS: Record<WidgetType, MappingField[]> = {
  pie_chart: [
    { key: "segment", label: "Segment", placeholder: "field for slice labels" },
    { key: "value", label: "Value", placeholder: "field for slice values" },
  ],
  bar_chart: [
    { key: "x", label: "X Axis", placeholder: "category field" },
    { key: "y", label: "Y Axis", placeholder: "value field" },
  ],
  line_chart: [
    { key: "x", label: "X Axis", placeholder: "category / time field" },
    { key: "y", label: "Y Axis", placeholder: "value field" },
    { key: "color", label: "Series (optional)", placeholder: "field to split lines by" },
  ],
  scatter_plot: [
    { key: "x", label: "X Axis", placeholder: "numeric field" },
    { key: "y", label: "Y Axis", placeholder: "numeric field" },
    { key: "color", label: "Color (optional)", placeholder: "field for point color" },
    { key: "size", label: "Size (optional)", placeholder: "field for point size" },
    { key: "label", label: "Label (optional)", placeholder: "field for hover labels" },
  ],
  roofline: [],
  stat_card: [
    { key: "value", label: "Value", placeholder: "numeric field to display" },
    { key: "label", label: "Label (optional)", placeholder: "display label override" },
  ],
  table: [
    { key: "x", label: "Columns", placeholder: "comma-separated column fields" },
  ],
  bell_curve: [
    { key: "y", label: "Metric", placeholder: 'metric field (e.g. "tflops")' },
  ],
};

export default function WidgetConfigModal({
  initial,
  rawData,
  onSave,
  onCancel,
}: WidgetConfigModalProps) {
  const [config, setConfig] = useState<WidgetConfig>({ ...initial });
  const [transforms, setTransforms] = useState<Transform[]>(
    initial.dataSource.transforms
  );

  const update = (partial: Partial<WidgetConfig>) =>
    setConfig((prev) => ({ ...prev, ...partial }));

  const updateMapping = (key: string, value: string) =>
    setConfig((prev) => ({
      ...prev,
      mapping: { ...prev.mapping, [key]: value || undefined },
    }));

  const addTransform = (type: Transform["type"]) => {
    let t: Transform;
    switch (type) {
      case "filter":
        t = { type: "filter", rules: [{ field: "", operator: "eq", value: "" }] };
        break;
      case "group_by":
        t = { type: "group_by", fields: [""] };
        break;
      case "aggregate":
        t = { type: "aggregate", function: "count", field: "*", as: "count" };
        break;
      case "compute":
        t = { type: "compute", expression: "", as: "computed" };
        break;
      case "pivot":
        t = { type: "pivot", keyField: "", valueField: "" };
        break;
      case "sort":
        t = { type: "sort", field: "", direction: "asc" };
        break;
      case "limit":
        t = { type: "limit", count: 100 };
        break;
      default:
        return;
    }
    setTransforms((prev) => [...prev, t]);
  };

  const removeTransform = (index: number) =>
    setTransforms((prev) => prev.filter((_, i) => i !== index));

  const updateTransform = (index: number, updated: Transform) =>
    setTransforms((prev) => prev.map((t, i) => (i === index ? updated : t)));

  const availableFields = useMemo(() => {
    if (!rawData || rawData.length === 0) return new Set<string>();
    const fields = new Set<string>();
    const sample = rawData.slice(0, 50);
    for (const row of sample) {
      for (const key of Object.keys(row)) {
        fields.add(key);
        const v = row[key];
        if (v && typeof v === "object" && !Array.isArray(v)) {
          for (const nested of Object.keys(v)) {
            fields.add(`${key}.${nested}`);
          }
        }
      }
    }
    return fields;
  }, [rawData]);

  const handleSave = () => {
    onSave({
      ...config,
      dataSource: { ...config.dataSource, transforms },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">
            Configure Widget
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={config.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </div>

          {/* Global filters toggle */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
            <div>
              <span className="text-sm font-medium text-gray-700">
                Use global filters
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                When enabled, dashboard-level filters are automatically applied before this widget's transforms.
              </p>
            </div>
            <button
              onClick={() =>
                update({
                  disableGlobalFilters: !config.disableGlobalFilters,
                })
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                !config.disableGlobalFilters
                  ? "bg-blue-600"
                  : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  !config.disableGlobalFilters
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Data Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Source
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              value={config.dataSource.type}
              onChange={(e) =>
                update({
                  dataSource: {
                    ...config.dataSource,
                    type: e.target.value as DataSourceType,
                  },
                })
              }
            >
              {DATA_SOURCE_OPTIONS.map((ds) => (
                <option key={ds} value={ds}>
                  {ds}
                </option>
              ))}
            </select>
          </div>

          {/* Transform Pipeline */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Transform Pipeline
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {(
                  ["filter", "group_by", "aggregate", "compute", "pivot", "sort", "limit"] as const
                ).map((type) => (
                  <button
                    key={type}
                    onClick={() => addTransform(type)}
                    className="px-2 py-0.5 text-xs border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                  >
                    + {type.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {transforms.map((t, i) => (
                <TransformRow
                  key={i}
                  transform={t}
                  availableFields={availableFields}
                  onChange={(updated) => updateTransform(i, updated)}
                  onRemove={() => removeTransform(i)}
                />
              ))}
              {transforms.length === 0 && (
                <p className="text-xs text-gray-400 italic">
                  No transforms -- raw data will be passed to the widget.
                </p>
              )}
            </div>
          </div>

          {/* Mapping */}
          {(WIDGET_MAPPING_FIELDS[config.type]?.length ?? 0) > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Mapping
              </label>
              <div className="grid grid-cols-2 gap-3">
                {WIDGET_MAPPING_FIELDS[config.type].map((mf) => (
                  <div key={mf.key}>
                    <label className="block text-xs text-gray-500 mb-0.5">
                      {mf.label}
                    </label>
                    <input
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder={mf.placeholder}
                      value={(config.mapping as any)[mf.key] ?? ""}
                      onChange={(e) => updateMapping(mf.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Save Widget
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldBadge({
  field,
  availableFields,
}: {
  field: string;
  availableFields: Set<string>;
}) {
  if (!field) return null;
  if (field === "*" || field.startsWith("$global.")) return null;
  const ok = availableFields.size === 0 || availableFields.has(field);
  if (ok) return null;
  return (
    <span className="inline-flex items-center gap-0.5" title={`"${field}" not found in data`}>
      <AlertTriangle className="w-3 h-3 text-amber-500" />
    </span>
  );
}

function ExpressionBadge({ expression }: { expression: string }) {
  const error = useMemo(() => validateExpression(expression), [expression]);
  if (!expression.trim()) return null;
  if (error) {
    return (
      <span className="inline-flex items-center gap-0.5" title={error}>
        <AlertTriangle className="w-3 h-3 text-red-500" />
        <span className="text-[10px] text-red-500 max-w-[120px] truncate">{error}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center" title="Valid expression">
      <CircleCheck className="w-3 h-3 text-green-500" />
    </span>
  );
}

function TransformRow({
  transform,
  availableFields,
  onChange,
  onRemove,
}: {
  transform: Transform;
  availableFields: Set<string>;
  onChange: (t: Transform) => void;
  onRemove: () => void;
}) {
  const renderBody = () => {
    switch (transform.type) {
      case "filter":
        return (
          <div className="space-y-1">
            {transform.rules.map((rule, ri) => (
              <div key={ri} className="flex gap-1.5 items-center">
                <input
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                  placeholder="field"
                  value={rule.field}
                  onChange={(e) => {
                    const rules = [...transform.rules];
                    rules[ri] = { ...rules[ri], field: e.target.value };
                    onChange({ ...transform, rules });
                  }}
                />
                <FieldBadge field={rule.field} availableFields={availableFields} />
                <select
                  className="px-1 py-1 border border-gray-300 rounded text-xs bg-white"
                  value={rule.operator}
                  onChange={(e) => {
                    const rules = [...transform.rules];
                    rules[ri] = {
                      ...rules[ri],
                      operator: e.target.value as FilterOperator,
                    };
                    onChange({ ...transform, rules });
                  }}
                >
                  {FILTER_OPERATORS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                <input
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                  placeholder="value or $global.id"
                  value={String(rule.value ?? "")}
                  onChange={(e) => {
                    const rules = [...transform.rules];
                    rules[ri] = { ...rules[ri], value: e.target.value };
                    onChange({ ...transform, rules });
                  }}
                />
                <button
                  onClick={() => {
                    const rules = transform.rules.filter((_, j) => j !== ri);
                    onChange({ ...transform, rules });
                  }}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                onChange({
                  ...transform,
                  rules: [
                    ...transform.rules,
                    { field: "", operator: "eq", value: "" },
                  ],
                })
              }
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              <Plus className="w-3 h-3" /> Add rule
            </button>
          </div>
        );

      case "group_by": {
        const fields = transform.fields.filter(Boolean);
        const unknowns =
          availableFields.size > 0
            ? fields.filter((f) => !availableFields.has(f))
            : [];
        return (
          <div className="flex gap-1.5 items-center">
            <input
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="comma-separated fields"
              value={transform.fields.join(", ")}
              onChange={(e) =>
                onChange({
                  ...transform,
                  fields: e.target.value.split(",").map((s) => s.trim()),
                })
              }
            />
            {unknowns.length > 0 && (
              <span
                className="inline-flex items-center gap-0.5 flex-shrink-0"
                title={`Unknown field(s): ${unknowns.join(", ")}`}
              >
                <AlertTriangle className="w-3 h-3 text-amber-500" />
              </span>
            )}
          </div>
        );
      }

      case "aggregate":
        return (
          <div className="flex gap-1.5 items-center">
            <select
              className="px-1 py-1 border border-gray-300 rounded text-xs bg-white"
              value={transform.function}
              onChange={(e) =>
                onChange({
                  ...transform,
                  function: e.target.value as AggregateFunction,
                })
              }
            >
              {AGGREGATE_FUNCTIONS.map((fn) => (
                <option key={fn} value={fn}>
                  {fn}
                </option>
              ))}
            </select>
            <input
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="field (* for count)"
              value={transform.field}
              onChange={(e) =>
                onChange({ ...transform, field: e.target.value })
              }
            />
            <FieldBadge field={transform.field} availableFields={availableFields} />
            <span className="text-xs text-gray-400">as</span>
            <input
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="output name"
              value={transform.as}
              onChange={(e) => onChange({ ...transform, as: e.target.value })}
            />
          </div>
        );

      case "compute":
        return (
          <div className="space-y-1">
            <div className="flex gap-1.5 items-center">
              <input
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                placeholder="expression"
                value={transform.expression}
                onChange={(e) =>
                  onChange({ ...transform, expression: e.target.value })
                }
              />
              <ExpressionBadge expression={transform.expression} />
              <span className="text-xs text-gray-400">as</span>
              <input
                className="w-28 px-2 py-1 border border-gray-300 rounded text-xs"
                placeholder="output name"
                value={transform.as}
                onChange={(e) => onChange({ ...transform, as: e.target.value })}
              />
            </div>
          </div>
        );

      case "pivot":
        return (
          <div className="flex gap-1.5 items-center">
            <label className="text-xs text-gray-500">key:</label>
            <input
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="field used as column prefix"
              value={transform.keyField}
              onChange={(e) =>
                onChange({ ...transform, keyField: e.target.value })
              }
            />
            <FieldBadge field={transform.keyField} availableFields={availableFields} />
            <label className="text-xs text-gray-500">value:</label>
            <input
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="field whose values become columns"
              value={transform.valueField}
              onChange={(e) =>
                onChange({ ...transform, valueField: e.target.value })
              }
            />
            <FieldBadge field={transform.valueField} availableFields={availableFields} />
          </div>
        );

      case "sort":
        return (
          <div className="flex gap-1.5 items-center">
            <input
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="field"
              value={transform.field}
              onChange={(e) =>
                onChange({ ...transform, field: e.target.value })
              }
            />
            <FieldBadge field={transform.field} availableFields={availableFields} />
            <select
              className="px-1 py-1 border border-gray-300 rounded text-xs bg-white"
              value={transform.direction}
              onChange={(e) =>
                onChange({
                  ...transform,
                  direction: e.target.value as "asc" | "desc",
                })
              }
            >
              <option value="asc">asc</option>
              <option value="desc">desc</option>
            </select>
          </div>
        );

      case "limit":
        return (
          <input
            type="number"
            className="w-24 px-2 py-1 border border-gray-300 rounded text-xs"
            value={transform.count}
            onChange={(e) =>
              onChange({ ...transform, count: Number(e.target.value) || 0 })
            }
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {transform.type.replace("_", " ")}
        </span>
        <button
          onClick={onRemove}
          className="text-red-400 hover:text-red-600"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {renderBody()}
    </div>
  );
}
