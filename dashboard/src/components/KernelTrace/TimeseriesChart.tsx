import { useEffect, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import type { TimeseriesPoint } from "../../utils/rocprof";

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend, Filler);

interface TimeseriesChartProps {
  data: TimeseriesPoint[];
  title: string;
  yLabel: string;
}

export default function TimeseriesChart({ data, title, yLabel }: TimeseriesChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;
    chartRef.current?.destroy();

    const x = data.map((d) => d.time);
    const y = data.map((d) => d.value);
    const mean = y.reduce((a, b) => a + b, 0) / y.length;

    chartRef.current = new Chart(canvasRef.current, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: title,
            data: data.map((d) => ({ x: d.time, y: d.value })),
            showLine: true,
            borderColor: "rgb(59,130,246)",
            backgroundColor: "rgba(59,130,246,0.1)",
            borderWidth: 1.5,
            pointRadius: 2.5,
            pointBackgroundColor: "rgb(59,130,246)",
            fill: true,
            tension: 0,
          },
          {
            label: `Mean: ${mean.toFixed(1)}`,
            data: [
              { x: Math.min(...x), y: mean },
              { x: Math.max(...x), y: mean },
            ],
            showLine: true,
            borderColor: "rgb(239,68,68)",
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: false },
        scales: {
          x: {
            title: { display: true, text: "Time (cycles)", color: "#6b7280" },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
          y: {
            title: { display: true, text: yLabel, color: "#6b7280" },
            grid: { color: "rgba(0,0,0,0.05)" },
            beginAtZero: true,
          },
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: { usePointStyle: true, boxWidth: 8 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}`,
            },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [data, title, yLabel]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-gray-400 text-sm">
        No data available for {title}
      </div>
    );
  }

  return (
    <div className="relative w-full h-[350px]">
      <canvas ref={canvasRef} />
    </div>
  );
}
