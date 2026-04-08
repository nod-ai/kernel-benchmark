import { useEffect, useRef, useMemo } from "react";
import {
  Chart,
  ScatterController,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import type { WidgetProps } from "../types/dashboard";
import { resolveField } from "../utils/pipeline";
import { getValueColor } from "../utils/color";

Chart.register(ScatterController, LinearScale, PointElement, Tooltip, Legend, Title);

const FALLBACK_COLORS = [
  "rgb(59,130,246)",
  "rgb(16,185,129)",
  "rgb(245,158,11)",
  "rgb(239,68,68)",
  "rgb(139,92,246)",
];

/**
 * General-purpose scatter plot.
 *
 * mapping.x     -> x-axis numeric field
 * mapping.y     -> y-axis numeric field
 * mapping.color -> optional field for grouping into coloured series
 * mapping.size  -> optional field for point radius
 * mapping.label -> optional field for tooltip label
 */
export default function ScatterPlotWidget({ config, data }: WidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const { x = "x", y = "y", color, size, label } = config.mapping;

  const datasets = useMemo(() => {
    if (!color) {
      return [
        {
          label: config.title || "Data",
          data: data.map((row) => ({
            x: Number(resolveField(row, x)) || 0,
            y: Number(resolveField(row, y)) || 0,
          })),
          backgroundColor: "rgba(59,130,246,0.6)",
          pointRadius: size
            ? data.map((row) => Math.max(2, Math.min(20, Number(resolveField(row, size)) || 4)))
            : 4,
        },
      ];
    }

    const seriesMap = new Map<string, { x: number; y: number; r?: number }[]>();
    for (const row of data) {
      const key = String(resolveField(row, color) ?? "");
      if (!seriesMap.has(key)) seriesMap.set(key, []);
      const pt: { x: number; y: number; r?: number } = {
        x: Number(resolveField(row, x)) || 0,
        y: Number(resolveField(row, y)) || 0,
      };
      if (size) pt.r = Math.max(2, Math.min(20, Number(resolveField(row, size)) || 4));
      seriesMap.get(key)!.push(pt);
    }

    return [...seriesMap.entries()].map(([name, points], i) => {
      let c: string;
      try {
        c = getValueColor(name).alpha(0.6).string();
      } catch {
        c = FALLBACK_COLORS[i % FALLBACK_COLORS.length];
      }
      return {
        label: name,
        data: points,
        backgroundColor: c,
        pointRadius: size ? points.map((p) => p.r ?? 4) : 4,
      };
    });
  }, [data, x, y, color, size, config.title]);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: "scatter",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: x } },
          y: { title: { display: true, text: y } },
        },
        plugins: {
          legend: { display: datasets.length > 1 },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const idx = ctx.dataIndex;
                const row = data[idx];
                const lbl = label && row ? String(resolveField(row, label)) : "";
                const xv = ctx.parsed.x.toFixed(2);
                const yv = ctx.parsed.y.toFixed(2);
                return lbl ? `${lbl}: (${xv}, ${yv})` : `(${xv}, ${yv})`;
              },
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [datasets, x, y, label, data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No data for scatter plot
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}
