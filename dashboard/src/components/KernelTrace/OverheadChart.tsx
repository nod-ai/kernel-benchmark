import { useEffect, useRef } from "react";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from "chart.js";
import type { WaveMetrics } from "../../utils/rocprof";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const PALETTE = [
  "rgb(59,130,246)",
  "rgb(139,92,246)",
  "rgb(236,72,153)",
  "rgb(245,158,11)",
  "rgb(16,185,129)",
  "rgb(6,182,212)",
  "rgb(249,115,22)",
  "rgb(99,102,241)",
  "rgb(20,184,166)",
];

export default function OverheadChart({ metrics }: { metrics: WaveMetrics }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    const overheads = [
      { name: "Buffer Load", value: metrics.bufferLoadPct },
      { name: "WAIT (vmcnt)", value: metrics.waitPct },
      { name: "MFMA", value: metrics.mfmaPct },
      { name: "BARRIER", value: metrics.barrierPct },
      { name: "DS Read", value: metrics.dsReadPct },
      { name: "SALU", value: metrics.saluPct },
      { name: "WAIT (lgkmcnt)", value: metrics.waitLgkmPct },
      { name: "VALU", value: metrics.valuPct },
      { name: "DS Write", value: metrics.dsWritePct },
    ].sort((a, b) => b.value - a.value);

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: overheads.map((o) => o.name),
        datasets: [
          {
            label: "Impact (%)",
            data: overheads.map((o) => o.value),
            backgroundColor: overheads.map((_, i) => PALETTE[i % PALETTE.length]),
            borderWidth: 0,
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: "Impact (%)", color: "#6b7280" },
            grid: { color: "rgba(0,0,0,0.05)" },
            beginAtZero: true,
          },
          y: { grid: { display: false } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.x.toFixed(1)}%`,
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
    </div>
  );
}
