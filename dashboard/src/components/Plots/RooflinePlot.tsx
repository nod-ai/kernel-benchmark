import { useEffect, useRef } from "react";
import {
  Chart,
  ScatterController,
  LinearScale,
  LogarithmicScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  LineElement,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import type { Kernel } from "../../types";
import { getValueColor } from "../../utils/color";
import { findDumpKeyForKernel } from "../../utils/rocprof";

Chart.register(
  ScatterController,
  LinearScale,
  LogarithmicScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  LineElement,
  zoomPlugin,
);

interface MachineRooflineStats {
  compute: number;
  memory: number;
}

const ROOFLINE_BY_MACHINE: Record<string, MachineRooflineStats> = {
  MI300X: {
    compute: 1300,
    memory: 5.3,
  },
  MI325X: {
    compute: 1300,
    memory: 5.3,
  },
  MI350X: {
    compute: 2300,
    memory: 8,
  },
  MI355X: {
    compute: 2300,
    memory: 8,
  },
};

interface RooflinePlotProps {
  kernels: Kernel[];
  selectedKernel?: Kernel;
  setSelected: (kernelId: string | null) => void;
  groupByField?: string;
  profilingManifest?: Record<string, any> | null;
}

export default function RooflinePlot({
  kernels,
  setSelected,
  selectedKernel,
  groupByField = "backend",
  profilingManifest,
}: RooflinePlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const grouped = kernels.reduce<
      Record<string, { x: number; y: number; id: string; name: string; backend: string }[]>
    >((acc, kernel) => {
      const groupKey = String((kernel as any)[groupByField] ?? kernel.backend);
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push({
        x: kernel.arithmeticIntensity,
        y: kernel.tflops,
        id: kernel.id,
        name: kernel.name,
        backend: kernel.backend,
      });
      return acc;
    }, {});

    const datasets = Object.entries(grouped).map(([groupValue, points]) => ({
      label: groupValue,
      data: points.filter((point) => point.id !== selectedKernel?.id),
      borderColor: getValueColor(groupValue).string(),
      backgroundColor: selectedKernel
        ? "rgba(200, 200, 200, 0.3)"
        : getValueColor(groupValue).string(),
      showLine: false,
      pointRadius: 6,
      pointHitRadius: 12,
    }));

    if (selectedKernel) {
      const selGroup = String((selectedKernel as any)[groupByField] ?? selectedKernel.backend);
      datasets.push({
        label: selGroup,
        data: [
          {
            x: selectedKernel.arithmeticIntensity,
            y: selectedKernel.tflops,
            id: selectedKernel.id,
            name: selectedKernel.name,
            backend: selectedKernel.backend,
          },
        ],
        borderColor: getValueColor(selGroup).string(),
        backgroundColor: getValueColor(selGroup).string(),
        showLine: false,
        pointRadius: 8,
        pointHitRadius: 12,
      });
    }

    const xMin = Math.max(
      0.01,
      Math.min(...kernels.map((k) => k.arithmeticIntensity)),
    );
    const xMax = Math.max(...kernels.map((k) => k.arithmeticIntensity)) * 2;

    const machine = kernels[0].machine.toUpperCase();
    const peakMemoryBandwidth = ROOFLINE_BY_MACHINE[machine].memory;
    const peakCompute = ROOFLINE_BY_MACHINE[machine].compute;
    const xRoofline = Array.from(
      { length: 100 },
      (_, i) => xMin * Math.pow(xMax / xMin, i / 99),
    );

    const yMemory = xRoofline.map((x) => x * peakMemoryBandwidth);
    const yCompute = xRoofline.map(() => peakCompute);

    // Append memory bound line
    datasets.push({
      label: "Memory Bound",
      // type: "line",
      data: xRoofline.map((x, i) => ({ x, y: yMemory[i], id: "", name: "", backend: "" })),
      borderColor: "#d62728", // red
      showLine: true,
      backgroundColor: "#d62728",
      // borderWidth: 2,
      // fill: false,
      pointRadius: 0,
    });

    // Append compute bound line
    datasets.push({
      label: "Compute Bound",
      // type: "line",
      data: xRoofline.map((x, i) => ({ x, y: yCompute[i], id: "", name: "", backend: "" })),
      borderColor: "#2ca02c", // green
      showLine: true,
      backgroundColor: "#2ca02c",
      // borderWidth: 2,
      // fill: false,
      pointRadius: 0,
    });

    chartRef.current = new Chart(canvasRef.current, {
      type: "scatter",
      data: {
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: "logarithmic",
            title: {
              display: true,
              text: "Arithmetic Intensity (FLOP/byte)",
            },
          },
          y: {
            type: "logarithmic",
            title: {
              display: true,
              text: "Performance (TFLOP/s)",
            },
          },
        },
        plugins: {
          legend: { position: "top" },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const point = ctx.raw as any;
                const base = `${point.name}: (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`;
                if (profilingManifest && point.name && findDumpKeyForKernel(profilingManifest, point.name, point.backend)) {
                  return `${base}  ⚡ rocprof`;
                }
                return base;
              },
            },
          },
          zoom: {
            zoom: {
              wheel: {
                enabled: true,
              },
              pinch: {
                enabled: true,
              },
              mode: "xy",
            },
            pan: {
              enabled: true,
              mode: "xy",
            },
            limits: {
              x: { min: "original", max: "original" },
              y: { min: "original", max: "original" },
            },
          },
        },
        onClick: (event, elements) => {
          // Reset zoom first so clicks always register on correct coordinates
          if ((chartRef.current as any)?.resetZoom) {
            (chartRef.current as any).resetZoom();
          }
          if (elements.length > 0) {
            const datasetIndex = elements[0].datasetIndex;
            const index = elements[0].index;
            const point = (
              chartRef.current?.data.datasets[datasetIndex].data as any[]
            )[index];
            if (point?.id) setSelected(point.id);
          } else {
            setSelected(null);
          }
        },
      },
    });
  }, [kernels, selectedKernel, groupByField, profilingManifest]);

  return (
    <div className="relative w-full h-[600px]">
      <canvas ref={canvasRef} />
    </div>
  );
}
