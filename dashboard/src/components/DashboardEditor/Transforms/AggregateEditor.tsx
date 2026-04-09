import type { Transform, AggregateFunction } from "../../../types/dashboard";
import { FieldBadge, INPUT, SELECT, type TransformEditorProps } from "./shared";

type AggregateTransform = Extract<Transform, { type: "aggregate" }>;

const FUNCTIONS: AggregateFunction[] = [
  "count", "sum", "avg", "min", "max", "geo_mean", "count_where",
];

export default function AggregateEditor({
  transform,
  availableFields,
  onChange,
}: TransformEditorProps<AggregateTransform>) {
  return (
    <div className="flex gap-1.5 items-center">
      <select
        className={SELECT}
        value={transform.function}
        onChange={(e) => onChange({ ...transform, function: e.target.value as AggregateFunction })}
      >
        {FUNCTIONS.map((fn) => (
          <option key={fn} value={fn}>{fn}</option>
        ))}
      </select>
      <input
        className={`flex-1 ${INPUT}`}
        placeholder="field (* for count)"
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
  );
}
