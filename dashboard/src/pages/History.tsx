import { useEffect, useState } from "react";
import {
  type RepoPullRequest,
  type BenchmarkRun,
  type ChangeStats,
} from "../types";
import PageContainer from "../components/PageContainer";
import {
  fetchChangeStats,
  fetchModifications,
  fetchPerformanceRuns,
  fetchRuns,
  rebase,
} from "../utils/github";
import ModificationView, {
  PerformanceView,
} from "../components/ModificationView";
import { RefreshCw } from "lucide-react";
// import { generateFakeRepoHistory } from "../utils/history";

export default function History() {
  const [modifications, setModifications] = useState<
    RepoPullRequest[] | undefined
  >(undefined);
  const [runs, setRuns] = useState<Record<string, BenchmarkRun>>({});
  const [performances, setPerformances] = useState<BenchmarkRun[]>([]);
  const [changeStats, setChangeStats] = useState<Record<string, ChangeStats>>(
    {}
  );
  const [rebaseWaiting, setRebaseWaiting] = useState<boolean>(false);

  useEffect(() => {
    const updateModifications = () => {
      if (rebaseWaiting) return;
      fetchModifications().then(setModifications);
    };

    const updateRuns = () => {
      if (rebaseWaiting) return;
      fetchRuns().then((runArr) => {
        const newRuns: Record<string, BenchmarkRun> = {};
        for (let run of runArr) {
          if (!run.mappingId) continue;
          const existingRun = newRuns[run.mappingId];
          if (!existingRun || run.timestamp > existingRun.timestamp) {
            if (
              existingRun &&
              run.status === "completed" &&
              run.conclusion !== "success"
            )
              continue;
            newRuns[run.mappingId] = run;
          }
        }
        console.log(newRuns);
        setRuns(newRuns);
      });
    };

    const updatePerfs = () => {
      if (rebaseWaiting) return;
      fetchPerformanceRuns().then(setPerformances);
    };

    const updateChangeStats = () => {
      fetchChangeStats().then(setChangeStats);
    };

    updateRuns();
    updateModifications();
    updatePerfs();
    updateChangeStats();

    const modInterval = setInterval(updateModifications, 30 * 1000);
    const runInterval = setInterval(updateRuns, 10 * 1000);
    const perfInterval = setInterval(updatePerfs, 60 * 1000);
    const changeStatsInterval = setInterval(updateChangeStats, 20 * 1000);

    return () => {
      clearInterval(modInterval);
      clearInterval(runInterval);
      clearInterval(perfInterval);
      clearInterval(changeStatsInterval);
    };
  }, []);

  const triggerRebase = async () => {
    try {
      setRebaseWaiting(true);
      const rebaseRes = await rebase();
      console.log("rebase", rebaseRes);
      setModifications(rebaseRes.modifications);
      setPerformances(rebaseRes.performances);
    } finally {
      setRebaseWaiting(false);
    }
  };

  return (
    <PageContainer activePage="history" isLoading={modifications === undefined}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Header Section */}
          <div className="flex flex-col items-center gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Repository History
              </h1>
              <p className="text-gray-600">
                Track pull requests, performance runs, and repository changes
              </p>
            </div>

            <button
              disabled={rebaseWaiting}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-sm transition-all duration-200"
              onClick={triggerRebase}
            >
              <RefreshCw
                className={`w-4 h-4 ${rebaseWaiting ? "animate-spin" : ""}`}
              />
              {rebaseWaiting ? "Rebasing..." : "Rebase Repository"}
            </button>
          </div>

          {/* Timeline Section */}
          <div className="space-y-6">
            {modifications &&
              performances &&
              [
                ...modifications.filter((mod) => mod.type === "pr"),
                ...performances,
              ]
                .sort(
                  (a, b) =>
                    new Date(b.timestamp).getTime() -
                    new Date(a.timestamp).getTime()
                )
                .map((item, index) => {
                  if ("type" in item && item.type === "pr") {
                    return (
                      <div key={`pr-${index}`} className="relative">
                        <ModificationView
                          pr={item as RepoPullRequest}
                          runs={runs}
                          changeStats={changeStats}
                        />
                      </div>
                    );
                  } else {
                    return (
                      <div key={`perf-${index}`} className="relative">
                        <PerformanceView perf={item as BenchmarkRun} />
                      </div>
                    );
                  }
                })}
          </div>

          {/* Empty State */}
          {modifications &&
            performances &&
            [
              ...modifications.filter((mod) => mod.type === "pr"),
              ...performances,
            ].length === 0 && (
              <div className="text-center py-16">
                <div className="bg-gray-50 rounded-lg p-12 max-w-md mx-auto">
                  <div className="text-gray-400 mb-4">
                    <RefreshCw className="w-12 h-12 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No History Available
                  </h3>
                  <p className="text-gray-600">
                    No pull requests or performance runs found. Try rebasing to
                    refresh the data.
                  </p>
                </div>
              </div>
            )}
        </div>
      </div>
    </PageContainer>
  );
}
