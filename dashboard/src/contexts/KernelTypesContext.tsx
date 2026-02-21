import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { KernelTypeDefinition } from "../types";
import { fetchKernelTypes } from "../utils/github";

/** Map kernel type name -> list of dimension/attribute names (includes "dtype" for UI) */
export type KernelDimsMap = Record<string, string[]>;

function buildKernelDims(kernelTypes: KernelTypeDefinition[]): KernelDimsMap {
  const map: KernelDimsMap = {};
  for (const kt of kernelTypes) {
    const attrNames = kt.attributes.map((a) => a.name);
    map[kt.name] = attrNames.includes("dtype")
      ? [...attrNames]
      : [...attrNames, "dtype"];
  }
  return map;
}

interface KernelTypesContextValue {
  kernelTypes: KernelTypeDefinition[];
  kernelDims: KernelDimsMap;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const KernelTypesContext = createContext<KernelTypesContextValue | null>(null);

export function KernelTypesProvider({ children }: { children: ReactNode }) {
  const [kernelTypes, setKernelTypes] = useState<KernelTypeDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const types = await fetchKernelTypes();
      setKernelTypes(types);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setKernelTypes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const kernelDims = useMemo(
    () => buildKernelDims(kernelTypes),
    [kernelTypes]
  );

  const value = useMemo(
    () => ({
      kernelTypes,
      kernelDims,
      isLoading,
      error,
      refetch: load,
    }),
    [kernelTypes, kernelDims, isLoading, error]
  );

  return (
    <KernelTypesContext.Provider value={value}>
      {children}
    </KernelTypesContext.Provider>
  );
}

export function useKernelTypes(): KernelTypesContextValue {
  const ctx = useContext(KernelTypesContext);
  if (!ctx) {
    throw new Error("useKernelTypes must be used within KernelTypesProvider");
  }
  return ctx;
}

export function useKernelDims(): KernelDimsMap {
  return useKernelTypes().kernelDims;
}
