import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import { findDumpKeyForKernel } from "../utils/rocprof";
import RocprofTooltip from "../components/RocprofTooltip";

Chart.register(ScatterController, LinearScale, PointElement, Tooltip, Legend, Title);

const FALLBACK_COLORS = [
  "rgb(59,130,246)",
  "rgb(16,185,129)",
  "rgb(245,158,11)",
  "rgb(239,68,68)",
  "rgb(139,92,246)",
];

export default function ScatterPlotWidget({
  config,
  data,
  profilingManifest,
  blobName,
}: WidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);
  const navigate = useNavigate();

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

  const selectedDumpKey = useMemo(() => {
    if (!selectedRow || !profilingManifest) return null;
    const name = selectedRow.name || (label ? resolveField(selectedRow, label) : null);
    return name ? findDumpKeyForKernel(profilingManifest, String(name), selectedRow.backend) : null;
  }, [selectedRow, profilingManifest, label]);

  const handlePointClick = useCallback(
    (rowIndex: number) => {
      const row = data[rowIndex];
      if (!row) return;

      if (selectedRow === row && selectedDumpKey && blobName) {
        const name = row.name || (label ? resolveField(row, label) : "");
        navigate(
          `/trace/${encodeURIComponent(blobName)}?dumpKey=${encodeURIComponent(selectedDumpKey)}&kernel=${encodeURIComponent(String(name))}`
        );
        return;
      }

      setSelectedRow(row);
    },
    [selectedRow, selectedDumpKey, blobName, data, label, navigate]
  );

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
                const base = lbl ? `${lbl}: (${xv}, ${yv})` : `(${xv}, ${yv})`;
                if (profilingManifest && row) {
                  const name = row.name || (label ? String(resolveField(row, label)) : "");
                  if (name && findDumpKeyForKernel(profilingManifest, name, row.backend)) {
                    return `${base}  ⚡ rocprof`;
                  }
                }
                return base;
              },
            },
          },
        },
        onClick: (_, elements) => {
          if (elements.length > 0 && profilingManifest) {
            handlePointClick(elements[0].index);
          } else {
            setSelectedRow(null);
          }
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [datasets, x, y, label, data, profilingManifest, handlePointClick]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No data for scatter plot
      </div>
    );
  }

  const selectedName = selectedRow
    ? String(selectedRow.name || (label ? resolveField(selectedRow, label) : ""))
    : "";

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} />
      {selectedRow && profilingManifest && selectedName && (
        <RocprofTooltip
          kernelName={selectedName}
          dumpKey={selectedDumpKey}
          blobName={blobName}
        />
      )}
    </div>
  );
}
