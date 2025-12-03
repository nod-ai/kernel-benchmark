import type {
  BenchmarkJobStep,
  BenchmarkRun,
  ChangeStats,
  RepoPullRequest,
  BenchmarkRuntimeConfig,
} from "../types";
import { toTitleCase } from "../utils/utils";
import { BarLoader } from "react-spinners";
import { useEffect, useState } from "react";
import { cancelWorkflow, triggerBenchWorkflow } from "../utils/github";
import {
  Clock,
  Play,
  XCircle,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { ChangeStatView } from "./ChangeStat";
import BenchmarkConfirmationModal from "./Modals/BenchmarkConfirmationModal";

interface RunStatusContainerProps {
  children: React.ReactNode;
  fill?: boolean;
  run?: BenchmarkRun;
  actions?: Record<string, (runId: string) => void>;
}

function RunStatusContainer({
  children,
  fill,
  run,
  actions = {},
}: RunStatusContainerProps) {
  const [hovered, setHovered] = useState(false);
  const hasActions = Object.keys(actions).length > 0;

  if (fill) {
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative bg-white border border-gray-200 shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200 h-25 w-80 ml-auto"
      >
        <div className="w-full h-full flex flex-col gap-3 py-4 px-6 items-center justify-center">
          {children}
        </div>

        {hasActions && hovered && (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center gap-3 rounded-lg z-10"
          >
            {Object.entries(actions).map(([label, callback]) => (
              <button
                key={label}
                onClick={(e) => {
                  e.stopPropagation();
                  if (run) {
                    callback(run._id);
                  }
                }}
                className="bg-white hover:bg-gray-50 text-gray-900 px-4 py-2 rounded-md shadow-sm border border-gray-200 font-medium transition-colors duration-200 flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-25 w-80 flex flex-col justify-center items-center gap-3 ml-auto">
      {children}
    </div>
  );
}

interface JobProgressBarProps {
  numSteps: number;
  steps: BenchmarkJobStep[];
}

function getStepColor(step?: BenchmarkJobStep): string {
  if (!step) return "bg-gray-300"; // light gray for undefined steps

  const { status, conclusion } = step;

  if (status === "completed") {
    if (conclusion === "success") return "bg-green-500";
    else if (conclusion === "skipped") return "bg-green-300";
    else if (conclusion === "cancelled") return "bg-gray-500";
    else return "bg-red-500";
  } else if (status === "in_progress") {
    return "bg-blue-500";
  } else {
    return "bg-gray-400"; // dark gray
  }
}

export function JobProgressBar({ numSteps, steps }: JobProgressBarProps) {
  const blocks = Array.from({ length: numSteps }, (_, i) => {
    const step = steps[i];
    const colorClass = getStepColor(step);

    // Rounded corners for first and last blocks
    const roundedClass =
      i === 0 ? "rounded-l-lg" : i === numSteps - 1 ? "rounded-r-lg" : "";

    // Border between blocks except the last one
    const borderClass = i < numSteps - 1 ? "border-r border-white/20" : "";

    return (
      <div
        key={i}
        className={`flex-1 h-3 ${colorClass} ${roundedClass} ${borderClass} transition-colors duration-300`}
        title={step ? `${step.name}: ${step.status}` : "Pending"}
      />
    );
  });

  const formatStatus = (status: string) => {
    status = status.split("_").join(" ");
    status = toTitleCase(status);
    return status;
  };

  let title = "Waiting for Job";
  let statusIcon = <Clock className="w-4 h-4 text-gray-500" />;

  if (steps.length > 0) {
    let activeStep: BenchmarkJobStep = steps[0];
    for (activeStep of steps)
      if (!activeStep.started_at || !activeStep.completed_at) break;

    title = `${toTitleCase(activeStep.name)}: `;
    if (activeStep.status === "completed") {
      title += formatStatus(activeStep.conclusion);
      if (activeStep.conclusion === "success") {
        statusIcon = <CheckCircle className="w-4 h-4 text-green-600" />;
      } else if (activeStep.conclusion === "cancelled") {
        statusIcon = <XCircle className="w-4 h-4 text-gray-600" />;
      } else {
        statusIcon = <AlertCircle className="w-4 h-4 text-red-600" />;
      }
    } else {
      title += formatStatus(activeStep.status);
      statusIcon = <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
    }
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {statusIcon}
        <span>{title}</span>
      </div>
      <div className="flex w-full overflow-hidden rounded-lg shadow-inner bg-gray-200">
        {blocks}
      </div>
    </div>
  );
}

export default function RunStatus({ run }: { run: BenchmarkRun }) {
  if (["queued", "requested", "pending", "waiting"].includes(run.status))
    return (
      <RunStatusContainer run={run} fill actions={{ Cancel: cancelWorkflow }}>
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Clock className="w-4 h-4 text-blue-600" />
          Run {toTitleCase(run.status)}
        </div>
        <div className="w-16">
          <BarLoader color="#3B82F6" width="100%" height={4} />
        </div>
      </RunStatusContainer>
    );
  else {
    return (
      <RunStatusContainer run={run} fill actions={{ Cancel: cancelWorkflow }}>
        <JobProgressBar numSteps={run.numSteps} steps={run.steps} />
      </RunStatusContainer>
    );
  }
}

interface PullRequestRunStatusProps {
  run?: BenchmarkRun;
  changeStats?: ChangeStats;
  pr: RepoPullRequest;
}

export function PullRequestRunStatus({
  run,
  pr,
  changeStats,
}: PullRequestRunStatusProps) {
  const [workflowWaiting, setWorkflowWaiting] = useState<boolean>(false);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState<boolean>(false);

  const dispatchWorkflow = async (config: BenchmarkRuntimeConfig) => {
    try {
      setWorkflowWaiting(true);
      // TODO: Update triggerWorkflow to accept benchmark configuration
      console.log("Benchmark config:", config);
      await triggerBenchWorkflow(pr, config);
    } finally {
      setWorkflowWaiting(false);
    }
  };

  useEffect(() => {
    if (!run) return;

    if (run.completed) {
    }
  }, [run]);

  if (changeStats) return <ChangeStatView changeStats={changeStats} />;

  if (!run || (run.status === "completed" && run.conclusion !== "success")) {
    if (pr.status === "closed") return <div className="ml-auto" />;
    return (
      <>
        <RunStatusContainer run={run}>
          <button
            disabled={workflowWaiting}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg shadow-sm font-medium transition-all duration-200 flex items-center gap-2 disabled:cursor-not-allowed"
            onClick={(e) => {
              setShowBenchmarkModal(true);
              e.stopPropagation();
            }}
          >
            {workflowWaiting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Run Requested
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Trigger CI Run
              </>
            )}
          </button>
        </RunStatusContainer>

        <BenchmarkConfirmationModal
          isOpen={showBenchmarkModal}
          onClose={() => setShowBenchmarkModal(false)}
          onConfirm={dispatchWorkflow}
          pullRequest={pr}
        />
      </>
    );
  }

  return <RunStatus run={run} />;
}
