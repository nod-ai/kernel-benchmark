import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Cpu } from "lucide-react";
import PageContainer from "../components/PageContainer";
import {
  DispatchSelector,
  WaveSelector,
  TraceMetricsBar,
  PerformanceSummary,
  TimeseriesSection,
} from "../components/KernelTrace";
import { fetchRocprofDump } from "../utils/github";
import {
  analyzeDispatch,
  type DispatchResult,
  type TimeseriesKey,
} from "../utils/rocprof";

export default function KernelTrace() {
  const { runId: blobName } = useParams<{ runId: string }>();
  const [searchParams] = useSearchParams();
  const kernelName = searchParams.get("kernel") || "";
  const dumpKey = searchParams.get("dumpKey") || "";
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispatches, setDispatches] = useState<DispatchResult[]>([]);
  const [selectedDispatch, setSelectedDispatch] = useState(0);
  const [selectedWave, setSelectedWave] = useState(0);
  const [selectedTab, setSelectedTab] = useState<TimeseriesKey>("mfmaPair");

  const fetchAndProcess = useCallback(async () => {
    if (!blobName || !dumpKey) {
      setError("Missing blob name or dump key");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const traceData = await fetchRocprofDump(blobName, dumpKey);
      const results = traceData.dispatches.map(analyzeDispatch);
      const withWaves = results.filter((d) => d.waves.length > 0);

      if (withWaves.length === 0) {
        setError("No dispatches with analyzable MFMA instructions found");
        setDispatches([]);
      } else {
        setDispatches(withWaves);
        setSelectedDispatch(0);
        setSelectedWave(0);
        setSelectedTab("mfmaPair");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load trace data"
      );
    } finally {
      setIsLoading(false);
    }
  }, [blobName, dumpKey]);

  useEffect(() => {
    fetchAndProcess();
  }, [fetchAndProcess]);

  const currentDispatch = dispatches[selectedDispatch] ?? null;
  const currentWave = currentDispatch?.waves[selectedWave] ?? null;

  const handleDispatchChange = (idx: number) => {
    setSelectedDispatch(idx);
    setSelectedWave(0);
    setSelectedTab("mfmaPair");
  };

  const handleWaveChange = (idx: number) => {
    setSelectedWave(idx);
    setSelectedTab("mfmaPair");
  };

  return (
    <PageContainer activePage="dashboard" isLoading={isLoading}>
      <div className="flex flex-col gap-6 max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {kernelName || "Kernel Trace"}
            </h1>
            <p className="text-sm text-gray-500">
              ROCprof trace analysis
              {blobName && (
                <span className="ml-1 text-gray-400">· Run: {blobName}</span>
              )}
            </p>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Trace analysis content */}
        {currentDispatch && currentWave && (
          <>
            <DispatchSelector
              dispatches={dispatches}
              selectedIndex={selectedDispatch}
              onSelect={handleDispatchChange}
            />

            <WaveSelector
              waves={currentDispatch.waves}
              selectedIndex={selectedWave}
              onSelect={handleWaveChange}
            />

            <TraceMetricsBar metrics={currentWave.metrics} />

            <PerformanceSummary metrics={currentWave.metrics} />

            <TimeseriesSection
              timeseriesData={currentWave.timeseriesData}
              selectedTab={selectedTab}
              onTabChange={setSelectedTab}
              chartKeyPrefix={`${selectedDispatch}-${selectedWave}`}
            />
          </>
        )}

        {/* Empty state */}
        {!isLoading && !error && dispatches.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <Cpu className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No trace data available</p>
            <p className="text-sm mt-1">
              This kernel does not have rocprof trace results for this run.
            </p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
