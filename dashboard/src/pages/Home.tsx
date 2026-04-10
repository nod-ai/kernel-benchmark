import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import { useDashboardList } from "../hooks/useDashboardConfig";
import {
  fetchTrackers,
  type TrackerData,
  toggleDashboardPin,
  toggleTrackerPin,
} from "../utils/github";
import {
  LayoutDashboard,
  TrendingUp,
  Pin,
  PinOff,
  Clock,
  Monitor,
  Tag,
} from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const { dashboards, isLoading: dashLoading, refresh: refreshDashboards } = useDashboardList();
  const [trackers, setTrackers] = useState<TrackerData[]>([]);
  const [trackersLoading, setTrackersLoading] = useState(true);

  useEffect(() => {
    fetchTrackers()
      .then(setTrackers)
      .catch(() => setTrackers([]))
      .finally(() => setTrackersLoading(false));
  }, []);

  const isLoading = dashLoading || trackersLoading;

  const pinnedDashboards = dashboards.filter((d) => d.pinned);
  const pinnedTrackers = trackers.filter((t) => t.pinned);
  const hasPinned = pinnedDashboards.length > 0 || pinnedTrackers.length > 0;

  const handleUnpinDashboard = async (e: React.MouseEvent, dashboardId: string) => {
    e.stopPropagation();
    try {
      await toggleDashboardPin(dashboardId);
      refreshDashboards();
    } catch (err) {
      console.error("Failed to unpin dashboard:", err);
    }
  };

  const handleUnpinTracker = async (e: React.MouseEvent, trackerId: string) => {
    e.stopPropagation();
    try {
      await toggleTrackerPin(trackerId);
      const updated = await fetchTrackers();
      setTrackers(updated);
    } catch (err) {
      console.error("Failed to unpin tracker:", err);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <PageContainer activePage="dashboard" isLoading={isLoading}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboards</h1>
          <p className="text-gray-600">
            Your pinned dashboards and trackers. Pin a dashboard from its page to see it here.
          </p>
        </div>

        {!hasPinned && (
          <div className="text-center py-20">
            <div className="bg-gray-50 rounded-xl p-12 max-w-lg mx-auto">
              <div className="text-gray-300 mb-4">
                <Pin className="w-14 h-14 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Pinned Dashboards
              </h3>
              <p className="text-gray-500 mb-6">
                Visit any dashboard or tracker dashboard and click the pin icon to add it here for quick access.
              </p>
              <button
                onClick={() => navigate("/dashboard/baseline")}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                Go to Baseline Dashboard
              </button>
            </div>
          </div>
        )}

        {pinnedTrackers.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Tracker Dashboards
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pinnedTrackers.map((tracker) => (
                <div
                  key={tracker._id}
                  onClick={() =>
                    tracker.dashboardName &&
                    navigate(`/dashboard/tracker/${tracker.dashboardName}`)
                  }
                  className="group relative bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                >
                  <button
                    onClick={(e) => handleUnpinTracker(e, tracker._id!)}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-colors opacity-0 group-hover:opacity-100"
                    title="Unpin"
                  >
                    <PinOff className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center w-9 h-9 bg-blue-100 rounded-lg">
                      <TrendingUp className="w-4.5 h-4.5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {tracker.name}
                      </h3>
                      <span className="text-xs text-gray-500">Tracker</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{tracker.machine}</span>
                    </div>
                    {tracker.tags.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-gray-400" />
                        <div className="flex flex-wrap gap-1">
                          {tracker.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                          {tracker.tags.length > 3 && (
                            <span className="text-xs text-gray-400">
                              +{tracker.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {pinnedDashboards.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-purple-600" />
              Dashboards
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pinnedDashboards.map((dashboard) => (
                <div
                  key={dashboard._id}
                  onClick={() =>
                    navigate(`/dashboard/config/${dashboard.slug}`)
                  }
                  className="group relative bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-purple-300 transition-all cursor-pointer"
                >
                  <button
                    onClick={(e) => handleUnpinDashboard(e, dashboard._id)}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-purple-500 hover:bg-purple-50 hover:text-purple-700 transition-colors opacity-0 group-hover:opacity-100"
                    title="Unpin"
                  >
                    <PinOff className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center w-9 h-9 bg-purple-100 rounded-lg">
                      <LayoutDashboard className="w-4.5 h-4.5 text-purple-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {dashboard.name}
                      </h3>
                      <span className="text-xs text-gray-500">Dashboard</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Updated {formatDate(dashboard.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageContainer>
  );
}
