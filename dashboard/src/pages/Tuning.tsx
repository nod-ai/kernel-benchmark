import { useCallback, useEffect, useMemo, useState } from "react";
import { Play, Filter, Trash2, Edit3, Plus, Tag } from "lucide-react";
import PageContainer from "../components/PageContainer";
import {
  type BenchmarkRun,
  type KernelConfig,
  type KernelTypeDefinition,
  type TuningResults,
} from "../types";
import {
  fetchInProgressTuningRuns,
  fetchKernels,
  fetchKernelTypes,
  fetchTuningResults,
  triggerTuningWorkflow,
  deleteKernels,
  updateKernels as updateKernelsAPI,
} from "../utils/github";
import FilterControls from "../components/FilterControls";
import TuningConfirmationModal, {
  type TuningRuntimeConfig,
} from "../components/Modals/TuningConfirmationModal";
import DeleteKernelsModal from "../components/Modals/DeleteKernelsModal";
import EditKernelsModal, {
  type KernelBatchUpdateData,
} from "../components/Modals/EditKernelsModal";
import RenameTagModal from "../components/Modals/RenameTagModal";
import MergeTagsModal from "../components/Modals/MergeTagsModal";
import AddKernelsModal from "../components/Modals/AddKernels";
import TagGroup from "../components/Kernels/TagGroup";
import KernelSearchBar from "../components/Kernels/KernelSearchBar";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKernels, setSelectedKernels] = useState<Set<string>>(
    new Set()
  );

  // Modal states
  const [showTuningModal, setShowTuningModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isDeletingKernels, setIsDeletingKernels] = useState(false);
  const [_, setIsEditingKernels] = useState(false);

  // Tag management modals
  const [renameTagTarget, setRenameTagTarget] = useState<string | null>(null);
  const [mergeTagTarget, setMergeTagTarget] = useState<string | null>(null);
  const [deleteTagTarget, setDeleteTagTarget] = useState<string | null>(null);

  // Run / progress state
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [inProgress, setInProgress] = useState<Set<string>>(new Set());
  const [kernelTypes, setKernelTypes] = useState<KernelTypeDefinition[]>([]);

  const refreshKernels = useCallback(() => {
    fetchKernels().then(setKernels);
  }, []);
  const refreshTuningResults = useCallback(() => {
    fetchTuningResults().then(setTuningResults);
  }, []);
  const refreshInProgress = useCallback(() => {
    fetchInProgressTuningRuns().then((res) => {
      setRuns(res.runs);
      setInProgress(new Set(res.kernels.map((k) => k._id)));
    });
  }, []);

  useEffect(() => {
    refreshKernels();
    refreshTuningResults();
    refreshInProgress();
    fetchKernelTypes().then(setKernelTypes).catch(console.warn);
    const intervals = [
      setInterval(refreshTuningResults, 30 * 1000),
      setInterval(refreshInProgress, 10 * 1000),
    ];
    return () => intervals.forEach(clearInterval);
  }, []);

  // Derive unique filter options from all kernels of the selected type
  const kernelsOfType = useMemo(
    () => kernels.filter((k) => k.kernelType === selectedKernelType),
    [kernels, selectedKernelType]
  );
  const uniqueDtypes = useMemo(
    () => Array.from(new Set(kernelsOfType.map((k) => k.problem.dtype))),
    [kernelsOfType]
  );

  const attributeOrder = useMemo(() => {
    const typeDef = kernelTypes.find((kt) => kt.name === selectedKernelType);
    return typeDef ? typeDef.attributes.map((a) => a.name) : undefined;
  }, [kernelTypes, selectedKernelType]);

  // Reset dtype selection when kernel type changes
  useEffect(() => {
    setSelectedDtypes(uniqueDtypes);
  }, [uniqueDtypes.join(",")]);

  // Filter kernels (by type, dtypes, tuning status)
  const filteredKernels = useMemo(() => {
    return kernelsOfType.filter(
      (k) =>
        selectedDtypes.includes(k.problem.dtype) &&
        ((tuningResults[k.name] && selectedTuning.includes("tuned")) ||
          (!tuningResults[k.name] && selectedTuning.includes("untuned")))
    );
  }, [kernelsOfType, selectedDtypes, selectedTuning, tuningResults]);

  // Apply search filter
  const searchedKernels = useMemo(() => {
    if (!searchQuery) return filteredKernels;
    return filteredKernels.filter((k) => {
      const haystack = [
        k.name,
        k.tag,
        k.kernelType,
        ...Object.entries(k.problem).map(
          ([key, val]) => `${key} ${val}`
        ),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchQuery);
    });
  }, [filteredKernels, searchQuery]);

  // Group by tag
  const tagGroups = useMemo(() => {
    const groups: Record<string, KernelConfig[]> = {};
    for (const kernel of searchedKernels) {
      const tag = kernel.tag || "(untagged)";
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(kernel);
    }
    return Object.entries(groups).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [searchedKernels]);

  // All unique tags (for merge dropdown)
  const allTags = useMemo(
    () =>
      Array.from(new Set(kernels.map((k) => k.tag))).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      ),
    [kernels]
  );

  const selectionEnabled = runs.length === 0;

  const toggleKernels = useCallback(
    (kernelIds: string[], state: boolean) => {
      setSelectedKernels((prev) => {
        const next = new Set(prev);
        for (const id of kernelIds) {
          if (state) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    []
  );

  const handleSearch = useCallback((q: string) => setSearchQuery(q), []);

  // --- Action handlers ---

  const handleTuningConfirm = async (_config: TuningRuntimeConfig) => {
    await triggerTuningWorkflow(Array.from(selectedKernels));
    setShowTuningModal(false);
  };

  const handleDeleteConfirm = async () => {
    setIsDeletingKernels(true);
    try {
      await deleteKernels(Array.from(selectedKernels));
      setSelectedKernels(new Set());
      refreshKernels();
      setShowDeleteModal(false);
    } catch (error) {
      console.error("Failed to delete kernels:", error);
    } finally {
      setIsDeletingKernels(false);
    }
  };

  const handleEditConfirm = async (updates: KernelBatchUpdateData) => {
    setIsEditingKernels(true);
    try {
      const kernelUpdates = Array.from(selectedKernels).map((kernelId) => {
        const updateData: Partial<KernelConfig> = { _id: kernelId };
        if (updates.tag !== undefined) updateData.tag = updates.tag;
        if (updates.workflow !== undefined) updateData.workflow = updates.workflow;
        return updateData;
      });
      await updateKernelsAPI(kernelUpdates);
      setSelectedKernels(new Set());
      refreshKernels();
      setShowEditModal(false);
    } catch (error) {
      console.error("Failed to update kernels:", error);
    } finally {
      setIsEditingKernels(false);
    }
  };

  // --- Tag management handlers ---

  const handleRenameTag = async (oldTag: string, newTag: string) => {
    const affected = kernels.filter((k) => k.tag === oldTag);
    const updates = affected.map((k) => ({ _id: k._id, tag: newTag }));
    await updateKernelsAPI(updates);
    refreshKernels();
  };

  const handleMergeTag = async (sourceTag: string, targetTag: string) => {
    const affected = kernels.filter((k) => k.tag === sourceTag);
    const updates = affected.map((k) => ({ _id: k._id, tag: targetTag }));
    await updateKernelsAPI(updates);
    refreshKernels();
  };

  const handleDeleteTagKernels = async () => {
    if (!deleteTagTarget) return;
    setIsDeletingKernels(true);
    try {
      const affected = kernels.filter((k) => k.tag === deleteTagTarget);
      await deleteKernels(affected.map((k) => k._id));
      setSelectedKernels(new Set());
      refreshKernels();
      setDeleteTagTarget(null);
    } catch (error) {
      console.error("Failed to delete tag kernels:", error);
    } finally {
      setIsDeletingKernels(false);
    }
  };

  const deleteTagKernelCount = deleteTagTarget
    ? kernels.filter((k) => k.tag === deleteTagTarget).length
    : 0;
  const renameTagKernelCount = renameTagTarget
    ? kernels.filter((k) => k.tag === renameTagTarget).length
    : 0;
  const mergeTagKernelCount = mergeTagTarget
    ? kernels.filter((k) => k.tag === mergeTagTarget).length
    : 0;

  return (
    <PageContainer activePage="kernels" isLoading={kernels.length === 0}>
      <div className="flex flex-col gap-5 pb-20">
        {/* Top bar: Search + Add Kernels */}
        <div className="flex items-center gap-3">
          <KernelSearchBar onSearch={handleSearch} />
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 shadow-sm font-medium text-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Kernels
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-800">Filters</h2>
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
                  onInput: setSelectedKernelType,
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
            ]}
          />
        </div>

        {/* Tag Groups */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-800">
                Kernels ({searchedKernels.length})
              </h2>
              <span className="text-xs text-gray-500">
                in {tagGroups.length} tag{tagGroups.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {tagGroups.map(([tag, groupKernels]) => (
              <TagGroup
                key={tag}
                tag={tag}
                kernels={groupKernels}
                tuningResults={tuningResults}
                inProgress={inProgress}
                activeKernels={selectionEnabled ? selectedKernels : undefined}
                toggleKernels={selectionEnabled ? toggleKernels : undefined}
                forceExpanded={searchQuery.length > 0 ? true : undefined}
                attributeOrder={attributeOrder}
                onRenameTag={setRenameTagTarget}
                onMergeTag={setMergeTagTarget}
                onDeleteTag={setDeleteTagTarget}
              />
            ))}

            {tagGroups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
                <Tag className="w-10 h-10 mb-3 text-gray-300" />
                <p className="text-base font-medium">No kernels found</p>
                <p className="text-sm">
                  Try adjusting your filters or search query.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sticky bottom action bar */}
        {selectedKernels.size > 0 && selectionEnabled && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
            <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedKernels.size} kernel
                {selectedKernels.size !== 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedKernels(new Set())}
                  className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                >
                  Clear
                </button>
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                  onClick={() => setShowEditModal(true)}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  onClick={() => setShowTuningModal(true)}
                >
                  <Play className="w-3.5 h-3.5" />
                  Tune
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <TuningConfirmationModal
        isOpen={showTuningModal}
        onClose={() => setShowTuningModal(false)}
        onConfirm={handleTuningConfirm}
        selectedKernelCount={selectedKernels.size}
      />

      <DeleteKernelsModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        kernelCount={selectedKernels.size}
        isLoading={isDeletingKernels}
      />

      <EditKernelsModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onConfirm={handleEditConfirm}
        kernelCount={selectedKernels.size}
      />

      <AddKernelsModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onKernelsAdded={refreshKernels}
      />

      {/* Tag management modals */}
      <RenameTagModal
        isOpen={renameTagTarget !== null}
        onClose={() => setRenameTagTarget(null)}
        onConfirm={handleRenameTag}
        tag={renameTagTarget ?? ""}
        kernelCount={renameTagKernelCount}
      />

      <MergeTagsModal
        isOpen={mergeTagTarget !== null}
        onClose={() => setMergeTagTarget(null)}
        onConfirm={handleMergeTag}
        sourceTag={mergeTagTarget ?? ""}
        kernelCount={mergeTagKernelCount}
        allTags={allTags}
      />

      <DeleteKernelsModal
        isOpen={deleteTagTarget !== null}
        onClose={() => setDeleteTagTarget(null)}
        onConfirm={handleDeleteTagKernels}
        kernelCount={deleteTagKernelCount}
        isLoading={isDeletingKernels}
        tagName={deleteTagTarget ?? undefined}
      />
    </PageContainer>
  );
}
