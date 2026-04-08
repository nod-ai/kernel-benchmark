import type { Transform, FormatPreset } from "../../../types/dashboard";
import { FieldBadge, INPUT, type TransformEditorProps } from "./shared";

type FormatTransform = Extract<Transform, { type: "format" }>;

const PRESETS: { value: FormatPreset; label: string }[] = [
  { value: "template", label: "Custom" },
  { value: "decimal", label: "Decimal" },
  { value: "scientific", label: "Scientific" },
  { value: "percentage", label: "Percent" },
  { value: "fraction", label: "Fraction" },
];

const TOGGLE_BASE =
  "px-2 py-0.5 text-xs border rounded transition-colors cursor-pointer select-none";
const TOGGLE_ON = `${TOGGLE_BASE} bg-blue-600 text-white border-blue-600`;
const TOGGLE_OFF = `${TOGGLE_BASE} bg-white text-gray-600 border-gray-300 hover:bg-gray-50`;

export default function FormatEditor({
  transform,
  availableFields,
  onChange,
}: TransformEditorProps<FormatTransform>) {
  const { preset } = transform;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={preset === p.value ? TOGGLE_ON : TOGGLE_OFF}
            onClick={() => onChange({ ...transform, preset: p.value })}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "template" && (
        <div className="flex gap-1.5 items-center">
          <input
            className={`flex-1 ${INPUT}`}
            placeholder='e.g. {count} / {total} = {pct}%'
            value={transform.template ?? ""}
            onChange={(e) => onChange({ ...transform, template: e.target.value })}
          />
          <span className="text-xs text-gray-400">as</span>
          <input
            className={`flex-1 ${INPUT}`}
            placeholder="output name"
            value={transform.as}
            onChange={(e) => onChange({ ...transform, as: e.target.value })}
          />
        </div>
      )}

      {preset === "fraction" && (
        <div className="space-y-1.5">
          <div className="flex gap-1.5 items-center">
            <label className="text-xs text-gray-500 w-20">Numerator:</label>
            <input
              className={`flex-1 ${INPUT}`}
              placeholder="numerator field"
              value={transform.numerator ?? ""}
              onChange={(e) => onChange({ ...transform, numerator: e.target.value })}
            />
            <FieldBadge field={transform.numerator ?? ""} availableFields={availableFields} />
          </div>
          <div className="flex gap-1.5 items-center">
            <label className="text-xs text-gray-500 w-20">Denominator:</label>
            <input
              className={`flex-1 ${INPUT}`}
              placeholder="denominator field"
              value={transform.denominator ?? ""}
              onChange={(e) => onChange({ ...transform, denominator: e.target.value })}
            />
            <FieldBadge field={transform.denominator ?? ""} availableFields={availableFields} />
          </div>
          <div className="flex gap-1.5 items-center">
            <span className="text-xs text-gray-400">as</span>
            <input
              className={`flex-1 ${INPUT}`}
              placeholder="output name"
              value={transform.as}
              onChange={(e) => onChange({ ...transform, as: e.target.value })}
            />
          </div>
        </div>
      )}

      {preset !== "template" && preset !== "fraction" && (
        <>
          <div className="flex gap-1.5 items-center">
            <input
              className={`flex-1 ${INPUT}`}
              placeholder="source field"
              value={transform.field}
              onChange={(e) => onChange({ ...transform, field: e.target.value })}
            />
            <FieldBadge field={transform.field} availableFields={availableFields} />
            <span className="text-xs text-gray-400">as</span>
            <input
              className={`flex-1 ${INPUT}`}
              placeholder="output name"
              value={transform.as}
              onChange={(e) => onChange({ ...transform, as: e.target.value })}
            />
          </div>
          <div className="flex gap-1.5 items-center">
            <label className="text-xs text-gray-500">Decimals:</label>
            <input
              type="number"
              min={0}
              max={20}
              className={`w-14 ${INPUT}`}
              value={transform.decimalPlaces ?? 2}
              onChange={(e) =>
                onChange({ ...transform, decimalPlaces: Number(e.target.value) || 0 })
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
