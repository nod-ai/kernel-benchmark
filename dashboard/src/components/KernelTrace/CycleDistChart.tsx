import { useEffect, useRef } from "react";
import {
  Chart,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend,
} from "chart.js";
import type { WaveMetrics } from "../../utils/rocprof";

Chart.register(ArcElement, DoughnutController, Tooltip, Legend);

const PIE_COLORS = [
  "rgba(59,130,246,0.8)",
  "rgba(139,92,246,0.8)",
  "rgba(236,72,153,0.8)",
];

export default function CycleDistChart({ metrics }: { metrics: WaveMetrics }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: ["Pre-Loop", "Main Loop", "Post-Loop"],
        datasets: [
          {
            data: [metrics.preLoopPct, metrics.mainLoopPct, metrics.postLoopPct],
            backgroundColor: PIE_COLORS,
            borderWidth: 3,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "55%",
        plugins: {
          legend: { display: true, position: "bottom", labels: { padding: 16 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.parsed.toFixed(1)}%`,
            },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [metrics]);

  return (
    <div className="relative w-full h-[300px]">
      <canvas ref={canvasRef} />
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ marginBottom: 32 }}
      >
        <div className="text-center">
          <div className="text-xl font-bold text-gray-900">
            {metrics.loopEfficiency}%
          </div>
          <div className="text-xs text-gray-500">Loop Eff.</div>
        </div>
      </div>
    </div>
  );
}
