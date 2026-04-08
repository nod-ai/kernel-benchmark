import type { Transform } from "../../../types/dashboard";
import { FieldBadge, INPUT, SELECT, type TransformEditorProps } from "./shared";

type SortTransform = Extract<Transform, { type: "sort" }>;

export default function SortEditor({
  transform,
  availableFields,
  onChange,
}: TransformEditorProps<SortTransform>) {
  return (
    <div className="flex gap-1.5 items-center">
      <input
        className={`flex-1 ${INPUT}`}
        placeholder="field"
        value={transform.field}
        onChange={(e) => onChange({ ...transform, field: e.target.value })}
      />
      <FieldBadge field={transform.field} availableFields={availableFields} />
      <select
        className={SELECT}
        value={transform.direction}
        onChange={(e) => onChange({ ...transform, direction: e.target.value as "asc" | "desc" })}
      >
        <option value="asc">asc</option>
        <option value="desc">desc</option>
      </select>
    </div>
  );
}
