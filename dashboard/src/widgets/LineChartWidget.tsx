import { useEffect, useRef, useMemo } from "react";
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
import type { WidgetProps } from "../types/dashboard";
import { resolveField } from "../utils/pipeline";
import { getBackendColor } from "../utils/color";

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

const FALLBACK_COLORS = [
  "rgb(59,130,246)",
  "rgb(16,185,129)",
  "rgb(245,158,11)",
  "rgb(239,68,68)",
  "rgb(139,92,246)",
  "rgb(236,72,153)",
];

/**
 * Line chart widget.
 *
 * mapping.x     -> field for x-axis labels
 * mapping.y     -> field for y-axis values
 * mapping.color -> optional field to split data into multiple series
 */
export default function LineChartWidget({ config, data }: WidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const { x = "label", y = "value", color } = config.mapping;

  const { labels, datasets } = useMemo(() => {
    if (!color) {
      return {
        labels: data.map((row) => String(resolveField(row, x) ?? "")),
        datasets: [
          {
            label: config.title || y,
            data: data.map((row) => Number(resolveField(row, y)) || 0),
            borderColor: FALLBACK_COLORS[0],
            backgroundColor: "rgba(59,130,246,0.1)",
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.2,
          },
        ],
      };
    }

    const uniqueLabels = [...new Set(data.map((row) => String(resolveField(row, x) ?? "")))];
    const seriesMap = new Map<string, Map<string, number>>();

    for (const row of data) {
      const seriesKey = String(resolveField(row, color) ?? "");
      const labelKey = String(resolveField(row, x) ?? "");
      if (!seriesMap.has(seriesKey)) seriesMap.set(seriesKey, new Map());
      seriesMap.get(seriesKey)!.set(labelKey, Number(resolveField(row, y)) || 0);
    }

    const ds = [...seriesMap.entries()].map(([seriesName, pointMap], i) => {
      let lineColor: string;
      try {
        lineColor = getBackendColor(seriesName).string();
      } catch {
        lineColor = FALLBACK_COLORS[i % FALLBACK_COLORS.length];
      }
      return {
        label: seriesName,
        data: uniqueLabels.map((l) => pointMap.get(l) ?? 0),
        borderColor: lineColor,
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.2,
      };
    });

    return { labels: uniqueLabels, datasets: ds };
  }, [data, x, y, color, config.title]);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { beginAtZero: true },
          x: { ticks: { maxRotation: 45, minRotation: 0 } },
        },
        plugins: {
          legend: { display: datasets.length > 1 },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [labels, datasets]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No data for line chart
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}
