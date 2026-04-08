import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import type { Kernel } from "../types";
import type { DashboardConfig } from "../types/dashboard";
import { fetchData } from "../utils/csv";
import PageContainer from "../components/PageContainer";
import DashboardRenderer from "../components/DashboardRenderer";
import { useDashboardConfig } from "../hooks/useDashboardConfig";
import { initGlobalFilterValues } from "../hooks/useGlobalFilters";
import { updateDashboard } from "../utils/github";

/**
 * Renders a saved custom dashboard loaded by slug from the backend.
 * Route: /dashboard/config/:slug
 */
export default function CustomDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const { config, setConfig, isLoading: configLoading, error } = useDashboardConfig(slug ?? null);

  const [kernels, setKernels] = useState<Kernel[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [globalFilterValues, setGlobalFilterValues] = useState<Record<string, any>>({});

  // For now, custom dashboards operate on the "baseline" artifact
  // TODO: allow the dashboard config to specify its data source artifact
  useEffect(() => {
    setDataLoading(true);
    fetchData("baseline")
      .then(setKernels)
      .finally(() => setDataLoading(false));
  }, []);

  // Initialize global filter values once config + data are ready,
  // and fill in values for any newly-added filters.
  useEffect(() => {
    if (!config || kernels.length === 0) return;
    setGlobalFilterValues((prev) => {
      const fresh = initGlobalFilterValues(
        config.globalFilters,
        kernels as unknown as Record<string, any>[]
      );
      if (Object.keys(prev).length === 0) return fresh;
      const next = { ...prev };
      let changed = false;
      for (const [k, v] of Object.entries(fresh)) {
        if (next[k] === undefined) {
          next[k] = v;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [config, kernels]);

  const handleGlobalFilterChange = useCallback((filterId: string, value: any) => {
    setGlobalFilterValues((prev) => ({ ...prev, [filterId]: value }));
  }, []);

  const handleSave = useCallback(
    async (updated: DashboardConfig) => {
      await updateDashboard(updated._id, updated);
    },
    []
  );

  const isLoading = configLoading || dataLoading;

  return (
    <PageContainer activePage="dashboard" isLoading={isLoading}>
      {error && (
        <div className="text-center py-12 text-red-500">
          <p>{error}</p>
        </div>
      )}
      {config && kernels.length > 0 && (
        <DashboardRenderer
          config={config}
          rawData={kernels as unknown as Record<string, any>[]}
          globalFilterValues={globalFilterValues}
          onGlobalFilterChange={handleGlobalFilterChange}
          onConfigChange={setConfig}
          onSave={handleSave}
        />
      )}
      {!isLoading && !error && kernels.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No kernel data available.</p>
        </div>
      )}
    </PageContainer>
  );
}
