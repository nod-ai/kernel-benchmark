import { useState, useEffect } from "react";
import Modal from "../Modal/Modal";
import { ModalHeader, ModalBody, ModalFooter } from "../Modal/ModalComponents";
import { fetchKernels } from "../../utils/github";
import {
  type KernelConfig,
  type KernelSelection,
} from "../../types";
import {
  Settings,
  Type,
  AlertTriangle,
  X,
  Check,
  Loader2,
} from "lucide-react";
import KernelSelector from "./blocks/KernelSelector";
import MachineSelector from "./blocks/MachineSelector";
import BackendSelector from "./blocks/BackendSelector";

export interface ManualBenchmarkConfig {
  name: string;
  machine: string;
  backends: string[];
  kernelSelection: KernelSelection;
}

interface ManualBenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: ManualBenchmarkConfig) => void;
}

export default function ManualBenchmarkModal({
  isOpen,
  onClose,
  onConfirm,
}: ManualBenchmarkModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingKernels, setIsLoadingKernels] = useState(false);
  const [kernels, setKernels] = useState<KernelConfig[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [machine, setMachine] = useState("mi325");
  const [selectedBackends, setSelectedBackends] = useState<string[]>([]);
  const [kernelSelection, setKernelSelection] = useState<KernelSelection>({
    type: "all-quick",
  });

  // Load kernels data when modal opens
  useEffect(() => {
    if (isOpen && kernels.length === 0) {
      loadKernels();
    }
  }, [isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setMachine("mi325");
      setSelectedBackends([]);
      setKernelSelection({ type: "all-quick" });
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
      const config: ManualBenchmarkConfig = {
        name: name.trim(),
        machine,
        backends: selectedBackends,
        kernelSelection,
      };
      await onConfirm(config);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  // Calculate kernel counts
  const quickKernelCount = kernels.filter((k) => k.workflow === "all").length;
  const selectedTagsKernelCount =
    kernelSelection.type === "specific-tags" && kernelSelection.tags
      ? kernels.filter((k) => kernelSelection.tags!.includes(k.tag)).length
      : 0;

  const totalSelectedKernels =
    kernelSelection.type === "all-quick"
      ? quickKernelCount
      : selectedTagsKernelCount;

  const isFormValid =
    name.trim() !== "" &&
    selectedBackends.length > 0 &&
    totalSelectedKernels > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Run Manual Benchmark
            </h2>
            <p className="text-sm text-gray-600">
              Configure and trigger a new benchmark run
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
              {/* Run Name */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
                    <Type className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Run Name *</h4>
                    <p className="text-sm text-gray-600">
                      Give your benchmark run a descriptive name
                    </p>
                  </div>
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Manual Benchmark - Jan 2026"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Machine Selection */}
              <MachineSelector
                machine={machine}
                onChange={setMachine}
                disabled={isSubmitting}
              />

              {/* Backend Selection */}
              <BackendSelector
                selectedBackends={selectedBackends}
                onChange={setSelectedBackends}
                disabled={isSubmitting}
              />

              {/* Kernel Selection */}
              <KernelSelector
                selection={kernelSelection}
                onChange={setKernelSelection}
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
                      {machine}
                      {selectedBackends.length > 0 && (
                        <span className="ml-1">
                          using {selectedBackends.join(", ")}
                          {selectedBackends.length > 1 && " backends"}
                          {selectedBackends.length === 1 && " backend"}
                        </span>
                      )}
                      {totalSelectedKernels > 0 && (
                        <span className="ml-1">
                          (
                          {kernelSelection.type === "all-quick"
                            ? "all quick kernels"
                            : "selected tags"}
                          )
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
