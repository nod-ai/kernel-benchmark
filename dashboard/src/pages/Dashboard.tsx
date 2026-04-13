import { useEffect, useState, useCallback, useMemo } from "react";
import type { Kernel, Tracker } from "../types";
import type { DashboardConfig } from "../types/dashboard";
import { fetchData } from "../utils/csv";
import PageContainer from "../components/PageContainer";
import { useLocation } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import TrackerDashboardSection from "../components/DashboardSections/TrackerDashboardSection";
import DashboardRenderer from "../components/DashboardRenderer";
import { DEFAULT_MODULAR_CONFIG } from "../widgets/defaults";
import {
  fetchTrackerByDashboardName,
  fetchTrackerRuns,
  fetchDashboard,
  saveDashboard,
  fetchProfilingManifest,
  type ProfilingManifest,
} from "../utils/github";

function deriveConfigSlug(pathname: string): string {
  const segment = pathname.split("/").pop() ?? "";
  if (pathname.includes("/dashboard/tracker/")) {
    return `tracker-${segment}`;
  }
  return `run-${segment}`;
}

export default function Dashboard() {
  const [kernels, setKernels] = useState<Kernel[]>([]);
  const [isTrackerDashboard, setIsTrackerDashboard] = useState(false);
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [selectedRunBlobName, setSelectedRunBlobName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [runBackendSpecs, setRunBackendSpecs] = useState<Record<string, any> | null>(null);

  const [modularConfig, setModularConfig] = useState<DashboardConfig>(DEFAULT_MODULAR_CONFIG);
  const [globalFilterValues, setGlobalFilterValues] = useState<Record<string, any>>({});
  const [profilingManifest, setProfilingManifest] = useState<ProfilingManifest | null>(null);

  const location = useLocation();
  const configSlug = useMemo(() => deriveConfigSlug(location.pathname), [location.pathname]);

  // Load saved modular config for this context, or fall back to the hardcoded default.
  useEffect(() => {
    setGlobalFilterValues({});
    fetchDashboard(configSlug)
      .then((saved) => setModularConfig(saved))
      .catch(() => {
        setModularConfig({
          ...DEFAULT_MODULAR_CONFIG,
          slug: configSlug,
        });
      });
  }, [configSlug]);

  // Detect dashboard type from URL and load initial data
  useEffect(() => {
    const detectDashboardType = async () => {
      setIsLoading(true);
      
      if (location.pathname.includes('/dashboard/tracker/')) {
        setIsTrackerDashboard(true);
        const dashboardName = location.pathname.split('/').pop();
        
        try {
          const trackerData = await fetchTrackerByDashboardName(dashboardName!);
          setTracker(trackerData as unknown as Tracker);
          
          const runsData = await fetchTrackerRuns(trackerData._id!);
          
          if (runsData.length > 0) {
            const latestRun = runsData[0];
            setSelectedRunBlobName(latestRun.run.blobName);
          }
        } catch (error) {
          console.error("Failed to fetch tracker:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsTrackerDashboard(false);
        const runIdOrBlobName = location.pathname.split('/').pop();
        setSelectedRunBlobName(runIdOrBlobName || null);

        if (runIdOrBlobName) {
          try {
            const response = await fetch(
              `${import.meta.env.VITE_BACKEND_SERVER_URL}/api/runs?page=1&page_size=1000&completed_only=true`
            );
            const data = await response.json();
            const runs = data.runs || [];
            const item = runs.find((r: any) =>
              r.run?.blobName === runIdOrBlobName || r.run?._id === runIdOrBlobName
            );
            if (item?.trigger?.metadata?.backendSpecs) {
              const specsMap: Record<string, any> = {};
              item.trigger.metadata.backendSpecs.forEach((spec: any) => {
                const key = spec.backendParam || spec.backend;
                specsMap[key] = spec;
              });
              setRunBackendSpecs(specsMap);
            }
          } catch (error) {
            console.error("Failed to fetch run backend specs:", error);
          }
        }

        setIsLoading(false);
      }
    };

    detectDashboardType();
  }, [location.pathname]);

  useEffect(() => {
    if (selectedRunBlobName) {
      fetchData(selectedRunBlobName).then(setKernels);
      fetchProfilingManifest(selectedRunBlobName)
        .then(setProfilingManifest)
        .catch(() => setProfilingManifest(null));
    }
  }, [selectedRunBlobName]);

  // Initialize global filter defaults once kernel data arrives, and
  // fill in values for any newly-added filters.
  useEffect(() => {
    if (kernels.length === 0) return;
    setGlobalFilterValues((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const gf of modularConfig.globalFilters) {
        if (next[gf.id] !== undefined) continue;
        changed = true;
        if (gf.defaultValue !== undefined) {
          next[gf.id] = gf.defaultValue;
        } else {
          const unique = [...new Set(kernels.map((k: any) => k[gf.field]).filter(Boolean))];
          next[gf.id] = gf.type === "single" ? unique[0] ?? "" : unique;
        }
      }
      return changed ? next : prev;
    });
  }, [kernels, modularConfig.globalFilters]);

  const handleRunSelected = (_runId: string, blobName: string) => {
    setSelectedRunBlobName(blobName);
  };

  const handleGlobalFilterChange = useCallback((filterId: string, value: any) => {
    setGlobalFilterValues((prev) => ({ ...prev, [filterId]: value }));
  }, []);

  const handleModularSave = useCallback(async (cfg: DashboardConfig) => {
    const toSave = { ...cfg, slug: configSlug };
    const saved = await saveDashboard(toSave);
    if (cfg._id.startsWith("__")) {
      setModularConfig((prev) => ({ ...prev, _id: saved._id, slug: saved.slug }));
    }
  }, [configSlug]);

  return (
    <PageContainer activePage="dashboard" isLoading={isLoading}>
      <div className="flex flex-col gap-6">
        {/* Compact Tracker Header */}
        {isTrackerDashboard && tracker && (
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200 px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{tracker.name}</h1>
                <p className="text-xs text-gray-600">Performance tracking dashboard</p>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard widgets */}
        {kernels.length > 0 && (
          <DashboardRenderer
            config={modularConfig}
            rawData={kernels as unknown as Record<string, any>[]}
            globalFilterValues={globalFilterValues}
            onGlobalFilterChange={handleGlobalFilterChange}
            onConfigChange={setModularConfig}
            onSave={handleModularSave}
            isTrackerDashboard={isTrackerDashboard}
            profilingManifest={profilingManifest}
            blobName={selectedRunBlobName}
            latestBackendSpecs={runBackendSpecs}
          />
        )}
        
        {/* Tracker Controls and Timeline */}
        {isTrackerDashboard && tracker && (
          <TrackerDashboardSection
            trackerId={tracker._id}
            onRunSelected={handleRunSelected}
            selectedRunBlobName={selectedRunBlobName}
          />
        )}
        
        {!isTrackerDashboard && kernels.length === 0 && !isLoading && (
          <div className="text-center py-12 text-gray-500">
            <p>No kernel data available for this run.</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
