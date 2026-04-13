import type {
  Transform,
  FilterRule,
  FilterOperator,
  AggregateFunction,
  FormatPreset,
  FractionValue,
  GlobalFilterConfig,
} from "../types/dashboard";
import { evaluateExpression } from "./formula";

type Row = Record<string, any>;

/**
 * Resolve a dot-notation field path on a row, e.g. "shape.M" => row.shape.M
 */
export function resolveField(row: Row, field: string): any {
  if (field === "*") return row;
  const parts = field.split(".");
  let value: any = row;
  for (const part of parts) {
    if (value == null) return undefined;
    value = value[part];
  }
  return value;
}

/**
 * Resolve a filter value -- if it starts with "$global.", look it up
 * in the globalFilterValues map; otherwise use the literal.
 */
function resolveValue(value: any, globals: Record<string, any>): any {
  if (typeof value === "string" && value.startsWith("$global.")) {
    const filterId = value.slice("$global.".length);
    return globals[filterId];
  }
  return value;
}

function looseEquals(a: any, b: any): boolean {
  if (a === b) return true;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function matchOperator(
  fieldValue: any,
  operator: FilterOperator,
  target: any
): boolean {
  switch (operator) {
    case "eq":
      return looseEquals(fieldValue, target);
    case "neq":
      return !looseEquals(fieldValue, target);
    case "gt":
      return fieldValue > target;
    case "gte":
      return fieldValue >= target;
    case "lt":
      return fieldValue < target;
    case "lte":
      return fieldValue <= target;
    case "in":
      // null/undefined field values pass through (field absent on this row)
      if (fieldValue == null) return true;
      return Array.isArray(target) && target.includes(fieldValue);
    case "not_in":
      return Array.isArray(target) && !target.includes(fieldValue);
    case "contains":
      return (
        typeof fieldValue === "string" &&
        typeof target === "string" &&
        fieldValue.includes(target)
      );
    case "regex":
      try {
        return new RegExp(target).test(String(fieldValue));
      } catch {
        return false;
      }
    default:
      return true;
  }
}

export function applyFilter(
  data: Row[],
  rules: FilterRule[],
  globals: Record<string, any>
): Row[] {
  return data.filter((row) =>
    rules.every((rule) => {
      const fieldValue = resolveField(row, rule.field);
      const target = resolveValue(rule.value, globals);
      if (target === undefined || target === null) return true;
      return matchOperator(fieldValue, rule.operator, target);
    })
  );
}

export function applyGroupBy(
  data: Row[],
  fields: string[]
): Map<string, Row[]> {
  const groups = new Map<string, Row[]>();
  for (const row of data) {
    const key = fields.map((f) => String(resolveField(row, f) ?? "")).join("||");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return groups;
}

function computeAggregate(
  rows: Row[],
  fn: AggregateFunction,
  field: string
): number {
  if (rows.length === 0) return 0;

  const values =
    field === "*" ? rows.map(() => 1) : rows.map((r) => Number(resolveField(r, field)) || 0);

  switch (fn) {
    case "count":
      return values.length;
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "geo_mean": {
      const positive = values.filter((v) => v > 0);
      if (positive.length === 0) return 0;
      const logSum = positive.reduce((a, b) => a + Math.log(b), 0);
      return Math.exp(logSum / positive.length);
    }
    case "count_where":
      return values.filter((v) => v > 0).length;
    default:
      return 0;
  }
}

export function applyAggregate(
  groups: Map<string, Row[]>,
  groupByFields: string[],
  fn: AggregateFunction,
  field: string,
  as: string
): Row[] {
  const result: Row[] = [];
  for (const [, rows] of groups) {
    const representative: Row = {};
    if (rows.length > 0) {
      for (const gf of groupByFields) {
        representative[gf] = resolveField(rows[0], gf);
      }
    }
    representative[as] = computeAggregate(rows, fn, field);
    result.push(representative);
  }
  return result;
}

export function applySort(
  data: Row[],
  field: string,
  direction: "asc" | "desc"
): Row[] {
  const sorted = [...data];
  sorted.sort((a, b) => {
    const aVal = resolveField(a, field);
    const bVal = resolveField(b, field);
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (aVal < bVal) return direction === "asc" ? -1 : 1;
    if (aVal > bVal) return direction === "asc" ? 1 : -1;
    return 0;
  });
  return sorted;
}

export function applyLimit(data: Row[], count: number): Row[] {
  return data.slice(0, count);
}

/**
 * Flatten N rows into a single row with column names derived from a key field.
 * E.g. [{backend:"wave", geo:100}, {backend:"triton", geo:200}]
 *   => [{wave_geo: 100, triton_geo: 200}]
 */
export function applyPivot(data: Row[], keyField: string, valueField: string): Row[] {
  const result: Row = {};
  for (const row of data) {
    const key = String(resolveField(row, keyField) ?? "").replace(/\W/g, "_");
    result[`${key}_${valueField}`] = resolveField(row, valueField);
  }
  return [result];
}

export function applyFormat(
  data: Row[],
  field: string,
  as: string,
  preset: FormatPreset,
  template?: string,
  decimalPlaces: number = 2,
  numerator?: string,
  denominator?: string
): Row[] {
  return data.map((row) => {
    let formatted: string | FractionValue;
    switch (preset) {
      case "fraction": {
        const num = numerator ? resolveField(row, numerator) : undefined;
        const den = denominator ? resolveField(row, denominator) : undefined;
        formatted = {
          _fraction: true,
          numerator: num != null ? String(num) : "—",
          denominator: den != null ? String(den) : "—",
        };
        break;
      }
      case "percentage":
        formatted = (Number(resolveField(row, field)) * 100).toFixed(decimalPlaces) + "%";
        break;
      case "scientific":
        formatted = Number(resolveField(row, field)).toExponential(decimalPlaces);
        break;
      case "template":
        formatted = (template || "").replace(/\{(\w[\w.]*)\}/g, (_, key) => {
          const v = resolveField(row, key);
          return v != null ? String(v) : "";
        });
        break;
      case "decimal":
      default:
        formatted = Number(resolveField(row, field)).toFixed(decimalPlaces);
        break;
    }
    return { ...row, [as]: formatted };
  });
}

/**
 * Build FilterRule[] from global filter configs + current values.
 * These rules are auto-injected before a widget's own transforms
 * unless the widget opts out via `disableGlobalFilters`.
 */
export function buildGlobalFilterRules(
  filters: GlobalFilterConfig[],
  values: Record<string, any>
): FilterRule[] {
  const rules: FilterRule[] = [];
  for (const f of filters) {
    const v = values[f.id];
    if (v === undefined || v === null) continue;
    switch (f.type) {
      case "single":
        rules.push({ field: f.field, operator: "eq", value: v });
        break;
      case "multi":
        if (Array.isArray(v) && v.length > 0) {
          rules.push({ field: f.field, operator: "in", value: v });
        }
        break;
      case "range":
        if (v.min != null) rules.push({ field: f.field, operator: "gte", value: v.min });
        if (v.max != null) rules.push({ field: f.field, operator: "lte", value: v.max });
        break;
      case "date_range":
        if (v.start) rules.push({ field: f.field, operator: "gte", value: v.start });
        if (v.end) rules.push({ field: f.field, operator: "lte", value: v.end });
        break;
    }
  }
  return rules;
}

/**
 * Execute a full transform pipeline on a dataset.
 *
 * When `autoFilterRules` is provided (built from global filters), they are
 * applied as a single filter step before any widget-defined transforms.
 *
 * The pipeline tracks the most recent group_by fields so that a following
 * aggregate step knows which fields to carry forward.
 */
export function executePipeline(
  data: Row[],
  transforms: Transform[],
  globalFilterValues: Record<string, any>,
  autoFilterRules?: FilterRule[]
): Row[] {
  let current: Row[] = data;

  if (autoFilterRules && autoFilterRules.length > 0) {
    current = applyFilter(current, autoFilterRules, {});
  }

  let pendingGroups: Map<string, Row[]> | null = null;
  let lastGroupByFields: string[] = [];

  for (const t of transforms) {
    switch (t.type) {
      case "filter":
        current = applyFilter(current, t.rules, globalFilterValues);
        break;

      case "group_by":
        lastGroupByFields = t.fields;
        pendingGroups = applyGroupBy(current, t.fields);
        break;

      case "aggregate": {
        if (!pendingGroups) {
          pendingGroups = new Map([["__all__", current]]);
        }
        current = applyAggregate(
          pendingGroups,
          lastGroupByFields,
          t.function,
          t.field,
          t.as
        );
        pendingGroups = null;
        break;
      }

      case "compute":
        current = current.map((row) => ({
          ...row,
          [t.as]: evaluateExpression(t.expression, row),
        }));
        break;

      case "pivot":
        current = applyPivot(current, t.keyField, t.valueField);
        break;

      case "sort":
        current = applySort(current, t.field, t.direction);
        break;

      case "limit":
        current = applyLimit(current, t.count);
        break;

      case "format":
        current = applyFormat(current, t.field, t.as, t.preset, t.template, t.decimalPlaces, t.numerator, t.denominator);
        break;
    }
  }
  return current;
}
