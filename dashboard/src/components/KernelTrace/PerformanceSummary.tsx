import type { WaveMetrics } from "../../utils/rocprof";
import CycleDistChart from "./CycleDistChart";
import OverheadChart from "./OverheadChart";

export default function PerformanceSummary({ metrics }: { metrics: WaveMetrics }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Performance Summary
      </h2>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 text-center mb-3">
            Cycle Distribution
          </h3>
          <CycleDistChart metrics={metrics} />
        </div>
        <div className="xl:col-span-3 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 text-center mb-3">
            Instruction Overhead in Loops
          </h3>
          <OverheadChart metrics={metrics} />
        </div>
      </div>
    </div>
  );
}
