import { useEffect, useRef } from "react";
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
  Filler,
} from "chart.js";
import type { Kernel } from "../../types";
import { getBackendColor } from "../../utils/color";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
  Filler
);

interface BellComparisonPlotProps {
  kernels: Kernel[];
  metric: string;
}

export function BellComparisonPlot({
  kernels,
  metric,
}: BellComparisonPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  // Kernel Density Estimation using Gaussian kernel
  const calculateKDE = (
    data: number[],
    min: number,
    max: number,
    bandwidth?: number,
    points: number = 200
  ) => {
    // Scott's rule for bandwidth if not provided
    if (!bandwidth) {
      const stdDev = Math.sqrt(
        data.reduce((sum, val) => {
          const mean = data.reduce((a, b) => a + b, 0) / data.length;
          return sum + Math.pow(val - mean, 2);
        }, 0) / data.length
      );
      bandwidth = 1.06 * stdDev * Math.pow(data.length, -1 / 5);
    }

    const step = (max - min) / points;
    const xValues: number[] = [];
    const yValues: number[] = [];

    for (let i = 0; i <= points; i++) {
      const x = min + i * step;
      let density = 0;

      // Sum contributions from each data point
      for (const xi of data) {
        const u = (x - xi) / bandwidth;
        // Gaussian kernel
        const kernelValue =
          (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * u * u);
        density += kernelValue;
      }

      density = density / (data.length * bandwidth);
      xValues.push(x);
      yValues.push(density);
    }

    return { xValues, yValues };
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    // Group kernels by backend
    const backendGroups: Record<string, number[]> = {};
    for (const kernel of kernels) {
      if (!backendGroups[kernel.backend]) backendGroups[kernel.backend] = [];
      backendGroups[kernel.backend].push(
        metric === "tflops" ? kernel.tflops : kernel.meanMicroseconds
      );
    }

    // Calculate statistics for each backend
    const backendStats = Object.entries(backendGroups).map(
      ([backend, values]) => {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const sorted = [...values].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const stdDev = Math.sqrt(
          values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
            values.length
        );

        return { backend, mean, median, stdDev, values, q1, q3, iqr };
      }
    );

    // Calculate robust bounds using IQR method across all data
    const allValues = kernels.map((k) =>
      metric === "tflops" ? k.tflops : k.meanMicroseconds
    );
    const overallMean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    const overallVariance =
      allValues.reduce((sum, val) => sum + Math.pow(val - overallMean, 2), 0) /
      allValues.length;
    const overallStdDev = Math.sqrt(overallVariance);

    const xMin = Math.max(0, overallMean - overallStdDev * 3);
    const xMax = overallMean + overallStdDev * 3;

    // Create datasets for each backend using KDE
    const datasets = backendStats.map(({ backend, values }) => {
      const { xValues, yValues } = calculateKDE(values, xMin, xMax);
      const color = getBackendColor(backend);

      return {
        label: backend,
        data: xValues.map((x, i) => ({ x, y: yValues[i] })),
        borderColor: color.string(),
        backgroundColor: color.alpha(0.2).string(),
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      };
    });

    // Find max y value for scaling
    const maxY = Math.max(
      ...datasets.flatMap((d) => d.data.map((point) => point.y))
    );

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        datasets,
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: "linear",
            title: {
              display: true,
              text: metric === "tflops" ? "TFLOPs" : "Mean Time (μs)",
            },
            min: xMin,
            max: xMax,
          },
          y: {
            title: {
              display: true,
              text: "Density",
            },
            beginAtZero: true,
            max: maxY * 1.1, // Add 10% padding at the top
          },
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const backend = context.dataset.label || "";
                const stats = backendStats.find((s) => s.backend === backend);
                if (stats) {
                  return [
                    `${backend}`,
                    `Mean: ${stats.mean.toFixed(2)} μs`,
                    `Median: ${stats.median.toFixed(2)} μs`,
                    `Std Dev: ${stats.stdDev.toFixed(2)} μs`,
                    `IQR: ${stats.iqr.toFixed(2)} μs`,
                    `Samples: ${stats.values.length}`,
                  ];
                }
                return backend;
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
              mode: "x",
            },
            pan: {
              enabled: true,
              mode: "x",
            },
            limits: {
              x: { min: "original", max: "original" },
            },
          },
        },

        interaction: {
          mode: "nearest",
          intersect: false,
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [kernels, metric]);

  return <canvas ref={canvasRef} className="w-full h-[500px]" />;
}
