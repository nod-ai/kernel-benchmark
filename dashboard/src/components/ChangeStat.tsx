import React from "react";
import type { ChangeStats } from "../types";

interface ChangeStatBarProps {
  kernelType: string;
  change: number;
}

const MAX_BAR_WIDTH = 100; // 100px left/right (200 total bar area)

const ChangeStatBar: React.FC<ChangeStatBarProps> = ({
  kernelType,
  change,
}) => {
  const isPositive = change > 0;
  const pct = Math.min(Math.abs(change), 100);
  const barWidth = (pct / 100) * MAX_BAR_WIDTH;

  return (
    <div className="flex items-center w-[320px] gap-2">
      {/* Kernel name */}
      <div className="w-[60px] text-sm text-gray-700 text-right pr-2">
        {kernelType}
      </div>

      {/* Bar visualization */}
      <div className="relative flex items-center w-[200px] h-4">
        {/* Center anchor */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-300" />

        {/* Red (left) */}
        {!isPositive && (
          <div
            className="bg-red-500 h-full absolute right-1/2"
            style={{ width: `${barWidth}px` }}
          />
        )}

        {/* Green (right) */}
        {isPositive && (
          <div
            className="bg-green-500 h-full absolute left-1/2"
            style={{ width: `${barWidth}px` }}
          />
        )}
      </div>

      {/* Label outside bar */}
      <div className="w-[60px] text-sm font-medium">
        <span
          className={
            isPositive ? "text-green-700 text-left" : "text-red-700 text-right"
          }
        >
          {change.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

interface ChangeStatusProps {
  changeStats?: ChangeStats;
}

function ChangeStatView({ changeStats }: ChangeStatusProps) {
  // Early return if no change stats provided
  if (!changeStats) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="text-sm text-gray-600 text-center">
          No change statistics available
        </div>
      </div>
    );
  }

  // Check if old or new data is missing or empty
  const hasOldData = changeStats.old && Object.keys(changeStats.old).length > 0;
  const hasNewData = changeStats.new && Object.keys(changeStats.new).length > 0;

  if (!hasOldData || !hasNewData) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="text-sm text-gray-600 text-center">
          Change statistics could not be computed - insufficient data
        </div>
      </div>
    );
  }

  // Get the first machine name
  const machineNames = Object.keys(changeStats.old!);
  if (machineNames.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="text-sm text-gray-600 text-center">
          No machine data available for comparison
        </div>
      </div>
    );
  }

  const firstMachine = machineNames[0];
  const oldMachineData = changeStats.old![firstMachine];
  const newMachineData = changeStats.new![firstMachine];

  // Check if wave backend exists in both old and new data
  if (!oldMachineData?.wave || !newMachineData?.wave) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="text-sm text-gray-600 text-center">
          Change statistics not available for wave backend
        </div>
      </div>
    );
  }

  const oldWaveData = oldMachineData.wave;
  const newWaveData = newMachineData.wave;

  // Calculate percentage changes for each kernel type
  const kernelChanges: Array<{ kernelType: string; change: number }> = [];

  Object.keys(oldWaveData).forEach((kernelType) => {
    const oldTflops = oldWaveData[kernelType]?.tflops;
    const newTflops = newWaveData[kernelType]?.tflops;

    if (oldTflops && newTflops && oldTflops > 0) {
      const percentChange = (newTflops / oldTflops - 1) * 100;
      kernelChanges.push({
        kernelType,
        change: percentChange,
      });
    }
  });

  if (kernelChanges.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="text-sm text-gray-600 text-center">
          No valid performance data found for comparison
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">
          Performance Changes
        </h3>
        <div className="text-xs text-gray-500">
          Machine: {firstMachine} • Backend: wave • Metric: TFLOPS
        </div>
      </div>

      <div className="space-y-3">
        {kernelChanges.map(({ kernelType, change }) => (
          <ChangeStatBar
            key={kernelType}
            kernelType={kernelType}
            change={change}
          />
        ))}
      </div>
    </div>
  );
}
export { ChangeStatBar, ChangeStatView };
