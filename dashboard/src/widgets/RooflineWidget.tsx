import { useState } from "react";
import type { WidgetProps } from "../types/dashboard";
import type { Kernel } from "../types";
import RooflinePlot from "../components/Plots/RooflinePlot";

/**
 * Widget wrapper around the existing RooflinePlot.
 *
 * Expected pipeline output: an array of Kernel objects (or rows containing
 * the fields RooflinePlot needs: id, backend, tflops, arithmeticIntensity).
 */
export default function RooflineWidget({ data }: WidgetProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const kernels = data as unknown as Kernel[];
  const selectedKernel = kernels.find((k) => k.id === selectedId);

  if (kernels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No data for roofline plot
      </div>
    );
  }

  return (
    <RooflinePlot
      kernels={kernels}
      setSelected={setSelectedId}
      selectedKernel={selectedKernel}
    />
  );
}
