import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Plus,
  Check,
} from "lucide-react";
import Modal from "../../Modal/Modal";
import { ModalHeader, ModalBody, ModalFooter } from "../../Modal/ModalComponents";
import KernelTypeDisplay from "../../KernelTypes/KernelTypeDisplay";
import KernelTypeForm from "../../KernelTypes/KernelTypeForm";
import DeleteKernelTypeModal from "../../KernelTypes/DeleteKernelTypeModal";
import UserFriendlyKernelForm from "../../KernelForm/UserFriendlyKernelForm";
import EngineerFriendlyKernelForm from "../../KernelForm/EngineerFriendlyKernelForm";
import ViewToggle from "../../KernelForm/ViewToggle";
import type { ViewMode } from "../../KernelForm/ViewToggle";
import StepIndicator from "./StepIndicator";
import ReviewConfirmStep, { type RuntimeConfig } from "./ReviewConfirmStep";
import { useKernelTypeCrud } from "./useKernelTypeCrud";
import {
  AVAILABLE_MACHINES,
  type KernelTypeDefinition,
} from "../../../types";
import type { KernelInputData } from "../../../utils/kernelTypes";
import { fetchKernelTypes, addKernels } from "../../../utils/github";

interface AddKernelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKernelsAdded: () => void;
}

type Step = "select-type" | "define-kernels" | "confirm";

const STEPS: { key: Step; label: string }[] = [
  { key: "select-type", label: "Select Kernel Type" },
  { key: "define-kernels", label: "Define Kernels" },
  { key: "confirm", label: "Review & Confirm" },
];

export default function AddKernelsModal({
  isOpen,
  onClose,
  onKernelsAdded,
}: AddKernelsModalProps) {
  const [step, setStep] = useState<Step>("select-type");
  const [kernelTypes, setKernelTypes] = useState<KernelTypeDefinition[]>([]);
  const [selectedKernelType, setSelectedKernelType] =
    useState<KernelTypeDefinition | null>(null);
  const [pendingKernels, setPendingKernels] = useState<KernelInputData[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("user-friendly");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>({
    workflow: "e2e",
    machines: AVAILABLE_MACHINES,
  });

  const crud = useKernelTypeCrud(
    kernelTypes,
    setKernelTypes,
    selectedKernelType,
    setSelectedKernelType
  );

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const types = await fetchKernelTypes();
        setKernelTypes(types);
      } catch (err) {
        console.warn("Failed to load kernel types:", err);
        setError("Failed to load kernel types from backend.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isOpen]);

  const reset = () => {
    setStep("select-type");
    setSelectedKernelType(null);
    setPendingKernels([]);
    setViewMode("user-friendly");
    setError(null);
    setRuntimeConfig({ workflow: "e2e", machines: AVAILABLE_MACHINES });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFormChange = useCallback((kernels: KernelInputData[]) => {
    setPendingKernels(kernels);
  }, []);

  const validKernelCount = pendingKernels.filter((k) => k.isValid).length;

  const handleSubmit = async () => {
    if (!selectedKernelType) return;
    const validKernels = pendingKernels.filter((k) => k.isValid);
    if (validKernels.length === 0 || runtimeConfig.machines.length === 0)
      return;

    setIsSubmitting(true);
    try {
      const kernelsToAdd = validKernels.map((kernel) => ({
        name: kernel.id,
        kernelType: selectedKernelType.name,
        tag: kernel.tag,
        machines: runtimeConfig.machines,
        workflow: runtimeConfig.workflow,
        problem: kernel.values,
      }));
      await addKernels(kernelsToAdd);
      handleClose();
      onKernelsAdded();
    } catch (err) {
      console.error("Failed to add kernels:", err);
      alert(
        `Failed to add kernels: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Navigation ---

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const goBack = () => {
    if (step === "define-kernels") setStep("select-type");
    else if (step === "confirm") setStep("define-kernels");
  };

  const goNext = () => {
    if (step === "select-type" && selectedKernelType) setStep("define-kernels");
    else if (step === "define-kernels" && validKernelCount > 0)
      setStep("confirm");
  };

  const isConfirmValid =
    validKernelCount > 0 && runtimeConfig.machines.length > 0;

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} size="xl">
        <ModalHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg">
              <Plus className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Add New Kernels
              </h2>
              <p className="text-sm text-gray-600">
                {STEPS[stepIndex].label} (Step {stepIndex + 1} of{" "}
                {STEPS.length})
              </p>
            </div>
          </div>
        </ModalHeader>

        <StepIndicator steps={STEPS} currentIndex={stepIndex} />

        <ModalBody className="max-h-[65vh] overflow-y-auto">
          {error && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-sm text-amber-800">{error}</span>
              </div>
            </div>
          )}

          {/* Step 1: Select Kernel Type */}
          {step === "select-type" && (
            <>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : (
                <KernelTypeDisplay
                  kernelTypes={kernelTypes}
                  selectedKernelType={selectedKernelType}
                  onSelectKernelType={setSelectedKernelType}
                  onCreateNewType={crud.openCreate}
                  onEditKernelType={crud.openEdit}
                  onDeleteKernelType={crud.openDelete}
                />
              )}
            </>
          )}

          {/* Step 2: Define Kernels */}
          {step === "define-kernels" && selectedKernelType && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-800">
                  Add Kernels for {selectedKernelType.displayName}
                </h3>
                <ViewToggle currentView={viewMode} onViewChange={setViewMode} />
              </div>
              {viewMode === "user-friendly" ? (
                <UserFriendlyKernelForm
                  kernelType={selectedKernelType}
                  onSubmit={() => {}}
                  onChange={handleFormChange}
                  hideSubmit
                />
              ) : (
                <EngineerFriendlyKernelForm
                  kernelType={selectedKernelType}
                  onSubmit={() => {}}
                  onChange={handleFormChange}
                  hideSubmit
                />
              )}
            </div>
          )}

          {/* Step 3: Review & Confirm */}
          {step === "confirm" && selectedKernelType && (
            <ReviewConfirmStep
              kernelType={selectedKernelType}
              kernels={pendingKernels}
              config={runtimeConfig}
              onConfigChange={setRuntimeConfig}
              disabled={isSubmitting}
            />
          )}
        </ModalBody>

        <ModalFooter>
          {step !== "select-type" && (
            <button
              onClick={goBack}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 font-medium text-sm mr-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors font-medium text-sm"
          >
            Cancel
          </button>

          {step === "select-type" && (
            <button
              onClick={goNext}
              disabled={!selectedKernelType}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 font-medium text-sm"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === "define-kernels" && (
            <button
              onClick={goNext}
              disabled={validKernelCount === 0}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 font-medium text-sm"
            >
              Next ({validKernelCount} kernel
              {validKernelCount !== 1 ? "s" : ""})
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === "confirm" && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !isConfirmValid}
              className="px-5 py-2 text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 font-medium text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Add {validKernelCount} Kernel
                  {validKernelCount !== 1 ? "s" : ""}
                </>
              )}
            </button>
          )}
        </ModalFooter>
      </Modal>

      <KernelTypeForm
        isOpen={crud.formModalOpen}
        onClose={crud.closeForm}
        onSubmit={crud.handleSubmit}
        kernelType={crud.kernelTypeToEdit}
        isLoading={crud.isFormLoading}
      />

      <DeleteKernelTypeModal
        isOpen={crud.deleteModalOpen}
        onClose={crud.closeDelete}
        onConfirm={crud.handleConfirmDelete}
        kernelType={crud.kernelTypeToDelete}
        isLoading={crud.isDeleting}
      />
    </>
  );
}
