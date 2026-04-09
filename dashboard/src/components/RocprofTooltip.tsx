import { useNavigate } from "react-router-dom";
import { Activity } from "lucide-react";

interface RocprofTooltipProps {
  kernelName: string;
  dumpKey: string | null;
  blobName?: string | null;
}

export default function RocprofTooltip({
  kernelName,
  dumpKey,
  blobName,
}: RocprofTooltipProps) {
  const navigate = useNavigate();

  if (!dumpKey) {
    return (
      <div className="absolute bottom-2 left-2 bg-gray-800/90 text-gray-300 text-xs px-3 py-1.5 rounded-lg shadow-lg pointer-events-none">
        No rocprof trace available
      </div>
    );
  }

  const handleClick = () => {
    if (blobName) {
      navigate(
        `/trace/${encodeURIComponent(blobName)}?dumpKey=${encodeURIComponent(dumpKey)}&kernel=${encodeURIComponent(kernelName)}`
      );
    }
  };

  return (
    <button
      onClick={handleClick}
      className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg transition-colors cursor-pointer"
    >
      <Activity className="w-3.5 h-3.5" />
      View Kernel Trace
    </button>
  );
}
