import { useState, useMemo } from "react";
import type { Kernel } from "../types";
import { KERNEL_DIMS } from "../utils/utils";

// Filter state interface
export interface FilterState {
  kernelType: string;
  machine: string;
  backends: string[];
  dtypes: string[];
  tags: string[];
  variants: string[];
}

// Available options for each filter
export interface AvailableFilterOptions {
  kernelTypes: string[];
  machines: string[];
  backends: string[];
  dtypes: string[];
  tags: string[];
  variants: string[];
}

// Filter configuration type
export interface FilterDefinition {
  key: keyof FilterState;
  type: "single" | "multi";
  title: string;
  getOptions: (kernels: Kernel[], filters: FilterState) => string[];
  cascades?: (keyof FilterState)[];
  condition?: (filters: FilterState) => boolean; // When to show this filter
}

// Helper functions to get unique values from filtered kernels
function getUniqueKernelTypes(kernels: Kernel[]): string[] {
  return Array.from(new Set(kernels.map((k) => k.kernelType)));
}

function getUniqueMachines(kernels: Kernel[], filters: FilterState): string[] {
  const typeFilteredKernels = kernels.filter(
    (k) => k.kernelType === filters.kernelType
  );
  return Array.from(new Set(typeFilteredKernels.map((k) => k.machine)));
}

function getUniqueBackends(kernels: Kernel[], filters: FilterState): string[] {
  const filteredKernels = kernels.filter(
    (k) => k.kernelType === filters.kernelType && k.machine === filters.machine
  );
  return Array.from(new Set(filteredKernels.map((k) => k.backend)));
}

function getUniqueDtypes(kernels: Kernel[], filters: FilterState): string[] {
  const filteredKernels = kernels.filter(
    (k) => k.kernelType === filters.kernelType && k.machine === filters.machine
  );
  return Array.from(new Set(filteredKernels.map((k) => k.dtype)));
}

function getUniqueTags(kernels: Kernel[], filters: FilterState): string[] {
  const filteredKernels = kernels.filter(
    (k) => k.kernelType === filters.kernelType && k.machine === filters.machine
  );
  return Array.from(new Set(filteredKernels.map((k) => k.tag)));
}

function getUniqueVariants(kernels: Kernel[], filters: FilterState): string[] {
  const filteredKernels = kernels.filter(
    (k) => k.kernelType === filters.kernelType && k.machine === filters.machine
  );

  if (filters.kernelType === "gemm") {
    return Array.from(
      new Set(
        filteredKernels.map((k) => k.shape.transpose || k.shape.tA + k.shape.tB)
      )
    );
  }

  return [];
}

// Filter configuration definitions
export const FILTER_CONFIGS: FilterDefinition[] = [
  {
    key: "kernelType",
    type: "single",
    title: "Kernel Type",
    getOptions: () => Object.keys(KERNEL_DIMS),
    cascades: ["machine", "backends", "dtypes", "tags", "variants"],
  },
  {
    key: "machine",
    type: "single",
    title: "Machine",
    getOptions: getUniqueMachines,
    cascades: ["backends", "dtypes", "tags", "variants"],
  },
  {
    key: "backends",
    type: "multi",
    title: "Backends",
    getOptions: getUniqueBackends,
  },
  {
    key: "dtypes",
    type: "multi",
    title: "Data Types",
    getOptions: getUniqueDtypes,
  },
  {
    key: "tags",
    type: "multi",
    title: "Tags",
    getOptions: getUniqueTags,
  },
  {
    key: "variants",
    type: "multi",
    title: "Transpose",
    getOptions: getUniqueVariants,
    condition: (filters) => filters.kernelType === "gemm",
  },
];

// Compute new filter state with cascading updates
function computeNewFilterState(
  currentFilters: FilterState,
  changedKey: keyof FilterState,
  newValue: any,
  kernels: Kernel[]
): FilterState {
  const newFilters = { ...currentFilters, [changedKey]: newValue };

  // Find the configuration for the changed filter
  const config = FILTER_CONFIGS.find((c) => c.key === changedKey);

  if (config?.cascades) {
    // Reset dependent filters to "all available" when parent changes
    config.cascades.forEach((dependentKey) => {
      const dependentConfig = FILTER_CONFIGS.find(
        (c) => c.key === dependentKey
      );
      if (dependentConfig) {
        const availableOptions = dependentConfig.getOptions(
          kernels,
          newFilters
        );

        // Handle single vs multi select filters differently
        if (dependentConfig.type === "single") {
          // For single select, choose the first available option
          (newFilters as any)[dependentKey] = availableOptions[0] || "";
        } else {
          // For multi select, select all available options
          (newFilters as any)[dependentKey] = availableOptions;
        }
      }
    });
  }

  return newFilters;
}

// Initialize filter state from kernels
function initializeFilters(kernels: Kernel[]): FilterState {
  if (kernels.length === 0) {
    return {
      kernelType: "gemm",
      machine: "",
      backends: [],
      dtypes: [],
      tags: [],
      variants: [],
    };
  }

  const uniqueKernelTypes = getUniqueKernelTypes(kernels);
  const kernelType = uniqueKernelTypes[0] || "gemm";

  const initialFilters: FilterState = {
    kernelType,
    machine: "",
    backends: [],
    dtypes: [],
    tags: [],
    variants: [],
  };

  // Set initial values for all filters
  FILTER_CONFIGS.forEach((config) => {
    const options = config.getOptions(kernels, initialFilters);
    if (config.type === "single") {
      (initialFilters as any)[config.key] = options[0] || "";
    } else {
      (initialFilters as any)[config.key] = options;
    }
  });

  return initialFilters;
}

// Main hook
export function useKernelFilters(kernels: Kernel[]) {
  const [filters, setFilters] = useState<FilterState>(() =>
    initializeFilters(kernels)
  );

  // Update filters when kernels change
  useMemo(() => {
    if (kernels.length > 0) {
      const newFilters = initializeFilters(kernels);
      setFilters(newFilters);
    }
  }, [kernels]);

  // Compute available options based on current filter state
  const availableOptions: AvailableFilterOptions = useMemo(
    () => ({
      kernelTypes: FILTER_CONFIGS[0].getOptions(kernels, filters),
      machines: FILTER_CONFIGS[1].getOptions(kernels, filters),
      backends: FILTER_CONFIGS[2].getOptions(kernels, filters),
      dtypes: FILTER_CONFIGS[3].getOptions(kernels, filters),
      tags: FILTER_CONFIGS[4].getOptions(kernels, filters),
      variants: FILTER_CONFIGS[5].getOptions(kernels, filters),
    }),
    [kernels, filters]
  );

  // Filter kernels based on current filter state
  const filteredKernels = useMemo(() => {
    return kernels.filter((k) => {
      return (
        k.ok &&
        filters.backends.includes(k.backend) &&
        filters.dtypes.includes(k.dtype) &&
        filters.tags.includes(k.tag) &&
        filters.machine === k.machine &&
        filters.kernelType === k.kernelType &&
        (k.kernelType !== "gemm" ||
          filters.variants.includes(
            k.shape.transpose || k.shape.tA + k.shape.tB
          ))
      );
    });
  }, [kernels, filters]);

  // Update function with cascading logic
  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters((prevFilters) =>
      computeNewFilterState(prevFilters, key, value, kernels)
    );
  };

  return {
    filters,
    availableOptions,
    filteredKernels,
    updateFilter,
  };
}
