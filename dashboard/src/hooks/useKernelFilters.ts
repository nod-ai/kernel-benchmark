import { useState, useMemo, useEffect } from "react";
import type { Kernel } from "../types";

// Filter state interface
export interface FilterState {
  kernelType: string;
  machine: string;
  backends: string[];
  dtypes: string[];
  tags: string[];
  variants: string[];
  macrotiles: string[];
  kernelSources: string[];
}

// Available options for each filter
export interface AvailableFilterOptions {
  kernelTypes: string[];
  machines: string[];
  backends: string[];
  dtypes: string[];
  tags: string[];
  variants: string[];
  macrotiles: string[];
  kernelSources: string[];
}

// Filter configuration type
export interface FilterDefinition {
  key: keyof FilterState;
  type: "single" | "multi";
  title: string;
  getOptions: (kernels: Kernel[], filters: FilterState) => string[];
  cascades?: (keyof FilterState)[];
  condition?: (filters: FilterState, kernels: Kernel[]) => boolean; // When to show this filter
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

function getUniqueMacrotiles(kernels: Kernel[], filters: FilterState): string[] {
  const filteredKernels = kernels.filter(
    (k) => k.kernelType === filters.kernelType && k.machine === filters.machine
  );
  const tiles = filteredKernels
    .map((k) => {
      const tc = k.tuningConfig;
      if (tc?.BLOCK_M != null && tc?.BLOCK_N != null && tc?.BLOCK_K != null) {
        return `${tc.BLOCK_M}×${tc.BLOCK_N}×${tc.BLOCK_K}`;
      }
      return null;
    })
    .filter((t): t is string => t !== null);
  return Array.from(new Set(tiles)).sort();
}

function getUniqueMacrotileForKernel(k: Kernel): string | null {
  const tc = k.tuningConfig;
  if (tc?.BLOCK_M != null && tc?.BLOCK_N != null && tc?.BLOCK_K != null) {
    return `${tc.BLOCK_M}×${tc.BLOCK_N}×${tc.BLOCK_K}`;
  }
  return null;
}

function getUniqueKernelSources(kernels: Kernel[], filters: FilterState): string[] {
  const filteredKernels = kernels.filter(
    (k) => k.kernelType === filters.kernelType && k.machine === filters.machine
  );
  return Array.from(
    new Set(filteredKernels.map((k) => k.kernelSource).filter((s): s is string => !!s))
  ).sort();
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

// Build filter configs (kernel type options come from the kernels list only)
function getFilterConfigs(
  getUniqueKernelTypesFromKernels: (kernels: Kernel[]) => string[]
): FilterDefinition[] {
  return [
    {
      key: "kernelType",
      type: "single",
      title: "Kernel Type",
      getOptions: (kernels) => getUniqueKernelTypesFromKernels(kernels),
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
      condition: (filters, _kernels) => filters.kernelType === "gemm",
    },
    {
      key: "macrotiles",
      type: "multi",
      title: "Macrotile",
      getOptions: getUniqueMacrotiles,
      condition: (filters, kernels) => getUniqueMacrotiles(kernels, filters).length > 0,
    },
    {
      key: "kernelSources",
      type: "multi",
      title: "Source",
      getOptions: getUniqueKernelSources,
      condition: (filters, kernels) => getUniqueKernelSources(kernels, filters).length > 0,
    },
  ];
}

// Compute new filter state with cascading updates
function computeNewFilterState(
  currentFilters: FilterState,
  changedKey: keyof FilterState,
  newValue: any,
  kernels: Kernel[],
  filterConfigs: FilterDefinition[]
): FilterState {
  const newFilters = { ...currentFilters, [changedKey]: newValue };

  // Find the configuration for the changed filter
  const config = filterConfigs.find((c) => c.key === changedKey);

  if (config?.cascades) {
    // Reset dependent filters to "all available" when parent changes
    config.cascades.forEach((dependentKey) => {
      const dependentConfig = filterConfigs.find(
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
function initializeFilters(
  kernels: Kernel[],
  filterConfigs: FilterDefinition[]
): FilterState {
  if (kernels.length === 0) {
    const emptyFilters: FilterState = {
      kernelType: "",
      machine: "",
      backends: [],
      dtypes: [],
      tags: [],
      variants: [],
      macrotiles: [],
      kernelSources: [],
    };
    const kernelTypeOptions =
      filterConfigs[0]?.getOptions([], emptyFilters) ?? [];
    return {
      kernelType: kernelTypeOptions[0] ?? "",
      machine: "",
      backends: [],
      dtypes: [],
      tags: [],
      variants: [],
      macrotiles: [],
      kernelSources: [],
    };
  }

  const uniqueKernelTypes = getUniqueKernelTypes(kernels);
  const kernelType = uniqueKernelTypes[0] ?? "";

  const initialFilters: FilterState = {
    kernelType,
    machine: "",
    backends: [],
    dtypes: [],
    tags: [],
    variants: [],
    macrotiles: [],
    kernelSources: [],
  };

  // Set initial values for all filters
  filterConfigs.forEach((config) => {
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
  const filterConfigs = useMemo(
    () => getFilterConfigs(getUniqueKernelTypes),
    []
  );

  // Only use successful kernels for deriving filter options
  const successKernels = useMemo(() => kernels.filter((k) => k.ok), [kernels]);

  const [filters, setFilters] = useState<FilterState>(() =>
    initializeFilters(successKernels, filterConfigs)
  );

  // Update filters when kernels or filter configs change
  useEffect(() => {
    if (successKernels.length > 0) {
      setFilters(initializeFilters(successKernels, filterConfigs));
    }
  }, [successKernels, filterConfigs]);

  // Compute available options based on current filter state
  const availableOptions: AvailableFilterOptions = useMemo(
    () => ({
      kernelTypes: filterConfigs[0].getOptions(successKernels, filters),
      machines: filterConfigs[1].getOptions(successKernels, filters),
      backends: filterConfigs[2].getOptions(successKernels, filters),
      dtypes: filterConfigs[3].getOptions(successKernels, filters),
      tags: filterConfigs[4].getOptions(successKernels, filters),
      variants: filterConfigs[5].getOptions(successKernels, filters),
      macrotiles: filterConfigs[6].getOptions(successKernels, filters),
      kernelSources: filterConfigs[7].getOptions(successKernels, filters),
    }),
    [successKernels, filters, filterConfigs]
  );

  // Filter kernels based on current filter state
  const filteredKernels = useMemo(() => {
    return successKernels.filter((k) => {
      const macrotile = getUniqueMacrotileForKernel(k);
      const macrotileMatch =
        filters.macrotiles.length === 0 ||
        macrotile === null ||
        filters.macrotiles.includes(macrotile);
      const kernelSourceMatch =
        filters.kernelSources.length === 0 ||
        !k.kernelSource ||
        filters.kernelSources.includes(k.kernelSource);
      return (
        filters.backends.includes(k.backend) &&
        filters.dtypes.includes(k.dtype) &&
        filters.tags.includes(k.tag) &&
        filters.machine === k.machine &&
        filters.kernelType === k.kernelType &&
        (k.kernelType !== "gemm" ||
          filters.variants.includes(
            k.shape.transpose || k.shape.tA + k.shape.tB
          )) &&
        macrotileMatch &&
        kernelSourceMatch
      );
    });
  }, [successKernels, filters]);

  // Update function with cascading logic
  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters((prevFilters) =>
      computeNewFilterState(prevFilters, key, value, successKernels, filterConfigs)
    );
  };

  return {
    filters,
    availableOptions,
    filteredKernels,
    updateFilter,
    filterConfigs,
  };
}
