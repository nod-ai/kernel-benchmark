import type { Transform } from "../../../types/dashboard";
import { ExpressionBadge, INPUT, type TransformEditorProps } from "./shared";

type ComputeTransform = Extract<Transform, { type: "compute" }>;

export default function ComputeEditor({
  transform,
  onChange,
}: TransformEditorProps<ComputeTransform>) {
  return (
    <div className="flex gap-1.5 items-center">
      <input
        className={`flex-1 ${INPUT}`}
        placeholder="expression"
        value={transform.expression}
        onChange={(e) => onChange({ ...transform, expression: e.target.value })}
      />
      <ExpressionBadge expression={transform.expression} />
      <span className="text-xs text-gray-400">as</span>
      <input
        className={`w-28 ${INPUT}`}
        placeholder="output name"
        value={transform.as}
        onChange={(e) => onChange({ ...transform, as: e.target.value })}
      />
    </div>
  );
}
