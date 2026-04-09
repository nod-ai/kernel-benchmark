import { useState, useEffect, useCallback } from "react";
import type { DashboardConfig, DashboardSummary } from "../types/dashboard";
import {
  fetchDashboard,
  updateDashboard,
  createDashboard,
  listDashboards,
} from "../utils/github";

export function useDashboardConfig(slug: string | null) {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setConfig(null);
      return;
    }
    setIsLoading(true);
    setError(null);

    fetchDashboard(slug)
      .then((data) => setConfig(data))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [slug]);

  const save = useCallback(
    async (updated: DashboardConfig) => {
      const saved = await updateDashboard(updated._id, updated);
      setConfig(saved);
      return saved;
    },
    []
  );

  const create = useCallback(
    async (newConfig: Omit<DashboardConfig, "_id" | "createdAt" | "updatedAt">) => {
      const created = await createDashboard(newConfig as Partial<DashboardConfig>);
      setConfig(created);
      return created;
    },
    []
  );

  return { config, setConfig, isLoading, error, save, create };
}

export function useDashboardList() {
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setDashboards(await listDashboards());
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { dashboards, isLoading, refresh };
}
