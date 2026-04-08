import type { ComponentType } from "react";
import { Trash2 } from "lucide-react";
import type { Transform } from "../../../types/dashboard";
import type { TransformEditorProps } from "./shared";

import FilterEditor from "./FilterEditor";
import GroupByEditor from "./GroupByEditor";
import AggregateEditor from "./AggregateEditor";
import ComputeEditor from "./ComputeEditor";
import PivotEditor from "./PivotEditor";
import SortEditor from "./SortEditor";
import LimitEditor from "./LimitEditor";
import FormatEditor from "./FormatEditor";

/* ─── Registry ─── */

interface TransformMeta {
  label: string;
  editor: ComponentType<TransformEditorProps<any>>;
  createDefault: () => Transform;
}

export const TRANSFORM_REGISTRY: Record<Transform["type"], TransformMeta> = {
  filter: {
    label: "filter",
    editor: FilterEditor,
    createDefault: () => ({ type: "filter", rules: [{ field: "", operator: "eq", value: "" }] }),
  },
  group_by: {
    label: "group by",
    editor: GroupByEditor,
    createDefault: () => ({ type: "group_by", fields: [""] }),
  },
  aggregate: {
    label: "aggregate",
    editor: AggregateEditor,
    createDefault: () => ({ type: "aggregate", function: "count", field: "*", as: "count" }),
  },
  compute: {
    label: "compute",
    editor: ComputeEditor,
    createDefault: () => ({ type: "compute", expression: "", as: "computed" }),
  },
  pivot: {
    label: "pivot",
    editor: PivotEditor,
    createDefault: () => ({ type: "pivot", keyField: "", valueField: "" }),
  },
  sort: {
    label: "sort",
    editor: SortEditor,
    createDefault: () => ({ type: "sort", field: "", direction: "asc" }),
  },
  limit: {
    label: "limit",
    editor: LimitEditor,
    createDefault: () => ({ type: "limit", count: 100 }),
  },
  format: {
    label: "format",
    editor: FormatEditor,
    createDefault: () => ({ type: "format", field: "", as: "formatted", preset: "decimal", decimalPlaces: 2 }),
  },
};

export const TRANSFORM_TYPES = Object.keys(TRANSFORM_REGISTRY) as Transform["type"][];

/* ─── TransformRow wrapper ─── */

interface TransformRowProps {
  transform: Transform;
  availableFields: Set<string>;
  onChange: (t: Transform) => void;
  onRemove: () => void;
}

export function TransformRow({ transform, availableFields, onChange, onRemove }: TransformRowProps) {
  const meta = TRANSFORM_REGISTRY[transform.type];
  if (!meta) return null;
  const Editor = meta.editor;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {meta.label}
        </span>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <Editor transform={transform as any} availableFields={availableFields} onChange={onChange as any} />
    </div>
  );
}
