import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, FileText, PlayCircle } from "lucide-react";
import PageContainer from "../components/PageContainer";
import { triggerManualBenchWorkflow } from "../utils/github";
import ManualBenchmarkModal, {
  type ManualBenchmarkConfig,
} from "../components/Modals/ManualBenchmarkModal";
import { RunTable, RunSearchBar, RunFilters, useRunsData } from "../components/Runs";

export default function Runs() {
  const navigate = useNavigate();
  const [isManualBenchmarkModalOpen, setIsManualBenchmarkModalOpen] = useState(false);

  const {
    ongoingRuns,
    completedRuns,
    filteredOngoing,
    filteredCompleted,
    ongoingCount,
    completedCount,
    isInitialLoading,
    isLoadingMore,
    hasMoreCompleted,
    typeFilter,
    onlyWithArtifacts,
    searchQuery,
    debouncedSearch,
    sort,
    handleDelete,
    handleCancel,
    handleLoadMore,
    handleTypeFilterChange,
    handleArtifactsToggle,
    handleSort,
    setSearchQuery,
    loadOngoingRuns,
  } = useRunsData();

  const handleNavigate = (blobName: string) => {
    navigate(`/dashboard/${blobName}`);
  };

  const handleManualBenchmark = async (config: ManualBenchmarkConfig) => {
    try {
      await triggerManualBenchWorkflow(config);
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
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Runs</h1>
              <p className="text-gray-600 text-sm">
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

          {/* Search + Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
            <RunSearchBar value={searchQuery} onChange={setSearchQuery} />
            <RunFilters
              typeFilter={typeFilter}
              onTypeFilterChange={handleTypeFilterChange}
              onlyWithArtifacts={onlyWithArtifacts}
              onArtifactsToggle={handleArtifactsToggle}
            />
          </div>

          {/* Empty state */}
          {!isInitialLoading && ongoingRuns.length === 0 && completedRuns.length === 0 && (
            <div className="text-center py-16">
              <div className="bg-gray-50 rounded-lg p-12 max-w-md mx-auto">
                <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Runs Found</h3>
                <p className="text-gray-600">
                  {typeFilter === "ALL" && !onlyWithArtifacts
                    ? "No runs available yet."
                    : "No runs found matching the current filters. Try changing the filters."}
                </p>
              </div>
            </div>
          )}

          {/* Tables */}
          {!isInitialLoading && (ongoingRuns.length > 0 || completedRuns.length > 0) && (
            <div className="space-y-8">
              {filteredOngoing.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    Ongoing Runs ({ongoingCount})
                  </h2>
                  <RunTable
                    items={filteredOngoing}
                    sort={sort}
                    onSort={handleSort}
                    onDelete={handleDelete}
                    onCancel={handleCancel}
                    onNavigate={handleNavigate}
                  />
                </div>
              )}

              {filteredCompleted.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Completed Runs ({completedCount})
                  </h2>
                  <RunTable
                    items={filteredCompleted}
                    sort={sort}
                    onSort={handleSort}
                    onDelete={handleDelete}
                    onCancel={handleCancel}
                    onNavigate={handleNavigate}
                  />
                </div>
              )}

              {debouncedSearch && filteredOngoing.length === 0 && filteredCompleted.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No runs match "<span className="font-medium">{debouncedSearch}</span>". Try a different search term.
                </div>
              )}

              {hasMoreCompleted && completedRuns.length > 0 && (
                <div className="flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg shadow-sm transition-all duration-200 disabled:cursor-not-allowed"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load More Completed Runs"
                    )}
                  </button>
                </div>
              )}
              {!hasMoreCompleted && completedRuns.length > 0 && (
                <div className="text-center text-xs text-gray-400">
                  All completed runs loaded ({completedRuns.length} total)
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ManualBenchmarkModal
        isOpen={isManualBenchmarkModalOpen}
        onClose={() => setIsManualBenchmarkModalOpen(false)}
        onConfirm={handleManualBenchmark}
      />
    </PageContainer>
  );
}
