import { useEffect, useRef } from "react";
import {
  Chart,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import type { WidgetProps } from "../types/dashboard";
import { resolveField } from "../utils/pipeline";

Chart.register(ArcElement, DoughnutController, Tooltip, Legend, Title);

const PALETTE = [
  "rgba(59,130,246,0.75)",
  "rgba(16,185,129,0.75)",
  "rgba(245,158,11,0.75)",
  "rgba(239,68,68,0.75)",
  "rgba(139,92,246,0.75)",
  "rgba(236,72,153,0.75)",
  "rgba(20,184,166,0.75)",
  "rgba(249,115,22,0.75)",
];

/**
 * Pie / doughnut chart.
 * mapping.segment -> label for each slice
 * mapping.value   -> numeric value for each slice
 */
export default function PieChartWidget({ config, data }: WidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const { segment = "label", value = "value" } = config.mapping;

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    const labels = data.map((row) => String(resolveField(row, segment) ?? ""));
    const values = data.map((row) => Number(resolveField(row, value)) || 0);

    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
            borderWidth: 2,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "right" },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = values.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0";
                return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
              },
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [data, segment, value]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No data for pie chart
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}
