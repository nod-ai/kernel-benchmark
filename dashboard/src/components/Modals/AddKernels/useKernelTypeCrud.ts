import { useState } from "react";
import { useModal } from "../../../contexts/useModal";
import type { KernelTypeDefinition } from "../../../types";
import {
  createKernelType,
  validateKernelTypeData,
} from "../../../utils/kernelTypes";
import {
  addKernelType,
  updateKernelType,
  deleteKernelType,
} from "../../../utils/github";

export function useKernelTypeCrud(
  kernelTypes: KernelTypeDefinition[],
  setKernelTypes: React.Dispatch<React.SetStateAction<KernelTypeDefinition[]>>,
  selectedKernelType: KernelTypeDefinition | null,
  setSelectedKernelType: React.Dispatch<
    React.SetStateAction<KernelTypeDefinition | null>
  >
) {
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [kernelTypeToEdit, setKernelTypeToEdit] =
    useState<KernelTypeDefinition | null>(null);
  const [kernelTypeToDelete, setKernelTypeToDelete] =
    useState<KernelTypeDefinition | null>(null);

  const formModal = useModal();
  const deleteModal = useModal();

  const handleCreate = async (data: Omit<KernelTypeDefinition, "_id">) => {
    const validation = validateKernelTypeData(data);
    if (!validation.isValid) {
      alert(`Validation errors:\n${validation.errors.join("\n")}`);
      return;
    }
    if (kernelTypes.find((kt) => kt.name === data.name)) {
      alert(`A kernel type with the name "${data.name}" already exists.`);
      return;
    }
    try {
      setIsCreating(true);
      const created = await addKernelType(createKernelType(data));
      setKernelTypes((prev) => [...prev, created]);
      setSelectedKernelType(created);
      formModal.close();
      setKernelTypeToEdit(null);
    } catch (err) {
      console.error("Failed to create kernel type:", err);
      alert(
        `Failed to create kernel type: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async (updated: KernelTypeDefinition) => {
    try {
      setIsUpdating(true);
      const result = await updateKernelType(updated._id, {
        name: updated.name,
        displayName: updated.displayName,
        description: updated.description,
        attributes: updated.attributes,
      });
      setKernelTypes((prev) =>
        prev.map((kt) => (kt._id === updated._id ? result : kt))
      );
      if (selectedKernelType?._id === updated._id)
        setSelectedKernelType(result);
      formModal.close();
      setKernelTypeToEdit(null);
    } catch (err) {
      console.error("Failed to update kernel type:", err);
      alert(
        `Failed to update kernel type: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSubmit = async (
    data: KernelTypeDefinition | Omit<KernelTypeDefinition, "_id">
  ) => {
    if ("_id" in data) await handleUpdate(data);
    else await handleCreate(data);
  };

  const handleConfirmDelete = async () => {
    if (!kernelTypeToDelete) return;
    try {
      setIsDeleting(true);
      await deleteKernelType(kernelTypeToDelete._id);
      setKernelTypes((prev) =>
        prev.filter((kt) => kt._id !== kernelTypeToDelete._id)
      );
      if (selectedKernelType?._id === kernelTypeToDelete._id)
        setSelectedKernelType(null);
      deleteModal.close();
      setKernelTypeToDelete(null);
    } catch (err) {
      console.error("Failed to delete kernel type:", err);
      alert(
        `Failed to delete kernel type: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const openCreate = () => {
    setKernelTypeToEdit(null);
    formModal.open();
  };

  const openEdit = (kt: KernelTypeDefinition) => {
    setKernelTypeToEdit(kt);
    formModal.open();
  };

  const openDelete = (kt: KernelTypeDefinition) => {
    setKernelTypeToDelete(kt);
    deleteModal.open();
  };

  const closeForm = () => {
    formModal.close();
    setKernelTypeToEdit(null);
  };

  const closeDelete = () => {
    deleteModal.close();
    setKernelTypeToDelete(null);
  };

  return {
    isFormLoading: isCreating || isUpdating,
    isDeleting,
    kernelTypeToEdit,
    kernelTypeToDelete,
    formModalOpen: formModal.isOpen,
    deleteModalOpen: deleteModal.isOpen,
    handleSubmit,
    handleConfirmDelete,
    openCreate,
    openEdit,
    openDelete,
    closeForm,
    closeDelete,
  };
}
