import { AlertTriangle } from "lucide-react";
import type { Transform } from "../../../types/dashboard";
import { INPUT, type TransformEditorProps } from "./shared";

type GroupByTransform = Extract<Transform, { type: "group_by" }>;

export default function GroupByEditor({
  transform,
  availableFields,
  onChange,
}: TransformEditorProps<GroupByTransform>) {
  const fields = transform.fields.filter(Boolean);
  const unknowns = availableFields.size > 0 ? fields.filter((f) => !availableFields.has(f)) : [];

  return (
    <div className="flex gap-1.5 items-center">
      <input
        className={`w-full ${INPUT}`}
        placeholder="comma-separated fields"
        value={transform.fields.join(", ")}
        onChange={(e) =>
          onChange({ ...transform, fields: e.target.value.split(",").map((s) => s.trim()) })
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
