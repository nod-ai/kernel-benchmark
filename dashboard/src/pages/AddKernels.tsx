import { useState, useEffect } from "react";
import PageContainer from "../components/PageContainer";
import KernelTypeDisplay from "../components/KernelTypes/KernelTypeDisplay";
import KernelTypeForm from "../components/KernelTypes/KernelTypeForm";
import DeleteKernelTypeModal from "../components/KernelTypes/DeleteKernelTypeModal";
import UserFriendlyKernelForm from "../components/KernelForm/UserFriendlyKernelForm";
import EngineerFriendlyKernelForm from "../components/KernelForm/EngineerFriendlyKernelForm";
import KernelConfirmationModal from "../components/KernelForm/KernelConfirmationModal";
import ViewToggle from "../components/KernelForm/ViewToggle";
import type { ViewMode } from "../components/KernelForm/ViewToggle";
import { useModal } from "../contexts/useModal";
import type { KernelTypeDefinition, KernelRuntimeConfig } from "../types";
import {
  createKernelType,
  validateKernelTypeData,
  type KernelInputData,
} from "../utils/kernelTypes";
import {
  fetchKernelTypes,
  addKernelType,
  updateKernelType,
  deleteKernelType,
  addKernels,
} from "../utils/github";
import { AlertTriangle, Loader2 } from "lucide-react";

export default function AddKernels() {
  const [kernelTypes, setKernelTypes] = useState<KernelTypeDefinition[]>([]);
  const [selectedKernelType, setSelectedKernelType] =
    useState<KernelTypeDefinition | null>(null);
  const [pendingKernels, setPendingKernels] = useState<KernelInputData[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("user-friendly");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [kernelTypeToEdit, setKernelTypeToEdit] =
    useState<KernelTypeDefinition | null>(null);
  const [kernelTypeToDelete, setKernelTypeToDelete] =
    useState<KernelTypeDefinition | null>(null);

  const kernelTypeModal = useModal();
  const deleteTypeModal = useModal();
  const confirmationModal = useModal();

  // Load kernel types from backend on component mount
  useEffect(() => {
    const loadKernelTypes = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const backendKernelTypes = await fetchKernelTypes();
        setKernelTypes(backendKernelTypes);
      } catch (err) {
        console.warn("Failed to load kernel types from backend:", err);
        setError("Failed to load kernel types from backend.");
      } finally {
        setIsLoading(false);
      }
    };

    loadKernelTypes();
  }, []);

  const handleCreateKernelType = async (
    data: Omit<KernelTypeDefinition, "_id">
  ) => {
    const validation = validateKernelTypeData(data);

    if (!validation.isValid) {
      alert(`Validation errors:\n${validation.errors.join("\n")}`);
      return;
    }

    // Check if name already exists
    const existingType = kernelTypes.find((kt) => kt.name === data.name);
    if (existingType) {
      alert(`A kernel type with the name "${data.name}" already exists.`);
      return;
    }

    try {
      setIsCreating(true);

      // Create the kernel type with ID
      const kernelTypeToCreate = createKernelType(data);

      // Save to backend
      const createdKernelType = await addKernelType(kernelTypeToCreate);

      // Update local state
      setKernelTypes((prev) => [...prev, createdKernelType]);
      setSelectedKernelType(createdKernelType);
      kernelTypeModal.close();
      setKernelTypeToEdit(null);

      alert(
        `Successfully created kernel type "${createdKernelType.displayName}"!`
      );
    } catch (err) {
      console.error("Failed to create kernel type:", err);
      alert(
        `Failed to create kernel type: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectKernelType = (kernelType: KernelTypeDefinition) => {
    setSelectedKernelType(kernelType);
  };

  const handleEditKernelType = (kernelType: KernelTypeDefinition) => {
    setKernelTypeToEdit(kernelType);
    kernelTypeModal.open();
  };

  const handleKernelTypeSubmit = async (
    kernelTypeData: KernelTypeDefinition | Omit<KernelTypeDefinition, "_id">
  ) => {
    if ("_id" in kernelTypeData) {
      // Edit mode
      await handleUpdateKernelType(kernelTypeData);
    } else {
      // Create mode
      await handleCreateKernelType(kernelTypeData);
    }
  };

  const handleUpdateKernelType = async (
    updatedKernelType: KernelTypeDefinition
  ) => {
    try {
      setIsUpdating(true);

      // Update in backend
      const result = await updateKernelType(updatedKernelType._id, {
        name: updatedKernelType.name,
        displayName: updatedKernelType.displayName,
        description: updatedKernelType.description,
        attributes: updatedKernelType.attributes,
      });

      // Update local state
      setKernelTypes((prev) =>
        prev.map((kt) => (kt._id === updatedKernelType._id ? result : kt))
      );

      // Update selected kernel type if it's the one being edited
      if (selectedKernelType?._id === updatedKernelType._id) {
        setSelectedKernelType(result);
      }

      kernelTypeModal.close();
      setKernelTypeToEdit(null);

      alert(`Successfully updated kernel type "${result.displayName}"!`);
    } catch (err) {
      console.error("Failed to update kernel type:", err);
      alert(
        `Failed to update kernel type: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteKernelType = (kernelType: KernelTypeDefinition) => {
    setKernelTypeToDelete(kernelType);
    deleteTypeModal.open();
  };

  const handleConfirmDelete = async () => {
    if (!kernelTypeToDelete) return;

    try {
      setIsDeleting(true);

      // Delete from backend
      await deleteKernelType(kernelTypeToDelete._id);

      // Update local state
      setKernelTypes((prev) =>
        prev.filter((kt) => kt._id !== kernelTypeToDelete._id)
      );

      // Clear selection if the deleted type was selected
      if (selectedKernelType?._id === kernelTypeToDelete._id) {
        setSelectedKernelType(null);
      }

      deleteTypeModal.close();
      setKernelTypeToDelete(null);

      alert(
        `Successfully deleted kernel type "${kernelTypeToDelete.displayName}"!`
      );
    } catch (err) {
      console.error("Failed to delete kernel type:", err);
      alert(
        `Failed to delete kernel type: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleKernelSubmit = (kernels: KernelInputData[]) => {
    setPendingKernels(kernels);
    confirmationModal.open();
  };

  const handleConfirmKernels = async (config: KernelRuntimeConfig) => {
    if (!selectedKernelType) {
      alert("No kernel type selected!");
      return;
    }

    try {
      // Transform pending kernels to match backend API format
      const kernelsToAdd = pendingKernels.map((kernel) => ({
        name: kernel.id,
        kernelType: selectedKernelType.name,
        tag: kernel.tag,
        machines: config.machines,
        workflow: config.workflow,
        problem: kernel.values, // The kernel's attribute values become the problem object
      }));

      console.log("Adding kernels:", kernelsToAdd);

      // Submit to backend
      await addKernels(kernelsToAdd);

      // Show success message
      const uniqueTags = [...new Set(pendingKernels.map((k) => k.tag))];
      const tagsList =
        uniqueTags.length === 1
          ? `"${uniqueTags[0]}"`
          : `multiple tags: ${uniqueTags.map((t) => `"${t}"`).join(", ")}`;

      alert(
        `Successfully added ${pendingKernels.length} kernel(s) with ${tagsList} for machines [${config.machines.join(", ")}] and workflow "${config.workflow}" to the dashboard!`
      );

      // Reset pending kernels and close modal
      setPendingKernels([]);
      confirmationModal.close();
    } catch (err) {
      console.error("Failed to add kernels:", err);
      alert(
        `Failed to add kernels: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  return (
    <PageContainer activePage="new">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Add New Kernels
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Select an existing kernel type or create a new one to add kernels
            for benchmarking.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="text-amber-800">
                <strong className="font-semibold">Warning:</strong>
                <span className="ml-2">{error}</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600">
                Loading kernel types...
              </p>
            </div>
          </div>
        ) : (
          <KernelTypeDisplay
            kernelTypes={kernelTypes}
            selectedKernelType={selectedKernelType}
            onSelectKernelType={handleSelectKernelType}
            onCreateNewType={() => {
              setKernelTypeToEdit(null);
              kernelTypeModal.open();
            }}
            onEditKernelType={handleEditKernelType}
            onDeleteKernelType={handleDeleteKernelType}
          />
        )}

        {/* Kernel Form Section */}
        {selectedKernelType && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Add Kernels for {selectedKernelType.displayName}
                </h2>
                <ViewToggle currentView={viewMode} onViewChange={setViewMode} />
              </div>
            </div>
            <div className="p-6">
              {viewMode === "user-friendly" ? (
                <UserFriendlyKernelForm
                  kernelType={selectedKernelType}
                  onSubmit={handleKernelSubmit}
                />
              ) : (
                <EngineerFriendlyKernelForm
                  kernelType={selectedKernelType}
                  onSubmit={handleKernelSubmit}
                />
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!selectedKernelType && (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
            <h2 className="text-xl font-semibold text-gray-600 mb-3">
              No Kernel Type Selected
            </h2>
            <p className="text-gray-500 text-lg">
              Please select a kernel type above to start adding kernels, or
              create a new kernel type.
            </p>
          </div>
        )}

        <KernelTypeForm
          isOpen={kernelTypeModal.isOpen}
          onClose={() => {
            kernelTypeModal.close();
            setKernelTypeToEdit(null);
          }}
          onSubmit={handleKernelTypeSubmit}
          kernelType={kernelTypeToEdit}
          isLoading={isCreating || isUpdating}
        />

        <DeleteKernelTypeModal
          isOpen={deleteTypeModal.isOpen}
          onClose={() => {
            deleteTypeModal.close();
            setKernelTypeToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          kernelType={kernelTypeToDelete}
          isLoading={isDeleting}
        />

        {selectedKernelType && (
          <KernelConfirmationModal
            isOpen={confirmationModal.isOpen}
            onClose={confirmationModal.close}
            onConfirm={handleConfirmKernels}
            kernelType={selectedKernelType}
            kernels={pendingKernels}
          />
        )}
      </div>
    </PageContainer>
  );
}
