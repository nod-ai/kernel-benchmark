import { useState, useMemo } from "react";
import type { WidgetConfig, WidgetType, Transform } from "../../types/dashboard";
import { TRANSFORM_REGISTRY, TRANSFORM_TYPES, TransformRow } from "./Transforms";

interface WidgetConfigModalProps {
  initial: WidgetConfig;
  rawData?: Record<string, any>[];
  onSave: (config: WidgetConfig) => void;
  onCancel: () => void;
}

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
    { key: "color", label: "Color By (optional)", placeholder: "field for bar colors" },
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
  roofline: [
    { key: "color", label: "Color By", placeholder: "field for grouping (default: backend)" },
  ],
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
  const [transforms, setTransforms] = useState<Transform[]>(initial.dataSource.transforms);

  const update = (partial: Partial<WidgetConfig>) =>
    setConfig((prev) => ({ ...prev, ...partial }));

  const updateMapping = (key: string, value: string) =>
    setConfig((prev) => ({
      ...prev,
      mapping: { ...prev.mapping, [key]: value || undefined },
    }));

  const addTransform = (type: Transform["type"]) => {
    const meta = TRANSFORM_REGISTRY[type];
    if (meta) setTransforms((prev) => [...prev, meta.createDefault()]);
  };

  const removeTransform = (index: number) =>
    setTransforms((prev) => prev.filter((_, i) => i !== index));

  const updateTransform = (index: number, updated: Transform) =>
    setTransforms((prev) => prev.map((t, i) => (i === index ? updated : t)));

  const availableFields = useMemo(() => {
    if (!rawData || rawData.length === 0) return new Set<string>();
    const fields = new Set<string>();
    for (const row of rawData.slice(0, 50)) {
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
    onSave({ ...config, dataSource: { ...config.dataSource, transforms } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">Configure Widget</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={config.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </div>

          {/* Global filters toggle */}
          <ToggleRow
            label="Use global filters"
            description="When enabled, dashboard-level filters are automatically applied before this widget's transforms."
            value={!config.disableGlobalFilters}
            onChange={(v) => update({ disableGlobalFilters: !v })}
          />

          {/* Transform Pipeline */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Transform Pipeline</label>
              <div className="flex gap-1.5 flex-wrap">
                {TRANSFORM_TYPES.map((type) => (
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
                  No transforms — raw data will be passed to the widget.
                </p>
              )}
            </div>
          </div>

          {/* Mapping */}
          {(WIDGET_MAPPING_FIELDS[config.type]?.length ?? 0) > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data Mapping</label>
              <div className="grid grid-cols-2 gap-3">
                {WIDGET_MAPPING_FIELDS[config.type].map((mf) => (
                  <div key={mf.key}>
                    <label className="block text-xs text-gray-500 mb-0.5">{mf.label}</label>
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

          {/* Bar chart: horizontal toggle */}
          {config.type === "bar_chart" && (
            <ToggleRow
              label="Horizontal bars"
              description="Flip the chart so bars run left-to-right instead of bottom-to-top."
              value={config.style?.horizontal ?? false}
              onChange={(v) => update({ style: { ...config.style, horizontal: v } })}
            />
          )}
        </div>

        {/* Footer */}
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

/* ─── Reusable toggle row ─── */

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? "bg-blue-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
