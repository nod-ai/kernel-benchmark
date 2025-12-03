import RooflinePlot from "../components/Plots/RooflinePlot";
import { BarComparisonPlot } from "../components/Plots/BarPlot";
import { BellComparisonPlot } from "../components/Plots/BellPlot";
import { DashboardFilterControls } from "../components/FilterControls";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Filter, Settings, TrendingUp } from "lucide-react";
import type { Kernel } from "../types";
import { fetchData } from "../utils/csv";
import KernelView from "../components/Kernels/KernelView";
import PageContainer from "../components/PageContainer";
import {
  filterKernelsByPercentile,
  getCommonKernels,
  KERNEL_DIMS,
} from "../utils/utils";
import { useParams } from "react-router-dom";
import { useKernelFilters } from "../hooks/useKernelFilters";

export default function Dashboard() {
  const [kernels, setKernels] = useState<Kernel[]>([]);
  const [selectedKernelId, setSelectedKernelId] = useState<string | null>(null);
  const [graphType, setGraphType] = useState<string>("bar");
  const [comparisonMetric, setComparisonMetric] = useState<string>("tflops");
  const [percentile, setPercentile] = useState<number>(90);

  const { runId } = useParams();

  // Use the new filter hook
  const { filters, availableOptions, filteredKernels, updateFilter } =
    useKernelFilters(kernels);

  useEffect(() => {
    if (runId) fetchData(runId).then(setKernels);
  }, [runId]);

  // const filteredWaveKernels = useMemo(
  //   () =>
  //     filteredKernels.filter((k) => k.backend.toLowerCase().startsWith("wave")),
  //   [filteredKernels]
  // );

  const selectedKernel = useMemo(
    () => kernels.find((k) => k.id === selectedKernelId),
    [kernels, selectedKernelId]
  );

  const sameShapeKernels = useMemo(() => {
    if (!selectedKernel) return [];
    return kernels.filter((k) => {
      if (k.kernelType !== selectedKernel.kernelType) return false;
      if (k.dtype !== selectedKernel.dtype) return false;
      return KERNEL_DIMS[k.kernelType].every(
        (dimName) => k.shape[dimName] === selectedKernel.shape[dimName]
      );
    });
  }, [kernels, selectedKernel]);

  const commonKernels = useMemo(
    () =>
      filterKernelsByPercentile(
        getCommonKernels(filteredKernels),
        Math.min(Math.max(percentile / 100, 0), 1)
      ),
    [filteredKernels, percentile]
  );

  return (
    <PageContainer activePage="dashboard" isLoading={kernels.length === 0}>
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
            />
          </div>
        )}
      </div>
    </PageContainer>
  );
}
