import type { ReactNode } from "react";

interface MetricCardProps {
  value: string;
  label: string;
  icon: ReactNode;
}

export default function MetricCard({ value, label, icon }: MetricCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center text-center shadow-sm">
      <div className="flex items-center gap-2 mb-1 text-gray-400">{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">
        {label}
      </div>
    </div>
  );
}
