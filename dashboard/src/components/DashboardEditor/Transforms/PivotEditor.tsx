import type { Transform } from "../../../types/dashboard";
import { FieldBadge, INPUT, type TransformEditorProps } from "./shared";

type PivotTransform = Extract<Transform, { type: "pivot" }>;

export default function PivotEditor({
  transform,
  availableFields,
  onChange,
}: TransformEditorProps<PivotTransform>) {
  return (
    <div className="flex gap-1.5 items-center">
      <label className="text-xs text-gray-500">key:</label>
      <input
        className={`flex-1 ${INPUT}`}
        placeholder="field used as column prefix"
        value={transform.keyField}
        onChange={(e) => onChange({ ...transform, keyField: e.target.value })}
      />
      <FieldBadge field={transform.keyField} availableFields={availableFields} />
      <label className="text-xs text-gray-500">value:</label>
      <input
        className={`flex-1 ${INPUT}`}
        placeholder="field whose values become columns"
        value={transform.valueField}
        onChange={(e) => onChange({ ...transform, valueField: e.target.value })}
      />
      <FieldBadge field={transform.valueField} availableFields={availableFields} />
    </div>
  );
}
