import { useMemo } from "react";
import { AlertTriangle, CircleCheck } from "lucide-react";
import type { Transform } from "../../../types/dashboard";
import { validateExpression } from "../../../utils/formula";

/* ─── Shared types ─── */

export interface TransformEditorProps<T extends Transform = Transform> {
  transform: T;
  availableFields: Set<string>;
  onChange: (t: T) => void;
}

/* ─── Shared CSS classes ─── */

export const INPUT = "px-2 py-1 border border-gray-300 rounded text-xs";
export const SELECT = "px-1 py-1 border border-gray-300 rounded text-xs bg-white";

/* ─── Shared components ─── */

export function FieldBadge({
  field,
  availableFields,
}: {
  field: string;
  availableFields: Set<string>;
}) {
  if (!field || field === "*" || field.startsWith("$global.")) return null;
  if (availableFields.size === 0 || availableFields.has(field)) return null;
  return (
    <span className="inline-flex items-center gap-0.5" title={`"${field}" not found in data`}>
      <AlertTriangle className="w-3 h-3 text-amber-500" />
    </span>
  );
}

export function ExpressionBadge({ expression }: { expression: string }) {
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
