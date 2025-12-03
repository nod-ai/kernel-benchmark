import { useEffect, useMemo, useState } from "react";
import { Play, Filter, Trash2, Edit3 } from "lucide-react";
import PageContainer from "../components/PageContainer";
import {
  type BenchmarkRun,
  type KernelConfig,
  type TuningResults,
} from "../types";
import {
  fetchInProgressTuningRuns,
  fetchKernels,
  fetchTuningResults,
  triggerTuningWorkflow,
  deleteKernels,
  updateKernels as updateKernelsAPI,
} from "../utils/github";
import KernelList from "../components/Kernels/KernelList";
import FilterControls from "../components/FilterControls";
import TuningConfirmationModal, {
  type TuningRuntimeConfig,
} from "../components/Modals/TuningConfirmationModal";
import DeleteKernelsModal from "../components/Modals/DeleteKernelsModal";
import EditKernelsModal, {
  type KernelBatchUpdateData,
} from "../components/Modals/EditKernelsModal";

export default function Tuning() {
  const [kernels, setKernels] = useState<KernelConfig[]>([]);
  const [tuningResults, setTuningResults] = useState<TuningResults>({});
  const [selectedKernelType, setSelectedKernelType] =
    useState<string>("attention");
  const [selectedTuning, setSelectedTuning] = useState<string[]>([
    "tuned",
    "untuned",
  ]);
  const [selectedDtypes, setSelectedDtypes] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tuningKernels, setTuningKernels] = useState<Set<string>>(new Set());
  const [showTuningModal, setShowTuningModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeletingKernels, setIsDeletingKernels] = useState(false);
  const [_, setIsEditingKernels] = useState(false);

  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [inProgress, setInProgress] = useState<Set<string>>(new Set());

  const updateKernels = () => {
    fetchKernels().then(setKernels);
  };
  const updateTuningResults = () => {
    fetchTuningResults().then(setTuningResults);
  };
  const updateInProgress = () => {
    fetchInProgressTuningRuns().then((res) => {
      setRuns(res.runs);
      setInProgress(new Set(res.kernels.map((k) => k._id)));
    });
  };

  useEffect(() => {
    updateKernels();
    updateTuningResults();
    updateInProgress();

    const intervals = [
      // setInterval(updateKernels, 60 * 1000),
      setInterval(updateTuningResults, 30 * 1000),
      setInterval(updateInProgress, 10 * 1000),
    ];
    return () => {
      for (let interval of intervals) clearInterval(interval);
    };
  }, []);

  const filteredKernels = useMemo(() => {
    return kernels.filter(
      (k) =>
        selectedDtypes.includes(k.problem.dtype) &&
        selectedTags.includes(k.tag) &&
        selectedKernelType === k.kernelType &&
        ((tuningResults[k.name] && selectedTuning.includes("tuned")) ||
          (!tuningResults[k.name] && selectedTuning.includes("untuned")))
    );
  }, [
    kernels,
    selectedKernelType,
    selectedDtypes,
    selectedTags,
    selectedTuning,
  ]);

  const getUnique = (fromKernels: KernelConfig[]) => {
    const uniqueDtypes = Array.from(
      new Set(fromKernels.map((k) => k.problem.dtype))
    );
    const uniqueTags = Array.from(new Set(fromKernels.map((k) => k.tag)));
    return { uniqueDtypes, uniqueTags };
  };

  const { uniqueDtypes, uniqueTags } = useMemo(
    () => getUnique(kernels),
    [filteredKernels]
  );

  useEffect(() => {
    const unique = getUnique(kernels);
    setSelectedDtypes(unique.uniqueDtypes);
    setSelectedTags(unique.uniqueTags);
  }, [kernels]);

  const toggleTuningKernels = (kernelIds: string[], state: boolean) => {
    setTuningKernels((oldTk) => {
      if (state) {
        return new Set(Array.from(oldTk).concat(kernelIds));
      } else {
        return new Set(
          Array.from(oldTk).filter((id) => !kernelIds.includes(id))
        );
      }
    });
  };

  const handleTuningConfirm = async (_config: TuningRuntimeConfig) => {
    // TODO: Pass the config to the triggerTuningWorkflow function
    // For now, we'll just call it with the selected kernels as before
    await triggerTuningWorkflow(Array.from(tuningKernels));
    setShowTuningModal(false);
  };

  const handleDeleteConfirm = async () => {
    setIsDeletingKernels(true);
    try {
      await deleteKernels(Array.from(tuningKernels));
      setTuningKernels(new Set()); // Clear selected kernels after deletion
      await updateKernels(); // Refresh the kernel list
      setShowDeleteModal(false);
    } catch (error) {
      console.error("Failed to delete kernels:", error);
      // You might want to add a toast notification here
    } finally {
      setIsDeletingKernels(false);
    }
  };

  const handleEditConfirm = async (updates: KernelBatchUpdateData) => {
    setIsEditingKernels(true);
    try {
      // Create partial kernel updates with just the _id and the fields to update
      const kernelUpdates = Array.from(tuningKernels).map((kernelId) => {
        const updateData: Partial<KernelConfig> = { _id: kernelId };
        if (updates.tag !== undefined) {
          updateData.tag = updates.tag;
        }
        if (updates.workflow !== undefined) {
          updateData.workflow = updates.workflow;
        }
        return updateData;
      });

      await updateKernelsAPI(kernelUpdates);
      setTuningKernels(new Set()); // Clear selected kernels after update
      await updateKernels(); // Refresh the kernel list
      setShowEditModal(false);
    } catch (error) {
      console.error("Failed to update kernels:", error);
      // You might want to add a toast notification here
    } finally {
      setIsEditingKernels(false);
    }
  };

  return (
    <PageContainer activePage="tune" isLoading={kernels.length === 0}>
      <div className="flex flex-col gap-6">
        {/* Header Section */}
        {tuningKernels.size > 0 && runs.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {tuningKernels.size} kernel{tuningKernels.size !== 1 ? "s" : ""}{" "}
                selected
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 shadow-sm font-medium"
                  onClick={() => {
                    setShowEditModal(true);
                  }}
                >
                  <Edit3 className="w-4 h-4" />
                  Edit {tuningKernels.size} Kernel
                  {tuningKernels.size !== 1 ? "s" : ""}
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 shadow-sm font-medium"
                  onClick={() => {
                    setShowDeleteModal(true);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete {tuningKernels.size} Kernel
                  {tuningKernels.size !== 1 ? "s" : ""}
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm font-medium"
                  onClick={() => {
                    setShowTuningModal(true);
                  }}
                >
                  <Play className="w-4 h-4" />
                  Tune {tuningKernels.size} Kernel
                  {tuningKernels.size !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Filter className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
          </div>

          <FilterControls
            filters={[
              {
                type: "multi",
                props: {
                  title: "Tuning Status",
                  options: ["tuned", "untuned"],
                  selectedOptions: selectedTuning,
                  onInput: setSelectedTuning,
                },
              },
              {
                type: "single",
                props: {
                  title: "Kernel Type",
                  options: Array.from(
                    new Set(kernels.map((k) => k.kernelType))
                  ),
                  selectedOption: selectedKernelType,
                  onInput: (kType: string) => setSelectedKernelType(kType),
                },
              },
              {
                type: "multi",
                props: {
                  title: "Data Types",
                  options: uniqueDtypes,
                  selectedOptions: selectedDtypes,
                  onInput: setSelectedDtypes,
                },
              },
              {
                type: "multi",
                props: {
                  title: "Tags",
                  options: uniqueTags,
                  selectedOptions: selectedTags,
                  onInput: setSelectedTags,
                },
              },
            ]}
          />
        </div>

        {/* Results Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Kernels ({filteredKernels.length})
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Select kernels to tune or view their current tuning configurations
            </p>
          </div>

          <div className="p-6">
            <KernelList
              kernels={filteredKernels}
              tuningResults={tuningResults}
              inProgress={inProgress}
              toggleKernels={
                runs.length === 0 ? toggleTuningKernels : undefined
              }
              activeKernels={runs.length === 0 ? tuningKernels : undefined}
            />
          </div>
        </div>

        {/* Tuning Confirmation Modal */}
        <TuningConfirmationModal
          isOpen={showTuningModal}
          onClose={() => setShowTuningModal(false)}
          onConfirm={handleTuningConfirm}
          selectedKernelCount={tuningKernels.size}
        />

        {/* Delete Kernels Modal */}
        <DeleteKernelsModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteConfirm}
          kernelCount={tuningKernels.size}
          isLoading={isDeletingKernels}
        />

        {/* Edit Kernels Modal */}
        <EditKernelsModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onConfirm={handleEditConfirm}
          kernelCount={tuningKernels.size}
        />
      </div>
    </PageContainer>
  );
}
