import { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { WidgetProps } from "../types/dashboard";
import type { Kernel } from "../types";
import RooflinePlot from "../components/Plots/RooflinePlot";
import { findDumpKeyForKernel } from "../utils/rocprof";
import RocprofTooltip from "../components/RocprofTooltip";

export default function RooflineWidget({
  config,
  data,
  onKernelSelect,
  selectedKernelId,
  profilingManifest,
  blobName,
}: WidgetProps) {
  const kernels = data as unknown as Kernel[];
  const selectedKernel = kernels.find((k) => k.id === selectedKernelId);
  const navigate = useNavigate();

  const selectedDumpKey = useMemo(() => {
    if (!selectedKernel || !profilingManifest) return null;
    return findDumpKeyForKernel(profilingManifest, selectedKernel.name, selectedKernel.backend);
  }, [selectedKernel, profilingManifest]);

  const handleKernelClick = useCallback(
    (kernelId: string | null) => {
      if (!kernelId) {
        onKernelSelect?.(null);
        return;
      }

      if (selectedKernelId === kernelId && selectedDumpKey && blobName) {
        navigate(
          `/trace/${encodeURIComponent(blobName)}?dumpKey=${encodeURIComponent(selectedDumpKey)}&kernel=${encodeURIComponent(selectedKernel!.name)}`
        );
        return;
      }

      onKernelSelect?.(kernelId);
    },
    [selectedKernelId, selectedDumpKey, blobName, selectedKernel, navigate, onKernelSelect]
  );

  if (kernels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No data for roofline plot
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <RooflinePlot
        kernels={kernels}
        setSelected={handleKernelClick}
        selectedKernel={selectedKernel}
        groupByField={config.mapping.color || "backend"}
        profilingManifest={profilingManifest}
      />
      {selectedKernel && profilingManifest && (
        <RocprofTooltip
          kernelName={selectedKernel.name}
          dumpKey={selectedDumpKey}
          blobName={blobName}
        />
      )}
    </div>
  );
}
