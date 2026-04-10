import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { fetchAllRuns, deleteRun, cancelWorkflow } from "../../utils/github";
import type { RunWithTrigger } from "../../types";
import type { RunTypeFilter, SortColumn, SortState } from "./types";
import { sortRuns, filterBySearch } from "./runUtils";

const PAGE_SIZE = 30;

export default function useRunsData() {
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
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortState>({ column: "date", direction: "desc" });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSort = useCallback((column: SortColumn) => {
    setSort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === "desc" ? "asc" : "desc",
    }));
  }, []);

  const filteredOngoing = useMemo(
    () => sortRuns(filterBySearch(ongoingRuns, debouncedSearch), sort),
    [ongoingRuns, debouncedSearch, sort]
  );

  const filteredCompleted = useMemo(
    () => sortRuns(filterBySearch(completedRuns, debouncedSearch), sort),
    [completedRuns, debouncedSearch, sort]
  );

  const loadOngoingRuns = useCallback(async () => {
    try {
      const response = await fetchAllRuns({
        page: 1,
        page_size: 1000,
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
        if (!append) setIsInitialLoading(true);
        else setIsLoadingMore(true);

        const response = await fetchAllRuns({
          page: pageNum,
          page_size: PAGE_SIZE,
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

  // Polling
  useEffect(() => {
    const pollUpdates = async () => {
      if (isInitialLoading || isLoadingMore) return;
      try {
        await loadOngoingRuns();
        const currentPageCount = Math.ceil(completedRuns.length / PAGE_SIZE);
        const allCompletedUpdates: RunWithTrigger[] = [];
        for (let i = 1; i <= currentPageCount; i++) {
          const response = await fetchAllRuns({
            page: i,
            page_size: PAGE_SIZE,
            type: typeFilter === "ALL" ? undefined : typeFilter,
            has_artifact: onlyWithArtifacts ? true : undefined,
            completed_only: true,
          });
          allCompletedUpdates.push(...response.runs);
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

    pollIntervalRef.current = setInterval(pollUpdates, 10000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [completedRuns.length, typeFilter, onlyWithArtifacts, isInitialLoading, isLoadingMore, loadOngoingRuns]);

  // Actions
  const handleDelete = useCallback(async (runId: string) => {
    await deleteRun(runId);
    setOngoingRuns((prev) => prev.filter((item) => (item.run?._id || item.trigger?._id) !== runId));
    setCompletedRuns((prev) => prev.filter((item) => (item.run?._id || item.trigger?._id) !== runId));
    const wasOngoing = ongoingRuns.some((item) => (item.run?._id || item.trigger?._id) === runId);
    if (wasOngoing) setOngoingCount((prev) => Math.max(0, prev - 1));
    else setCompletedCount((prev) => Math.max(0, prev - 1));
  }, [ongoingRuns]);

  const handleCancel = useCallback(async (runId: string) => {
    await cancelWorkflow(runId);
    await loadOngoingRuns();
  }, [loadOngoingRuns]);

  const handleTypeFilterChange = useCallback((newFilter: RunTypeFilter) => {
    setTypeFilter(newFilter);
    setCompletedPage(1);
  }, []);

  const handleArtifactsToggle = useCallback(() => {
    setOnlyWithArtifacts((prev) => !prev);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMoreCompleted) {
      const nextPage = completedPage + 1;
      setCompletedPage(nextPage);
      loadCompletedRuns(nextPage, true);
    }
  }, [isLoadingMore, hasMoreCompleted, completedPage, loadCompletedRuns]);

  return {
    // Data
    ongoingRuns,
    completedRuns,
    filteredOngoing,
    filteredCompleted,
    ongoingCount,
    completedCount,

    // Loading state
    isInitialLoading,
    isLoadingMore,
    hasMoreCompleted,

    // Filters
    typeFilter,
    onlyWithArtifacts,
    searchQuery,
    debouncedSearch,
    sort,

    // Actions
    handleDelete,
    handleCancel,
    handleLoadMore,
    handleTypeFilterChange,
    handleArtifactsToggle,
    handleSort,
    setSearchQuery,

    // For manual benchmark refresh
    loadOngoingRuns,
  };
}
