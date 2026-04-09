import type { WidgetProps } from "../types/dashboard";
import type { Kernel } from "../types";
import { BellComparisonPlot } from "../components/Plots/BellPlot";

/**
 * Widget wrapper around the existing BellComparisonPlot.
 *
 * Expected pipeline output: Kernel-shaped rows.
 * mapping.y selects the metric ("tflops" | "runtime"), defaulting to "tflops".
 */
export default function BellCurveWidget({ config, data }: WidgetProps) {
  const kernels = data as unknown as Kernel[];
  const metric = config.mapping.y ?? "tflops";

  if (kernels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No data for distribution plot
      </div>
    );
  }

  return <BellComparisonPlot kernels={kernels} metric={metric} />;
}
