import { Plus, Trash2 } from "lucide-react";
import type { Transform, FilterRule, FilterOperator } from "../../../types/dashboard";
import { FieldBadge, INPUT, SELECT, type TransformEditorProps } from "./shared";

type FilterTransform = Extract<Transform, { type: "filter" }>;

const OPERATORS: FilterOperator[] = [
  "eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "contains",
];

export default function FilterEditor({
  transform,
  availableFields,
  onChange,
}: TransformEditorProps<FilterTransform>) {
  const updateRule = (i: number, patch: Partial<FilterRule>) => {
    const rules = transform.rules.map((r, j) => (j === i ? { ...r, ...patch } : r));
    onChange({ ...transform, rules });
  };

  const removeRule = (i: number) =>
    onChange({ ...transform, rules: transform.rules.filter((_, j) => j !== i) });

  const addRule = () =>
    onChange({ ...transform, rules: [...transform.rules, { field: "", operator: "eq", value: "" }] });

  return (
    <div className="space-y-1">
      {transform.rules.map((rule, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <input
            className={`flex-1 ${INPUT}`}
            placeholder="field"
            value={rule.field}
            onChange={(e) => updateRule(i, { field: e.target.value })}
          />
          <FieldBadge field={rule.field} availableFields={availableFields} />
          <select
            className={SELECT}
            value={rule.operator}
            onChange={(e) => updateRule(i, { operator: e.target.value as FilterOperator })}
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
          <input
            className={`flex-1 ${INPUT}`}
            placeholder="value or $global.id"
            value={String(rule.value ?? "")}
            onChange={(e) => updateRule(i, { value: e.target.value })}
          />
          <button onClick={() => removeRule(i)} className="text-red-400 hover:text-red-600">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button onClick={addRule} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
        <Plus className="w-3 h-3" /> Add rule
      </button>
    </div>
  );
}
