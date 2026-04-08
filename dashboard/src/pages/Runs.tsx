import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import { fetchAllRuns, deleteRun, triggerManualBenchWorkflow, cancelWorkflow } from "../utils/github";
import type { BenchmarkRun, RunWithTrigger } from "../types";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Filter,
  Trash2,
  FileText,
  PlayCircle,
  StopCircle,
  Calendar,
  Server,
} from "lucide-react";
import { toTitleCase, formatElapsedTime } from "../utils/utils";
import ManualBenchmarkModal, {
  type ManualBenchmarkConfig,
} from "../components/Modals/ManualBenchmarkModal";

type RunTypeFilter = "ALL" | "pr_update" | "manual_bench" | "manual_tuning" | "scheduled" | "rebase";

const RUN_TYPE_COLORS = {
  BENCHMARK: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-700",
  },
  TUNING: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    badge: "bg-purple-100 text-purple-700",
  },
  E2E: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    badge: "bg-green-100 text-green-700",
  },
  // Trigger type colors
  PR_UPDATE: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
    badge: "bg-indigo-100 text-indigo-700",
  },
  MANUAL_BENCH: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-700",
  },
  MANUAL_TUNING: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    badge: "bg-purple-100 text-purple-700",
  },
  SCHEDULED: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
  },
  REBASE: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
  },
};

function getStatusIcon(run: BenchmarkRun) {
  if (["queued", "requested", "pending", "waiting"].includes(run.status)) {
    return <Clock className="w-5 h-5 text-blue-600" />;
  }

  if (run.status === "in_progress") {
    return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
  }

  if (run.status === "completed") {
    if (run.conclusion === "success") {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    } else if (run.conclusion === "cancelled") {
      return <XCircle className="w-5 h-5 text-gray-600" />;
    } else {
      return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
  }

  return <Clock className="w-5 h-5 text-gray-600" />;
}

function getStatusText(run: BenchmarkRun): string {
  if (run.status === "completed") {
    return toTitleCase(run.conclusion);
  }
  return toTitleCase(run.status);
}

interface RunCardProps {
  item: RunWithTrigger;
  onDelete: (runId: string) => void;
  onCancel: (runId: string) => void;
  onNavigate: (blobName: string) => void;
}

function RunCard({ item, onDelete, onCancel, onNavigate }: RunCardProps) {
  const { run, trigger } = item;
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [elapsedTime, setElapsedTime] = useState<string>("");
  
  // Determine display values (trigger is source of truth for type)
  const displayName = trigger?.metadata?.name || run?.blobName || "Unknown Run";
  const runType = (trigger?.type || "manual_bench").toUpperCase();
  const colors = RUN_TYPE_COLORS[runType as keyof typeof RUN_TYPE_COLORS] || RUN_TYPE_COLORS.BENCHMARK;
  const isCompleted = run?.completed ?? false;
  const canNavigate = isCompleted && run?.hasArtifact;
  const itemId = run?._id || trigger?._id || "";
  const trackerName = trigger?.metadata?.trackerName as string | undefined;
  const machine = (trigger?.machine || trigger?.metadata?.machine) as string | undefined;

  // Update elapsed time for running runs
  useEffect(() => {
    if (run?.status === "in_progress" && run?.timestamp) {
      const updateElapsed = () => {
        setElapsedTime(formatElapsedTime(new Date(run.timestamp)));
        console.log(run?.timestamp);
      };
      
      // Update immediately
      updateElapsed();
      
      // Update every second
      const interval = setInterval(updateElapsed, 1000);
      
      return () => clearInterval(interval);
    }
  }, [run?.status, run?.timestamp]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      window.confirm(
        "Are you sure you want to delete this run? This will also delete its artifact if it exists."
      )
    ) {
      setIsDeleting(true);
      try {
        await onDelete(itemId);
      } catch (error) {
        console.error("Failed to delete run:", error);
        alert("Failed to delete run. Please try again.");
        setIsDeleting(false);
      }
    }
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      window.confirm(
        "Are you sure you want to cancel this run? This will stop the workflow execution."
      )
    ) {
      setIsCancelling(true);
      try {
        await onCancel(itemId);
      } catch (error) {
        console.error("Failed to cancel run:", error);
        alert("Failed to cancel run. Please try again.");
        setIsCancelling(false);
      }
    }
  };

  const handleClick = () => {
    if (canNavigate && run) {
      onNavigate(run.blobName);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`${colors.bg} border ${colors.border} rounded-lg p-4 transition-all duration-200 ${
        canNavigate
          ? "cursor-pointer hover:shadow-md hover:scale-[1.01]"
          : "cursor-default"
      } ${isDeleting ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header with badges */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}
            >
              {toTitleCase(runType.replace(/_/g, " "))}
            </span>
            {/* Show Running badge for in-progress runs */}
            {run?.status === "in_progress" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Running {elapsedTime && `(${elapsedTime})`}
              </span>
            )}
            {/* Show trigger status if not linked */}
            {trigger && trigger.status !== "linked" && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                {toTitleCase(trigger.status)}
              </span>
            )}
            {run?.hasArtifact && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                <FileText className="w-3 h-3" />
                Has Artifact
              </span>
            )}
          </div>

          {/* Display Name */}
          <h3 className={`text-sm font-semibold ${colors.text} mb-1 truncate`}>
            {displayName}
          </h3>

          {/* Tracker Name - shown when run is associated with a tracker */}
          {trackerName && (
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-600">
                Tracker: <span className="font-medium text-gray-700">{trackerName}</span>
              </span>
            </div>
          )}

          {/* Machine - shown when machine info is available */}
          {machine && (
            <div className="flex items-center gap-1.5 mb-2">
              <Server className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-600">
                Machine: <span className="font-medium text-gray-700">{machine}</span>
              </span>
            </div>
          )}
          
          {/* Backend Specs - shown when available */}
          {trigger?.metadata?.backendSpecs && Array.isArray(trigger.metadata.backendSpecs) && trigger.metadata.backendSpecs.length > 0 && (
            <div className="mb-2 space-y-1">
              <div className="text-xs font-medium text-gray-700 mb-1">Backend Specifications:</div>
              <div className="space-y-1">
                {trigger.metadata.backendSpecs.map((spec: any, idx: number) => (
                  <div key={spec.id || idx} className="text-xs text-gray-600 pl-2 border-l-2 border-gray-300">
                    <div className="font-medium text-gray-700">{spec.name}</div>
                    <div className="text-gray-500">
                      {spec.remoteRepository} @ {spec.branch}
                      {spec.commitHash && (
                        <span className="ml-1 font-mono" title={spec.commitHash}>
                          (latest: {spec.commitHash.substring(0, 7)})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* IDs (for debugging) */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-1">
            {run?._id && (
              <span className="text-[10px] font-mono text-gray-400" title={`Run ID: ${run._id}`}>
                Run: {run._id}
              </span>
            )}
            {trigger?._id && (
              <span className="text-[10px] font-mono text-gray-400" title={`Trigger ID: ${trigger._id}`}>
                Trigger: {trigger._id.substring(0, 8)}...
              </span>
            )}
          </div>

          {/* Timestamp */}
          <p className="text-xs text-gray-500 mb-3">
            {new Date(
              trigger?.timestamp || run?.timestamp || new Date()
            ).toLocaleString()}
          </p>

          {/* Status - only show for non-running states */}
          {run?.status !== "in_progress" && (
            <div className="flex items-center gap-2">
              {run && getStatusIcon(run)}
              <span className="text-sm font-medium text-gray-700">
                {run ? getStatusText(run) : toTitleCase(trigger?.status || "Queued")}
              </span>
            </div>
          )}

          {/* Progress for in-progress runs with current step */}
          {run?.status === "in_progress" && run.steps && run.steps.length > 0 && (
            <div className="mt-2">
              {/* Current step name */}
              {(() => {
                const currentStep = run.steps.find((s) => s.status === "in_progress");
                if (currentStep) {
                  return (
                    <div className="text-xs text-gray-600 mb-1">
                      Current: <span className="font-medium">{currentStep.name}</span>
                    </div>
                  );
                }
                return null;
              })()}
              
              {/* Progress bar */}
              <div className="flex w-full overflow-hidden rounded-md bg-gray-200 h-2">
                {Array.from({ length: run.numSteps }, (_, i) => {
                  const step = run.steps[i];
                  let colorClass = "bg-gray-300";

                  if (step) {
                    if (step.status === "completed") {
                      colorClass =
                        step.conclusion === "success"
                          ? "bg-green-500"
                          : "bg-red-500";
                    } else if (step.status === "in_progress") {
                      colorClass = "bg-blue-500";
                    }
                  }

                  return (
                    <div
                      key={i}
                      className={`flex-1 ${colorClass} ${
                        i < run.numSteps - 1 ? "border-r border-white" : ""
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Cancel button for ongoing runs */}
          {!isCompleted && run && (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="flex-shrink-0 p-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Cancel run"
            >
              {isCancelling ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <StopCircle className="w-5 h-5" />
              )}
            </button>
          )}
          
          {/* Delete button for completed runs */}
          {isCompleted && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-shrink-0 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete run"
            >
              {isDeleting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Runs() {
  const [ongoingRuns, setOngoingRuns] = useState<RunWithTrigger[]>([]);
  const [completedRuns, setCompletedRuns] = useState<RunWithTrigger[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [typeFilter, setTypeFilter] = useState<RunTypeFilter>("ALL");
  const [onlyWithArtifacts, setOnlyWithArtifacts] = useState(false);
  const [completedPage, setCompletedPage] = useState(1);
  const [hasMoreCompleted, setHasMoreCompleted] = useState(true);
  const [ongoingCount, setOngoingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [isManualBenchmarkModalOpen, setIsManualBenchmarkModalOpen] =
    useState(false);
  const pageSize = 30;
  const navigate = useNavigate();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadOngoingRuns = useCallback(async () => {
    try {
      // Fetch all ongoing runs (no pagination)
      const response = await fetchAllRuns({
        page: 1,
        page_size: 1000, // Large number to get all ongoing runs
        type: typeFilter === "ALL" ? undefined : typeFilter,
        has_artifact: onlyWithArtifacts ? true : undefined,
        completed_only: false,
      });

      setOngoingRuns(response.runs);
      setOngoingCount(response.ongoing_count);
      setCompletedCount(response.completed_count);
    } catch (error) {
      console.error("Failed to load ongoing runs:", error);
    }
  }, [typeFilter, onlyWithArtifacts]);

  const loadCompletedRuns = useCallback(
    async (pageNum: number, append: boolean = false) => {
      try {
        if (!append) {
          setIsInitialLoading(true);
        } else {
          setIsLoadingMore(true);
        }

        const response = await fetchAllRuns({
          page: pageNum,
          page_size: pageSize,
          type: typeFilter === "ALL" ? undefined : typeFilter,
          has_artifact: onlyWithArtifacts ? true : undefined,
          completed_only: true,
        });

        setOngoingCount(response.ongoing_count);
        setCompletedCount(response.completed_count);

        if (append) {
          setCompletedRuns((prev) => [...prev, ...response.runs]);
        } else {
          setCompletedRuns(response.runs);
        }

        setHasMoreCompleted(pageNum < response.total_pages);
      } catch (error) {
        console.error("Failed to load completed runs:", error);
      } finally {
        setIsInitialLoading(false);
        setIsLoadingMore(false);
      }
    },
    [typeFilter, onlyWithArtifacts]
  );

  // Initial load and filter changes
  useEffect(() => {
    const loadAll = async () => {
      setCompletedPage(1);
      await Promise.all([loadOngoingRuns(), loadCompletedRuns(1, false)]);
    };
    loadAll();
  }, [typeFilter, onlyWithArtifacts, loadOngoingRuns, loadCompletedRuns]);

  // Polling for updates
  useEffect(() => {
    const pollUpdates = async () => {
      if (isInitialLoading || isLoadingMore) return;

      try {
        // Reload ongoing runs (always all of them)
        await loadOngoingRuns();

        // Reload all currently loaded completed pages
        const currentPageCount = Math.ceil(completedRuns.length / pageSize);
        const allCompletedUpdates: RunWithTrigger[] = [];

        for (let i = 1; i <= currentPageCount; i++) {
          const response = await fetchAllRuns({
            page: i,
            page_size: pageSize,
            type: typeFilter === "ALL" ? undefined : typeFilter,
            has_artifact: onlyWithArtifacts ? true : undefined,
            completed_only: true,
          });
          allCompletedUpdates.push(...response.runs);

          // Update counts from the first response
          if (i === 1) {
            setOngoingCount(response.ongoing_count);
            setCompletedCount(response.completed_count);
          }
        }

        setCompletedRuns(allCompletedUpdates);
      } catch (error) {
        console.error("Failed to poll updates:", error);
      }
    };

    // Set up polling interval
    pollIntervalRef.current = setInterval(pollUpdates, 10000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [
    completedRuns.length,
    typeFilter,
    onlyWithArtifacts,
    isInitialLoading,
    isLoadingMore,
    loadOngoingRuns,
  ]);

  const handleDelete = async (runId: string) => {
    await deleteRun(runId);
    // Remove the deleted item from the appropriate list
    setOngoingRuns((prev) =>
      prev.filter((item) => (item.run?._id || item.trigger?._id) !== runId)
    );
    setCompletedRuns((prev) =>
      prev.filter((item) => (item.run?._id || item.trigger?._id) !== runId)
    );
    // Update counts
    const wasOngoing = ongoingRuns.some(
      (item) => (item.run?._id || item.trigger?._id) === runId
    );
    if (wasOngoing) {
      setOngoingCount((prev) => Math.max(0, prev - 1));
    } else {
      setCompletedCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleCancel = async (runId: string) => {
    await cancelWorkflow(runId);
    // Refresh ongoing runs after cancellation
    await loadOngoingRuns();
  };

  const handleNavigate = (blobName: string) => {
    navigate(`/dashboard/${blobName}`);
  };

  const handleTypeFilterChange = (newFilter: RunTypeFilter) => {
    setTypeFilter(newFilter);
    setCompletedPage(1);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMoreCompleted) {
      const nextPage = completedPage + 1;
      setCompletedPage(nextPage);
      loadCompletedRuns(nextPage, true);
    }
  };

  const handleManualBenchmark = async (config: ManualBenchmarkConfig) => {
    try {
      await triggerManualBenchWorkflow(config);
      // Refresh runs after triggering
      await loadOngoingRuns();
    } catch (error) {
      console.error("Failed to trigger manual benchmark:", error);
      alert("Failed to trigger manual benchmark. Please try again.");
      throw error;
    }
  };

  return (
    <PageContainer activePage="runs" isLoading={isInitialLoading}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Runs</h1>
              <p className="text-gray-600">
                Monitor and manage all benchmark, tuning, and E2E runs
              </p>
            </div>
            <button
              onClick={() => setIsManualBenchmarkModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-all duration-200"
            >
              <PlayCircle className="w-5 h-5" />
              Run Benchmark
            </button>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                Filter by type:
              </span>
              <div className="flex gap-2">
                {[
                  { value: "ALL" as RunTypeFilter, label: "ALL" },
                  { value: "manual_bench" as RunTypeFilter, label: "Manual Bench" },
                  { value: "pr_update" as RunTypeFilter, label: "PR Update" },
                  { value: "manual_tuning" as RunTypeFilter, label: "Tuning" },
                  { value: "scheduled" as RunTypeFilter, label: "Scheduled" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => handleTypeFilterChange(value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      typeFilter === value
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setOnlyWithArtifacts(!onlyWithArtifacts)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                onlyWithArtifacts
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              Only With Artifacts
            </button>
          </div>

          {/* Content */}
          {!isInitialLoading &&
            ongoingRuns.length === 0 &&
            completedRuns.length === 0 && (
            <div className="text-center py-16">
              <div className="bg-gray-50 rounded-lg p-12 max-w-md mx-auto">
                <div className="text-gray-400 mb-4">
                  <FileText className="w-12 h-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Runs Found
                </h3>
                <p className="text-gray-600">
                  {typeFilter === "ALL" && !onlyWithArtifacts
                    ? "No runs available yet."
                    : "No runs found matching the current filters. Try changing the filters."}
                </p>
              </div>
            </div>
          )}

          {!isInitialLoading &&
            (ongoingRuns.length > 0 || completedRuns.length > 0) && (
            <div className="space-y-8">
              {/* Ongoing Runs */}
              {ongoingRuns.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    Ongoing Runs ({ongoingCount})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ongoingRuns.map((item) => (
                      <RunCard
                        key={item.run?._id || item.trigger?._id || ""}
                        item={item}
                        onDelete={handleDelete}
                        onCancel={handleCancel}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Runs */}
              {completedRuns.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Completed Runs ({completedCount})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {completedRuns.map((item) => (
                      <RunCard
                        key={item.run?._id || item.trigger?._id || ""}
                        item={item}
                        onDelete={handleDelete}
                        onCancel={handleCancel}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Load More Button */}
              {hasMoreCompleted && completedRuns.length > 0 && (
                <div className="flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg shadow-sm transition-all duration-200 disabled:cursor-not-allowed"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>Load More Completed Runs</>
                    )}
                  </button>
                </div>
              )}
              {!hasMoreCompleted && completedRuns.length > 0 && (
                <div className="text-center text-sm text-gray-500">
                  All completed runs loaded ({completedRuns.length} total)
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Manual Benchmark Modal */}
      <ManualBenchmarkModal
        isOpen={isManualBenchmarkModalOpen}
        onClose={() => setIsManualBenchmarkModalOpen(false)}
        onConfirm={handleManualBenchmark}
      />
    </PageContainer>
  );
}
