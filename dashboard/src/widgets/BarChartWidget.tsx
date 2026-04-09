import { useEffect, useRef } from "react";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import type { WidgetProps } from "../types/dashboard";
import { resolveField } from "../utils/pipeline";
import { getValueColor } from "../utils/color";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

/**
 * General-purpose bar chart widget driven by the data mapping:
 *   mapping.x     -> label axis
 *   mapping.y     -> value axis
 *   mapping.color -> optional colour grouping field
 */
export default function BarChartWidget({ config, data }: WidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const { x = "label", y = "value", color } = config.mapping;
  const horizontal = config.style?.horizontal ?? false;

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    const labels = data.map((row) => String(resolveField(row, x) ?? ""));
    const values = data.map((row) => Number(resolveField(row, y)) || 0);

    const backgroundColors = color
      ? data.map((row) => {
          try {
            return getValueColor(String(resolveField(row, color))).alpha(0.7).string();
          } catch {
            return "rgba(59,130,246,0.7)";
          }
        })
      : "rgba(59,130,246,0.7)";

    const borderColors = color
      ? data.map((row) => {
          try {
            return getValueColor(String(resolveField(row, color))).string();
          } catch {
            return "rgb(59,130,246)";
          }
        })
      : "rgb(59,130,246)";

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: config.title || y,
            data: values,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1,
          },
        ],
      },
      options: {
        indexAxis: horizontal ? "y" : "x",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: !!color },
        },
        scales: {
          ...(horizontal
            ? { x: { beginAtZero: true } }
            : { y: { beginAtZero: true } }),
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [data, x, y, color, horizontal, config.title]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No data for bar chart
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}
