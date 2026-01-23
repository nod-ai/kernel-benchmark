import { useState, useEffect } from "react";
import PageContainer from "../components/PageContainer";
import AddTrackerModal, {
  type TrackerConfig,
} from "../components/Modals/AddTrackerModal";
import {
  fetchTrackers,
  createTracker,
  updateTracker,
  deleteTracker,
  type TrackerData,
  type ScheduleData,
} from "../utils/github";
import { toYYYYMMDD, formatMMDDYYYY } from "../utils/utils";
import {
  Plus,
  Calendar,
  Monitor,
  Tag,
  Clock,
  Trash2,
  PlayCircle,
  PauseCircle,
  Edit,
  Cpu,
} from "lucide-react";

interface Tracker {
  id: string;
  name: string;
  blobName: string;
  tags: string[];
  backends: string[];
  machine: string;
  schedule: ScheduleData;
  isActive: boolean;
  createdAt: Date;
}

export default function Tracking() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTracker, setEditingTracker] = useState<
    (TrackerConfig & { _id: string }) | undefined
  >(undefined);

  // Load trackers on mount
  useEffect(() => {
    loadTrackers();
  }, []);

  const loadTrackers = async () => {
    try {
      setIsLoading(true);
      const data = await fetchTrackers();
      const mappedTrackers: Tracker[] = data.map((t) => ({
        id: t._id!,
        name: t.name,
        blobName: t.blobName,
        tags: t.tags,
        backends: t.backends,
        machine: t.machine,
        schedule: {
          ...t.schedule,
          // Dates are stored as MM-DD-YYYY in backend, keep them as-is for display
        },
        isActive: t.isActive ?? true,
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
      }));
      setTrackers(mappedTrackers);
    } catch (error) {
      console.error("Failed to load trackers:", error);
      alert("Failed to load trackers. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTracker = async (config: TrackerConfig) => {
    try {
      const trackerData: TrackerData = {
        name: config.name,
        blobName: config.blobName,
        tags: config.tags,
        backends: config.backends,
        machine: config.machine,
        schedule: config.schedule,
        isActive: true,
      };

      if (editingTracker) {
        // Update existing tracker
        await updateTracker(editingTracker._id, trackerData);
      } else {
        // Create new tracker
        await createTracker(trackerData);
      }

      await loadTrackers();
      setEditingTracker(undefined);
    } catch (error) {
      console.error("Failed to save tracker:", error);
      alert("Failed to save tracker. Please try again.");
      throw error;
    }
  };

  const toggleTrackerStatus = async (id: string) => {
    try {
      const tracker = trackers.find((t) => t.id === id);
      if (!tracker) return;

      await updateTracker(id, { isActive: !tracker.isActive });
      await loadTrackers();
    } catch (error) {
      console.error("Failed to toggle tracker status:", error);
      alert("Failed to update tracker status. Please try again.");
    }
  };

  const handleDeleteTracker = async (id: string) => {
    if (
      window.confirm(
        "Are you sure you want to delete this tracker? This action cannot be undone."
      )
    ) {
      try {
        await deleteTracker(id);
        await loadTrackers();
      } catch (error) {
        console.error("Failed to delete tracker:", error);
        alert("Failed to delete tracker. Please try again.");
      }
    }
  };

  const handleEditTracker = (tracker: Tracker) => {
    // Convert dates from MM-DD-YYYY (backend) to YYYY-MM-DD (HTML input) for editing
    const scheduleForEdit: TrackerConfig["schedule"] = {
      ...tracker.schedule,
      startDate: toYYYYMMDD(tracker.schedule.startDate),
      endDate: tracker.schedule.endDate
        ? toYYYYMMDD(tracker.schedule.endDate)
        : undefined,
    };

    const trackerConfig: TrackerConfig & { _id: string } = {
      _id: tracker.id,
      name: tracker.name,
      blobName: tracker.blobName,
      tags: tracker.tags,
      backends: tracker.backends,
      machine: tracker.machine,
      schedule: scheduleForEdit,
    };
    setEditingTracker(trackerConfig);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTracker(undefined);
  };

  const formatSchedule = (schedule: ScheduleData): string => {
    if (!schedule.isInterval) {
      const days = (schedule.daysOfWeek || [])
        .map((day) => day.charAt(0).toUpperCase() + day.slice(1, 3))
        .join(", ");
      return `Weekly on ${days} at ${schedule.timeOfDay} UTC`;
    } else {
      const unit = schedule.intervalUnit === "weeks" ? "week" : "month";
      const plural = (schedule.intervalValue || 1) > 1 ? "s" : "";
      return `Every ${schedule.intervalValue} ${unit}${plural} at ${schedule.timeOfDay} UTC`;
    }
  };

  return (
    <PageContainer activePage="tracking" isLoading={isLoading}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Header Section */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Kernel Tracking
              </h1>
              <p className="text-gray-600">
                Schedule automated benchmarks for specific kernels across
                different backends
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-all duration-200"
            >
              <Plus className="w-5 h-5" />
              Add Tracker
            </button>
          </div>

          {/* Trackers List */}
          {!isLoading && trackers.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gray-50 rounded-lg p-12 max-w-md mx-auto">
                <div className="text-gray-400 mb-4">
                  <Calendar className="w-12 h-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Trackers Yet
                </h3>
                <p className="text-gray-600 mb-6">
                  Create your first tracker to automate kernel benchmarking
                  across backends on a schedule.
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-all duration-200"
                >
                  <Plus className="w-5 h-5" />
                  Add Tracker
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {trackers.map((tracker) => (
                <div
                  key={tracker.id}
                  className={`bg-white border ${
                    tracker.isActive
                      ? "border-blue-200 bg-blue-50"
                      : "border-gray-200"
                  } rounded-xl p-6 shadow-sm transition-all duration-200`}
                >
                  {/* Tracker Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={`flex items-center justify-center w-10 h-10 flex-shrink-0 ${
                          tracker.isActive ? "bg-blue-100" : "bg-gray-100"
                        } rounded-lg`}
                      >
                        <Calendar
                          className={`w-5 h-5 ${
                            tracker.isActive ? "text-blue-600" : "text-gray-400"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {tracker.name}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            tracker.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {tracker.isActive ? "Active" : "Paused"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditTracker(tracker)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit tracker"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => toggleTrackerStatus(tracker.id)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={tracker.isActive ? "Pause tracker" : "Resume tracker"}
                      >
                        {tracker.isActive ? (
                          <PauseCircle className="w-5 h-5" />
                        ) : (
                          <PlayCircle className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteTracker(tracker.id)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete tracker"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Tracker Details */}
                  <div className="space-y-4">
                    {/* Kernel Tags */}
                    <div className="flex items-start gap-3">
                      <Tag className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500 mb-1">
                          KERNEL TAGS
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {tracker.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Backends */}
                    <div className="flex items-start gap-3">
                      <Cpu className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500 mb-1">
                          BACKENDS
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {tracker.backends.map((backend) => (
                            <span
                              key={backend}
                              className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium"
                            >
                              {backend}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Machine */}
                    <div className="flex items-start gap-3">
                      <Monitor className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500 mb-1">
                          MACHINE
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {tracker.machine}
                        </p>
                      </div>
                    </div>

                    {/* Schedule */}
                    <div className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500 mb-1">
                          SCHEDULE
                        </p>
                        <p className="text-sm text-gray-900">
                          {formatSchedule(tracker.schedule)}
                        </p>
                        {tracker.schedule.endDate && (
                          <p className="text-xs text-gray-500 mt-1">
                            Ends on {formatMMDDYYYY(tracker.schedule.endDate)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Run Info */}
                    <div className="pt-3 border-t border-gray-200">
                      <div className="text-xs">
                        <span className="text-gray-500">Created: </span>
                        <span className="text-gray-900 font-medium">
                          {tracker.createdAt.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddTrackerModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleAddTracker}
        editingTracker={editingTracker}
      />
    </PageContainer>
  );
}
