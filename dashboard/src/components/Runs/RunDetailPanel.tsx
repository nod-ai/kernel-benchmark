import type { RunWithTrigger } from "../../types";
import { extractRowData } from "./runUtils";

interface RunDetailPanelProps {
  item: RunWithTrigger;
  colSpan: number;
}

export default function RunDetailPanel({ item, colSpan }: RunDetailPanelProps) {
  const { run, trigger, backendSpecs, trackerName, machine } = extractRowData(item);

  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-3 bg-gray-50 border-b border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Backend specs */}
          <div>
            {backendSpecs.length > 0 ? (
              <div>
                <div className="font-semibold text-gray-700 mb-1.5">Backend Specifications</div>
                <div className="space-y-1.5">
                  {backendSpecs.map((spec: any, idx: number) => (
                    <div key={spec.id || idx} className="pl-2.5 border-l-2 border-gray-300">
                      <div className="font-medium text-gray-700">{spec.name}</div>
                      <div className="text-gray-500">
                        {spec.remoteRepository} @ {spec.branch}
                        {spec.commitHash && (
                          <span className="ml-1 font-mono" title={spec.commitHash}>
                            ({spec.commitHash.substring(0, 7)})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <span className="text-gray-400 italic">No backend specifications</span>
            )}
          </div>

          {/* Metadata + progress */}
          <div className="space-y-2">
            {/* Tracker/machine for small screens */}
            <div className="md:hidden space-y-1">
              {trackerName && (
                <div className="text-gray-600">
                  <span className="font-medium text-gray-700">Tracker:</span> {trackerName}
                </div>
              )}
              {machine && (
                <div className="text-gray-600">
                  <span className="font-medium text-gray-700">Machine:</span> {machine}
                </div>
              )}
            </div>

            {/* Debug IDs */}
            <div className="space-y-0.5">
              <div className="font-semibold text-gray-700 mb-1">Debug Info</div>
              {run?._id && (
                <div className="font-mono text-gray-400">Run ID: {run._id}</div>
              )}
              {trigger?._id && (
                <div className="font-mono text-gray-400">Trigger ID: {trigger._id}</div>
              )}
            </div>

            {/* Progress bar for in-progress runs */}
            {run?.status === "in_progress" && run.steps && run.steps.length > 0 && (
              <div>
                <div className="font-semibold text-gray-700 mb-1">Progress</div>
                {(() => {
                  const currentStep = run.steps.find((s) => s.status === "in_progress");
                  return currentStep ? (
                    <div className="text-gray-600 mb-1">
                      Current step: <span className="font-medium">{currentStep.name}</span>
                    </div>
                  ) : null;
                })()}
                <div className="flex w-full overflow-hidden rounded-md bg-gray-200 h-2">
                  {Array.from({ length: run.numSteps }, (_, i) => {
                    const step = run.steps[i];
                    let colorClass = "bg-gray-300";
                    if (step) {
                      if (step.status === "completed") {
                        colorClass = step.conclusion === "success" ? "bg-green-500" : "bg-red-500";
                      } else if (step.status === "in_progress") {
                        colorClass = "bg-blue-500";
                      }
                    }
                    return (
                      <div
                        key={i}
                        className={`flex-1 ${colorClass} ${i < run.numSteps - 1 ? "border-r border-white" : ""}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
