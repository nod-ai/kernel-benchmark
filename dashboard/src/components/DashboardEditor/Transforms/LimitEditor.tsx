import type { Transform } from "../../../types/dashboard";
import { INPUT, type TransformEditorProps } from "./shared";

type LimitTransform = Extract<Transform, { type: "limit" }>;

export default function LimitEditor({
  transform,
  onChange,
}: TransformEditorProps<LimitTransform>) {
  return (
    <input
      type="number"
      className={`w-24 ${INPUT}`}
      value={transform.count}
      onChange={(e) => onChange({ ...transform, count: Number(e.target.value) || 0 })}
    />
  );
}
