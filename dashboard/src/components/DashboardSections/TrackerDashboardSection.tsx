import { useState, useEffect, useMemo, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { Calendar, TrendingUp, Settings } from "lucide-react";
import type { TrackerPerformancePoint, TrackerRunHistory } from "../../types";
import { getBackendColor } from "../../utils/color";
import { fetchTrackerRuns } from "../../utils/github";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title
);

interface TrackerDashboardSectionProps {
  trackerId: string;
  onRunSelected: (runId: string, blobName: string) => void;
  selectedRunBlobName: string | null;
}

export default function TrackerDashboardSection({
  trackerId,
  onRunSelected,
  selectedRunBlobName,
}: TrackerDashboardSectionProps) {
  const [runs, setRuns] = useState<TrackerRunHistory[]>([]);
  const [timeline, setTimeline] = useState<TrackerPerformancePoint[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [metric, setMetric] = useState<"tflops" | "runtime">("tflops");
  const [aggregation, setAggregation] = useState<"avg" | "geomean">("avg");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedMacrotile, setSelectedMacrotile] = useState<string>("");
  const [selectedKernelSource, setSelectedKernelSource] = useState<string>("");
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  // Fetch tracker runs and performance timeline
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const runsData = await fetchTrackerRuns(trackerId);
        setRuns(runsData);

        // Fetch performance timeline
        const params = new URLSearchParams();
        if (startDate) params.append("start_date", startDate);
        if (endDate) params.append("end_date", endDate);
        if (selectedMacrotile) params.append("macrotile", selectedMacrotile);
        if (selectedKernelSource) params.append("kernel_source", selectedKernelSource);

        const timelineResponse = await fetch(
          `${import.meta.env.VITE_BACKEND_SERVER_URL}/api/trackers/${trackerId}/performance${
            params.toString() ? `?${params.toString()}` : ""
          }`
        );
        const timelineData = await timelineResponse.json();
        setTimeline(timelineData);
      } catch (error) {
        console.error("Failed to fetch tracker data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [trackerId, startDate, endDate, selectedMacrotile, selectedKernelSource]);

  // Sync selectedRunId with the current selectedRunBlobName
  useEffect(() => {
    if (runs.length > 0 && selectedRunBlobName) {
      const matchingRun = runs.find((r) => r.run.blobName === selectedRunBlobName);
      if (matchingRun) {
        setSelectedRunId(matchingRun.run._id);
      }
    }
  }, [runs, selectedRunBlobName]);

  // Transform timeline data for chart
  const chartData = useMemo(() => {
    return timeline.map((point) => {
      const dataPoint: any = {
        timestamp: new Date(point.timestamp).toLocaleDateString(),
        fullTimestamp: point.timestamp,
        runId: point.runId,
        backendSpecs: point.backendSpecs || [],
      };

      // Add each backend's data
      Object.entries(point.backends).forEach(([backend, backendData]) => {
        const aggregationType = aggregation === "avg" ? "average" : "geoMean";
        const metricType = metric === "tflops" ? "tflops" : "runtimeUs";
        dataPoint[backend] = backendData[aggregationType][metricType];
      });

      return dataPoint;
    });
  }, [timeline, metric, aggregation]);

  // Get unique backends for chart lines
  const backends = useMemo(() => {
    const backendSet = new Set<string>();
    timeline.forEach((point) => {
      Object.keys(point.backends).forEach((backend) => backendSet.add(backend));
    });
    return Array.from(backendSet).sort();
  }, [timeline]);

  // Get available macrotiles and kernel sources from timeline
  const availableMacrotiles = useMemo(() => {
    const set = new Set<string>();
    timeline.forEach((point) => {
      point.availableMacrotiles?.forEach((m) => set.add(m));
    });
    return Array.from(set).sort();
  }, [timeline]);

  const availableKernelSources = useMemo(() => {
    const set = new Set<string>();
    timeline.forEach((point) => {
      point.availableKernelSources?.forEach((s) => set.add(s));
    });
    return Array.from(set).sort();
  }, [timeline]);

  // Create/update chart when data changes
  useEffect(() => {
    if (!canvasRef.current || chartData.length === 0) return;
    
    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Prepare datasets for each backend
    const datasets = backends.map((backend) => {
      const color = getBackendColor(backend);
      return {
        label: backend,
        data: chartData.map((point) => point[backend]),
        borderColor: color.string(),
        backgroundColor: color.alpha(0.1).string(),
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.1,
      };
    });

    // Create new chart
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: chartData.map((point) => point.timestamp),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: metric === "tflops" ? "TFLOPs" : "Runtime (μs)",
            },
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45,
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
          },
          tooltip: {
            callbacks: {
              title: (tooltipItems) => {
                if (tooltipItems.length === 0) return "";
                const dataIndex = tooltipItems[0].dataIndex;
                const point = chartData[dataIndex];
                return point?.fullTimestamp 
                  ? new Date(point.fullTimestamp).toLocaleString()
                  : "";
              },
              label: (context) => {
                const label = context.dataset.label || "";
                const value = context.parsed.y;
                return `${label}: ${value.toFixed(2)}`;
              },
              afterBody: (tooltipItems) => {
                if (tooltipItems.length === 0) return [];
                
                const dataIndex = tooltipItems[0].dataIndex;
                const point = chartData[dataIndex];
                
                if (!point?.backendSpecs || point.backendSpecs.length === 0) {
                  return ["", "No backend specs available"];
                }
                
                // Build backend spec info lines
                const lines: string[] = ["", "━━━ Backend Specifications ━━━"];
                point.backendSpecs.forEach((spec: any) => {
                  lines.push("");
                  lines.push(`${spec.name || spec.backend}:`);
                  if (spec.remoteRepository) {
                    lines.push(`  Repository: ${spec.remoteRepository}`);
                  }
                  if (spec.branch) {
                    lines.push(`  Branch: ${spec.branch}`);
                  }
                  if (spec.commitHash) {
                    lines.push(`  Commit: latest (${spec.commitHash.substring(0, 8)})`);
                  } else {
                    lines.push(`  Commit: will use latest from branch`);
                  }
                });
                
                return lines;
              },
            },
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            boxPadding: 4,
          },
        },
      },
    });

    // Cleanup on unmount
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [chartData, backends, metric]);

  const handleRunSelection = (runId: string) => {
    setSelectedRunId(runId);
    const selectedRun = runs.find((r) => r.run._id === runId);
    if (selectedRun) {
      onRunSelected(runId, selectedRun.run.blobName);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading tracker data...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Run Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-800">
            Select Run
          </h2>
        </div>

        {runs.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            <p>No completed runs with artifacts yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              value={selectedRunId}
              onChange={(e) => handleRunSelection(e.target.value)}
            >
              {runs.map((runHistory) => (
                <option key={runHistory.run._id} value={runHistory.run._id}>
                  {new Date(runHistory.run.timestamp).toLocaleString()} -{" "}
                  {runHistory.run.conclusion === "success" ? "✓" : "✗"}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Performance Timeline Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-800">
              Performance Over Time
            </h2>
          </div>
        </div>

        {/* Chart Controls */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-gray-500" />
            <h3 className="font-medium text-gray-700">Chart Settings</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-medium text-gray-600 text-sm">
                Metric:
              </label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                value={metric}
                onChange={(e) => setMetric(e.target.value as "tflops" | "runtime")}
              >
                <option value="tflops">TFLOPs</option>
                <option value="runtime">Runtime (μs)</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-medium text-gray-600 text-sm">
                Aggregation:
              </label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value as "avg" | "geomean")}
              >
                <option value="avg">Average</option>
                <option value="geomean">Geometric Mean</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-medium text-gray-600 text-sm">
                Start Date:
              </label>
              <input
                type="date"
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-medium text-gray-600 text-sm">
                End Date:
              </label>
              <input
                type="date"
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {availableMacrotiles.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="font-medium text-gray-600 text-sm">
                  Macrotile:
                </label>
                <select
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  value={selectedMacrotile}
                  onChange={(e) => {
                    setSelectedMacrotile(e.target.value);
                    if (e.target.value) setSelectedKernelSource("");
                  }}
                >
                  <option value="">All Macrotiles</option>
                  {availableMacrotiles.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            {availableKernelSources.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="font-medium text-gray-600 text-sm">
                  Source:
                </label>
                <select
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  value={selectedKernelSource}
                  onChange={(e) => {
                    setSelectedKernelSource(e.target.value);
                    if (e.target.value) setSelectedMacrotile("");
                  }}
                >
                  <option value="">All Sources</option>
                  {availableKernelSources.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Chart */}
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <TrendingUp className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-lg font-medium">No Performance Data</p>
            <p className="text-sm text-center">
              This tracker doesn't have any completed runs yet.
            </p>
          </div>
        ) : (
          <div className="relative h-[400px]">
            <canvas ref={canvasRef} />
          </div>
        )}
      </div>
    </div>
  );
}
