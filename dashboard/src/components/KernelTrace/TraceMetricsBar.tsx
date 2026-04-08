import { Activity, Cpu, Gauge, Zap } from "lucide-react";
import type { WaveMetrics } from "../../utils/rocprof";
import MetricCard from "./MetricCard";

export default function TraceMetricsBar({ metrics }: { metrics: WaveMetrics }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        value={metrics.totalCycles.toLocaleString()}
        label="Total Cycles"
        icon={<Activity className="w-4 h-4" />}
      />
      <MetricCard
        value={`${metrics.kernelEfficiency}%`}
        label="Kernel Efficiency"
        icon={<Gauge className="w-4 h-4" />}
      />
      <MetricCard
        value={`${metrics.loopEfficiency}%`}
        label="Loop Efficiency"
        icon={<Zap className="w-4 h-4" />}
      />
      <MetricCard
        value={metrics.mfmaCycles.toLocaleString()}
        label="MFMA Cycles"
        icon={<Cpu className="w-4 h-4" />}
      />
    </div>
  );
}
