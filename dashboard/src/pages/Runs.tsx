import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import { fetchAllRuns, deleteRun } from "../utils/github";
import type { BenchmarkRun } from "../types";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Filter,
  Trash2,
  FileText,
} from "lucide-react";
import { toTitleCase } from "../utils/utils";

type RunTypeFilter = "ALL" | "BENCHMARK" | "TUNING" | "E2E";

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
  run: BenchmarkRun;
  onDelete: (runId: string) => void;
  onNavigate: (blobName: string) => void;
}

function RunCard({ run, onDelete, onNavigate }: RunCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const runType = run.type as keyof typeof RUN_TYPE_COLORS;
  const colors = RUN_TYPE_COLORS[runType] || RUN_TYPE_COLORS.BENCHMARK;
  const isCompleted = run.completed;
  const canNavigate = isCompleted && run.hasArtifact;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      window.confirm(
        "Are you sure you want to delete this run? This will also delete its artifact if it exists."
      )
    ) {
      setIsDeleting(true);
      try {
        await onDelete(run._id);
      } catch (error) {
        console.error("Failed to delete run:", error);
        alert("Failed to delete run. Please try again.");
        setIsDeleting(false);
      }
    }
  };

  const handleClick = () => {
    if (canNavigate) {
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
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}
            >
              {runType}
            </span>
            {run.hasArtifact && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                <FileText className="w-3 h-3" />
                Has Artifact
              </span>
            )}
          </div>

          {/* Blob Name */}
          <h3 className={`text-sm font-semibold ${colors.text} mb-1 truncate`}>
            {run.blobName}
          </h3>

          {/* Timestamp */}
          <p className="text-xs text-gray-500 mb-3">
            {new Date(run.timestamp).toLocaleString()}
          </p>

          {/* Status */}
          <div className="flex items-center gap-2">
            {getStatusIcon(run)}
            <span className="text-sm font-medium text-gray-700">
              {getStatusText(run)}
            </span>
          </div>

          {/* Progress for in-progress runs */}
          {run.status === "in_progress" && run.steps && run.steps.length > 0 && (
            <div className="mt-2">
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
  );
}

export default function Runs() {
  const [ongoingRuns, setOngoingRuns] = useState<BenchmarkRun[]>([]);
  const [completedRuns, setCompletedRuns] = useState<BenchmarkRun[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [typeFilter, setTypeFilter] = useState<RunTypeFilter>("ALL");
  const [onlyWithArtifacts, setOnlyWithArtifacts] = useState(false);
  const [completedPage, setCompletedPage] = useState(1);
  const [hasMoreCompleted, setHasMoreCompleted] = useState(true);
  const [ongoingCount, setOngoingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
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
        const allCompletedUpdates: BenchmarkRun[] = [];

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
    // Remove the deleted run from the appropriate list
    setOngoingRuns((prev) => prev.filter((run) => run._id !== runId));
    setCompletedRuns((prev) => prev.filter((run) => run._id !== runId));
    // Update counts
    const wasOngoing = ongoingRuns.some((run) => run._id === runId);
    if (wasOngoing) {
      setOngoingCount((prev) => Math.max(0, prev - 1));
    } else {
      setCompletedCount((prev) => Math.max(0, prev - 1));
    }
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

  return (
    <PageContainer activePage="runs" isLoading={isInitialLoading}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Header Section */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Runs
            </h1>
            <p className="text-gray-600">
              Monitor and manage all benchmark, tuning, and E2E runs
            </p>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                Filter by type:
              </span>
              <div className="flex gap-2">
                {(["ALL", "BENCHMARK", "TUNING", "E2E"] as RunTypeFilter[]).map(
                  (type) => (
                    <button
                      key={type}
                      onClick={() => handleTypeFilterChange(type)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        typeFilter === type
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {type}
                    </button>
                  )
                )}
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
                    {ongoingRuns.map((run) => (
                      <RunCard
                        key={run._id}
                        run={run}
                        onDelete={handleDelete}
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
                    {completedRuns.map((run) => (
                      <RunCard
                        key={run._id}
                        run={run}
                        onDelete={handleDelete}
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
    </PageContainer>
  );
}
