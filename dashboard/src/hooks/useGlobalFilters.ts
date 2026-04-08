import { useState, useCallback, useMemo } from "react";
import type { GlobalFilterConfig } from "../types/dashboard";
import type { KernelTypeDefinition } from "../types";
import { resolveField } from "../utils/pipeline";

/**
 * Describes a field the user can pick when adding a new global filter.
 */
export interface FieldOption {
  field: string;
  label: string;
  filterType: GlobalFilterConfig["type"];
}

/**
 * Derive the list of fields a user can filter on, combining
 * base kernel properties with dynamic attributes from kernel type definitions.
 */
export function getAvailableFields(
  kernelTypes: KernelTypeDefinition[]
): FieldOption[] {
  const base: FieldOption[] = [
    { field: "kernelType", label: "Kernel Type", filterType: "single" },
    { field: "machine", label: "Machine", filterType: "single" },
    { field: "backend", label: "Backend", filterType: "multi" },
    { field: "dtype", label: "Data Type", filterType: "multi" },
    { field: "tag", label: "Tag", filterType: "multi" },
    { field: "ok", label: "Status (ok)", filterType: "single" },
    { field: "tflops", label: "TFLOPs", filterType: "range" },
    { field: "meanMicroseconds", label: "Runtime (us)", filterType: "range" },
  ];

  const seen = new Set(base.map((b) => b.field));

  for (const kt of kernelTypes) {
    for (const attr of kt.attributes) {
      const field = `shape.${attr.name}`;
      if (seen.has(field)) continue;
      seen.add(field);

      let filterType: GlobalFilterConfig["type"] = "multi";
      if (attr.type === "integer" || attr.type === "float") {
        filterType = "range";
      } else if (attr.type === "boolean") {
        filterType = "single";
      } else if (attr.constraints?.choices) {
        filterType = "multi";
      }

      base.push({
        field,
        label: `${kt.displayName}: ${attr.name}`,
        filterType,
      });
    }
  }

  return base;
}

/**
 * Initialize global filter values from the raw data set.
 */
export function initGlobalFilterValues(
  filters: GlobalFilterConfig[],
  data: Record<string, any>[]
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const gf of filters) {
    if (gf.defaultValue !== undefined) {
      result[gf.id] = gf.defaultValue;
      continue;
    }
    if (gf.type === "single") {
      const unique = [
        ...new Set(data.map((r) => resolveField(r, gf.field)).filter((v) => v != null)),
      ];
      result[gf.id] = unique[0] ?? "";
    } else if (gf.type === "multi") {
      const unique = [
        ...new Set(
          data.map((r) => String(resolveField(r, gf.field) ?? "")).filter(Boolean)
        ),
      ];
      result[gf.id] = unique;
    } else if (gf.type === "range") {
      result[gf.id] = { min: undefined, max: undefined };
    } else if (gf.type === "date_range") {
      result[gf.id] = { start: "", end: "" };
    }
  }
  return result;
}

/**
 * React hook that manages global filter state for a modular dashboard.
 */
export function useGlobalFilters(
  filterConfigs: GlobalFilterConfig[],
  rawData: Record<string, any>[]
) {
  const [values, setValues] = useState<Record<string, any>>(() =>
    initGlobalFilterValues(filterConfigs, rawData)
  );

  const availableFields = useMemo(
    () => getAvailableFields([]),
    []
  );

  const updateFilter = useCallback((filterId: string, value: any) => {
    setValues((prev) => ({ ...prev, [filterId]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setValues(initGlobalFilterValues(filterConfigs, rawData));
  }, [filterConfigs, rawData]);

  return {
    values,
    updateFilter,
    resetFilters,
    availableFields,
  };
}
