import { useState, useEffect } from "react";
import Modal from "../Modal/Modal";
import { ModalHeader, ModalBody, ModalFooter } from "../Modal/ModalComponents";
import { fetchKernels } from "../../utils/github";
import {
  type BenchmarkRuntimeConfig,
  type KernelConfig,
  type KernelSelection,
  type RepoPullRequest,
} from "../../types";
import {
  Settings,
  AlertTriangle,
  X,
  Check,
  Loader2,
} from "lucide-react";
import KernelSelector from "./blocks/KernelSelector";
import MachineSelector from "./blocks/MachineSelector";

interface BenchmarkConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: BenchmarkRuntimeConfig) => void;
  pullRequest: RepoPullRequest;
}

export default function BenchmarkConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  pullRequest,
}: BenchmarkConfirmationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingKernels, setIsLoadingKernels] = useState(false);
  const [kernels, setKernels] = useState<KernelConfig[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [config, setConfig] = useState<BenchmarkRuntimeConfig>({
    machine: "mi325",
    kernelSelection: {
      type: "all-quick",
    },
  });

  // Load kernels data when modal opens
  useEffect(() => {
    if (isOpen && kernels.length === 0) {
      loadKernels();
    }
  }, [isOpen]);

  const loadKernels = async () => {
    setIsLoadingKernels(true);
    try {
      const kernelConfigs = await fetchKernels();
      setKernels(kernelConfigs);

      // Extract unique tags
      const tags = [...new Set(kernelConfigs.map((k) => k.tag))]
        .filter(Boolean)
        .sort();
      setAvailableTags(tags);
    } catch (error) {
      console.error("Failed to load kernels:", error);
    } finally {
      setIsLoadingKernels(false);
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(config);
      onClose();
      // Reset config on successful submission
      setConfig({
        machine: "mi325",
        kernelSelection: {
          type: "all-quick",
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      // Reset config on cancel
      setConfig({
        machine: "mi325",
        kernelSelection: {
          type: "all-quick",
        },
      });
      onClose();
    }
  };

  const handleKernelSelectionChange = (selection: KernelSelection) => {
    setConfig((prev) => ({
      ...prev,
      kernelSelection: selection,
    }));
  };

  // Calculate kernel counts
  const quickKernelCount = kernels.filter((k) => k.workflow === "all").length;
  const selectedTagsKernelCount =
    config.kernelSelection.type === "specific-tags" &&
    config.kernelSelection.tags
      ? kernels.filter((k) => config.kernelSelection.tags!.includes(k.tag))
          .length
      : 0;

  const totalSelectedKernels =
    config.kernelSelection.type === "all-quick"
      ? quickKernelCount
      : selectedTagsKernelCount;

  const isFormValid = totalSelectedKernels > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Configure Benchmark Run
            </h2>
            <p className="text-sm text-gray-600">
              Set up benchmark parameters for PR: {pullRequest.title}
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          {isLoadingKernels && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">
                Loading kernel configurations...
              </span>
            </div>
          )}

          {!isLoadingKernels && (
            <>
              {/* Machine Selection */}
              <MachineSelector
                machine={config.machine}
                onChange={(machine) =>
                  setConfig((prev) => ({ ...prev, machine }))
                }
                disabled={isSubmitting}
              />

              {/* Kernel Selection */}
              <KernelSelector
                selection={config.kernelSelection}
                onChange={handleKernelSelectionChange}
                kernels={kernels}
                availableTags={availableTags}
                disabled={isSubmitting}
              />

              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full">
                    <AlertTriangle className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h5 className="font-medium text-blue-900 mb-1">
                      Benchmark Summary
                    </h5>
                    <p className="text-sm text-blue-800">
                      {totalSelectedKernels} kernels will be benchmarked on{" "}
                      {config.machine}
                      {totalSelectedKernels > 0 && (
                        <span className="ml-1">
                          using{" "}
                          {config.kernelSelection.type === "all-quick"
                            ? "all quick kernels"
                            : "selected tags"}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <button
          onClick={handleClose}
          disabled={isSubmitting}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={isSubmitting || !isFormValid || isLoadingKernels}
          className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 font-medium"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Starting Benchmark...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Run Benchmark ({totalSelectedKernels} kernels)
            </>
          )}
        </button>
      </ModalFooter>
    </Modal>
  );
}
