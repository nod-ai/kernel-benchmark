import { useState, useEffect } from "react";
import Modal from "../Modal/Modal";
import { ModalHeader, ModalBody, ModalFooter } from "../Modal/ModalComponents";
import { fetchKernels } from "../../utils/github";
import {
  AVAILABLE_MACHINES,
  type BenchmarkRuntimeConfig,
  type KernelConfig,
  type RepoPullRequest,
} from "../../types";
import {
  Settings,
  Monitor,
  Target,
  AlertTriangle,
  X,
  Check,
  Loader2,
  Database,
  Tag,
  Filter,
} from "lucide-react";

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

  const handleTagToggle = (tag: string) => {
    setConfig((prev) => ({
      ...prev,
      kernelSelection: {
        ...prev.kernelSelection,
        tags: prev.kernelSelection.tags?.includes(tag)
          ? prev.kernelSelection.tags.filter((t) => t !== tag)
          : [...(prev.kernelSelection.tags || []), tag],
      },
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
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg">
                    <Monitor className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      Target Machine *
                    </h4>
                    <p className="text-sm text-gray-600">
                      Hardware platform for benchmark execution
                    </p>
                  </div>
                </div>
                <div className="flex flex-row gap-3 w-full">
                  {AVAILABLE_MACHINES.map((machine) => (
                    <label
                      key={machine}
                      className="flex grow items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="machine"
                        value={machine}
                        checked={config.machine === machine}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            machine: e.target.value,
                          }))
                        }
                        disabled={isSubmitting}
                        className="border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="font-medium text-gray-900">
                        {machine}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Kernel Selection */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-lg">
                    <Target className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      Kernel Selection *
                    </h4>
                    <p className="text-sm text-gray-600">
                      Choose which kernels to benchmark
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Option 1: All Quick Kernels */}
                  <div
                    className={`border border-gray-200 rounded-lg p-4 ${
                      config.kernelSelection.type === "all-quick"
                        ? "bg-blue-50 border-blue-200"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <input
                        type="radio"
                        name="kernelSelection"
                        checked={config.kernelSelection.type === "all-quick"}
                        onChange={() =>
                          setConfig((prev) => ({
                            ...prev,
                            kernelSelection: { type: "all-quick" },
                          }))
                        }
                        disabled={isSubmitting}
                        className="mt-0.5 border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Database className="w-4 h-4 text-blue-600" />
                          <h5 className="font-medium text-gray-900">
                            Use all quick benchmark kernels
                          </h5>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                            {quickKernelCount} kernels
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Benchmark all kernels configured for quick workflow
                          execution
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Specific Tags */}
                  <div
                    className={`border border-gray-200 rounded-lg p-4 ${
                      config.kernelSelection.type === "specific-tags"
                        ? "bg-purple-50 border-purple-200"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <input
                        type="radio"
                        name="kernelSelection"
                        checked={
                          config.kernelSelection.type === "specific-tags"
                        }
                        onChange={() =>
                          setConfig((prev) => ({
                            ...prev,
                            kernelSelection: {
                              type: "specific-tags",
                              tags: [],
                            },
                          }))
                        }
                        disabled={isSubmitting}
                        className="mt-0.5 border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Filter className="w-4 h-4 text-purple-600" />
                          <h5 className="font-medium text-gray-900">
                            Only benchmark specific tags
                          </h5>
                          {config.kernelSelection.type === "specific-tags" && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                              {selectedTagsKernelCount} kernels
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          Select specific kernel tags to benchmark
                        </p>

                        {config.kernelSelection.type === "specific-tags" && (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              {availableTags.map((tag) => {
                                const isSelected =
                                  config.kernelSelection.tags?.includes(tag) ||
                                  false;
                                const tagKernelCount = kernels.filter(
                                  (k) => k.tag === tag
                                ).length;

                                return (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => handleTagToggle(tag)}
                                    disabled={isSubmitting}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                                      isSelected
                                        ? "bg-purple-600 text-white border-purple-700"
                                        : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                                    }`}
                                  >
                                    <Tag className="w-3 h-3" />
                                    <span className="font-medium">{tag}</span>
                                    <span
                                      className={`text-xs px-1.5 py-0.5 rounded ${
                                        isSelected
                                          ? "bg-purple-700 text-purple-100"
                                          : "bg-gray-200 text-gray-600"
                                      }`}
                                    >
                                      {tagKernelCount}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {config.kernelSelection.tags?.length === 0 && (
                              <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4" />
                                  <span>
                                    Please select at least one tag to continue
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

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
