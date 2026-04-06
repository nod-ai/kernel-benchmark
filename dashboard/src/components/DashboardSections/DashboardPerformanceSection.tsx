import RooflinePlot from "../Plots/RooflinePlot";
import { BarComparisonPlot } from "../Plots/BarPlot";
import { BellComparisonPlot } from "../Plots/BellPlot";
import { DashboardFilterControls } from "../FilterControls";
import { useMemo, useState, useEffect } from "react";
import { AlertTriangle, BarChart3, Filter, Settings, TrendingUp } from "lucide-react";
import type { Kernel, BackendSpec } from "../../types";
import KernelView from "../Kernels/KernelView";
import {
  filterKernelsByPercentile,
  getCommonKernels,
  getDimensionsForKernelType,
} from "../../utils/utils";
import { useKernelFilters } from "../../hooks/useKernelFilters";
import { useKernelDims } from "../../contexts/KernelTypesContext";

interface DashboardPerformanceSectionProps {
  kernels: Kernel[];
  isLoading?: boolean;
  latestBackendSpecs?: Record<string, BackendSpec>; // Optional: backend specs from run or tracker
  trackerId?: string; // Optional: to fetch backend specs from latest tracker run
}

export default function DashboardPerformanceSection({
  kernels,
  isLoading = false,
  latestBackendSpecs: propBackendSpecs,
  trackerId,
}: DashboardPerformanceSectionProps) {
  const [selectedKernelId, setSelectedKernelId] = useState<string | null>(null);
  const [graphType, setGraphType] = useState<string>("bar");
  const [comparisonMetric, setComparisonMetric] = useState<string>("tflops");
  const [percentile, setPercentile] = useState<number>(90);
  const [trackerBackendSpecs, setTrackerBackendSpecs] = useState<Record<string, BackendSpec>>({});

  const kernelDims = useKernelDims();
  // Use the filter hook
  const { filters, availableOptions, filteredKernels, updateFilter, filterConfigs } =
    useKernelFilters(kernels);
  
  // Determine which backend specs to use: prop (from run) or tracker (fetched)
  const latestBackendSpecs = propBackendSpecs || trackerBackendSpecs;
  
  // Fetch backend specs from tracker if trackerId is provided
  useEffect(() => {
    const fetchTrackerBackendSpecs = async () => {
      if (!trackerId) return;
      
      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_SERVER_URL}/api/trackers/${trackerId}/performance`
        );
        const timeline = await response.json();
        
        if (timeline.length > 0) {
          // Find the latest point that has backendSpecs, fallback to last point
          const latestPoint = [...timeline].reverse().find(point => 
            point.backendSpecs && Array.isArray(point.backendSpecs) && point.backendSpecs.length > 0
          ) || timeline[timeline.length - 1];
          
          console.log("Timeline points:", timeline.length);
          console.log("Latest point with specs:", latestPoint);
          console.log("Latest point backendSpecs:", latestPoint.backendSpecs);
          
          if (latestPoint.backendSpecs && Array.isArray(latestPoint.backendSpecs)) {
            // Convert array to Record<backendParam, spec> to match filter option values
            const specsMap: Record<string, BackendSpec> = {};
            latestPoint.backendSpecs.forEach((spec: BackendSpec) => {
              const key = (spec as any).backendParam || spec.backend;
              specsMap[key] = spec;
            });
            setTrackerBackendSpecs(specsMap);
          }
        }
      } catch (error) {
        console.error("Failed to fetch tracker backend specs:", error);
      }
    };
    
    fetchTrackerBackendSpecs();
  }, [trackerId]);

  const selectedKernel = useMemo(
    () => kernels.find((k) => k.id === selectedKernelId),
    [kernels, selectedKernelId]
  );

  const sameShapeKernels = useMemo(() => {
    if (!selectedKernel) return [];
    const dims = getDimensionsForKernelType(
      selectedKernel.kernelType,
      kernelDims,
      selectedKernel.shape
    );
    return kernels.filter((k) => {
      if (k.kernelType !== selectedKernel.kernelType) return false;
      if (k.dtype !== selectedKernel.dtype) return false;
      return dims.every(
        (dimName) =>
          (dimName === "dtype"
            ? k.dtype === selectedKernel.dtype
            : k.shape[dimName] === selectedKernel.shape[dimName])
      );
    });
  }, [kernels, selectedKernel, kernelDims]);

  const commonKernels = useMemo(
    () =>
      filterKernelsByPercentile(
        getCommonKernels(filteredKernels, kernelDims),
        Math.min(Math.max(percentile / 100, 0), 1)
      ),
    [filteredKernels, percentile, kernelDims]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading kernel data...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Filter className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
        </div>

        <DashboardFilterControls
          filters={filters}
          availableOptions={availableOptions}
          updateFilter={updateFilter}
          latestBackendSpecs={latestBackendSpecs}
          isTrackerDashboard={!!trackerId}
          filterConfigs={filterConfigs}
          kernels={kernels}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Roofline Plot Section */}
        <div className="xl:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-800">
              Roofline Plot
            </h2>
          </div>

          {commonKernels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <TrendingUp className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium">No Common Kernels Found</p>
              <p className="text-sm text-center">
                Try adjusting your filters to see results on the roofline
                plot.
              </p>
            </div>
          ) : (
            <div className="flex justify-center">
              <RooflinePlot
                kernels={commonKernels}
                setSelected={setSelectedKernelId}
                selectedKernel={selectedKernel}
              />
            </div>
          )}
        </div>

        {/* Comparison Plot Section */}
        <div className="xl:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-800">
              Performance Comparison
            </h2>
          </div>

          {!selectedKernelId && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-gray-500" />
                <h3 className="font-medium text-gray-700">Plot Settings</h3>
              </div>

              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <label className="font-medium text-gray-600 text-sm">
                    Graph Type:
                  </label>
                  <select
                    className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    value={graphType}
                    onChange={(e) => setGraphType(e.currentTarget.value)}
                  >
                    <option value="bar">Bar Chart</option>
                    <option value="bell">Frequency Distribution</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="font-medium text-gray-600 text-sm">
                    Metric:
                  </label>
                  <select
                    className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    value={comparisonMetric}
                    onChange={(e) =>
                      setComparisonMetric(e.currentTarget.value)
                    }
                  >
                    <option value="tflops">TFLOPs</option>
                    <option value="runtime">Runtime (μs)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="font-medium text-gray-600 text-sm">
                    Percentile:
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm w-20"
                      type="number"
                      min={1}
                      max={100}
                      value={percentile}
                      onChange={(e) =>
                        setPercentile(parseFloat(e.currentTarget.value))
                      }
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-800">
              {comparisonMetric === "tflops"
                ? "Average TFLOPs"
                : "Average Runtime (μs)"}
              {selectedKernel && (
                <span className="text-sm font-normal text-gray-600 block mt-1">
                  {selectedKernel.name}
                </span>
              )}
            </h3>
          </div>

          {commonKernels.length === 0 && !selectedKernelId ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <BarChart3 className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium">No Data Available</p>
              <p className="text-sm text-center">
                Adjust your filters to see performance comparison data.
              </p>
            </div>
          ) : (
            <div className="flex justify-center">
              {graphType === "bar" || selectedKernelId ? (
                <BarComparisonPlot
                  kernels={
                    selectedKernelId ? sameShapeKernels : commonKernels
                  }
                  metric={comparisonMetric}
                />
              ) : (
                <BellComparisonPlot
                  kernels={
                    selectedKernelId ? sameShapeKernels : commonKernels
                  }
                  metric={comparisonMetric}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {selectedKernel && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <KernelView
            selectedKernel={selectedKernel}
            sameShapeKernels={sameShapeKernels}
            kernels={kernels}
            setSelected={setSelectedKernelId}
            dimensions={getDimensionsForKernelType(
              selectedKernel.kernelType,
              kernelDims,
              selectedKernel.shape
            )}
          />
        </div>
      )}

      <FailurePanel kernels={kernels} />
    </div>
  );
}

function FailurePanel({ kernels }: { kernels: Kernel[] }) {
  const failedKernels = useMemo(
    () => kernels.filter((k) => !k.ok),
    [kernels]
  );

  if (failedKernels.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        <h2 className="text-lg font-semibold text-gray-800">
          Failed Kernels
          <span className="ml-2 text-sm font-normal text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            {failedKernels.length}
          </span>
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-red-50 border-b border-red-200">
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Backend</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Shape</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Macrotile</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-red-100">
            {failedKernels.map((k) => {
              const macrotile =
                k.tuningConfig?.BLOCK_M != null
                  ? `${k.tuningConfig.BLOCK_M}×${k.tuningConfig.BLOCK_N}×${k.tuningConfig.BLOCK_K}`
                  : "—";
              const shapeParts = Object.entries(k.shape)
                .map(([dim, val]) => `${dim}=${val}`)
                .join(", ");
              return (
                <tr key={k.id} className="hover:bg-red-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-700">{k.backend}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">{shapeParts}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">{macrotile}</td>
                  <td className="px-4 py-2 font-mono text-xs text-red-700 max-w-md truncate" title={k.errorMsg}>
                    {k.errorMsg ?? "Unknown error"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
