import { useState } from "react";
import {
  Check,
  AlertTriangle,
  X,
  Loader2,
  Settings,
  Monitor,
  Cpu,
  Clock,
  Target,
} from "lucide-react";
import Modal from "../Modal/Modal";
import { ModalHeader, ModalBody, ModalFooter } from "../Modal/ModalComponents";
import { AVAILABLE_MACHINES } from "../../types";

interface TuningPhaseConfig {
  blockSizesMfma: {
    enabled: boolean;
    paradigm: "grid-search" | "bayesian";
    trials: number;
  };
  schedulingHyperparameters: {
    enabled: boolean;
  };
  scheduleFinetuning: {
    enabled: boolean;
    maxTimeout?: number;
  };
}

export interface TuningRuntimeConfig {
  machine: string;
  phases: TuningPhaseConfig;
}

interface TuningConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: TuningRuntimeConfig) => void;
  selectedKernelCount: number;
}

const PARADIGM_DESCRIPTIONS = {
  "grid-search":
    "Uses constraints to define a valid search space and benchmarks candidates evenly spread across the search space. Iteratively converges on a narrower, more optimal solution.",
  bayesian:
    "Uses a statistical bayesian approach to estimate and converge on the best solution. Does not work with constraints.",
};

export default function TuningConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  selectedKernelCount,
}: TuningConfirmationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [config, setConfig] = useState<TuningRuntimeConfig>({
    machine: "mi325",
    phases: {
      blockSizesMfma: {
        enabled: true,
        paradigm: "grid-search",
        trials: 100,
      },
      schedulingHyperparameters: {
        enabled: false,
      },
      scheduleFinetuning: {
        enabled: false,
        maxTimeout: undefined,
      },
    },
  });

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(config);
      onClose();
      // Reset config on successful submission
      setConfig({
        machine: "mi325",
        phases: {
          blockSizesMfma: {
            enabled: true,
            paradigm: "grid-search",
            trials: 100,
          },
          schedulingHyperparameters: {
            enabled: false,
          },
          scheduleFinetuning: {
            enabled: false,
            maxTimeout: undefined,
          },
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
        phases: {
          blockSizesMfma: {
            enabled: true,
            paradigm: "grid-search",
            trials: 100,
          },
          schedulingHyperparameters: {
            enabled: false,
          },
          scheduleFinetuning: {
            enabled: false,
            maxTimeout: undefined,
          },
        },
      });
      onClose();
    }
  };

  const updatePhase = <K extends keyof TuningPhaseConfig>(
    phase: K,
    updates: Partial<TuningPhaseConfig[K]>
  ) => {
    setConfig((prev) => ({
      ...prev,
      phases: {
        ...prev.phases,
        [phase]: {
          ...prev.phases[phase],
          ...updates,
        },
      },
    }));
  };

  // Auto-enable scheduling hyperparameters if schedule finetuning is enabled
  const handleScheduleFinetuningToggle = (enabled: boolean) => {
    updatePhase("scheduleFinetuning", { enabled });
    if (enabled && !config.phases.schedulingHyperparameters.enabled) {
      updatePhase("schedulingHyperparameters", { enabled: true });
    }
  };

  const isFormValid = true; // Always valid since machine has default and Block Sizes & MFMA is always enabled

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Configure Kernel Tuning
            </h2>
            <p className="text-sm text-gray-600">
              Set up tuning parameters for {selectedKernelCount} kernel
              {selectedKernelCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
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
                  Hardware platform for tuning execution
                </p>
              </div>
            </div>
            <div className="flex flex-row gap-3">
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
                  <span className="text-sm font-medium text-gray-900">
                    {machine}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Tuning Phases */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-lg">
                <Target className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Tuning Phases *</h4>
                <p className="text-sm text-gray-600">
                  Sequential optimization phases
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Phase 1: Block Sizes & MFMA */}
              <div className="border border-gray-200 rounded-lg p-4 bg-green-50">
                <div className="flex items-start gap-3 mb-3">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled={true}
                    className="mt-0.5 border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-gray-900">
                        Block Sizes & MFMA
                      </span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                        Required
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Tunes block sizes and MFMA variants for vector loads and
                      matmul operations.
                    </p>
                  </div>
                </div>

                <div className="ml-6 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Paradigm *
                    </label>
                    <div className="space-y-2">
                      {(["grid-search", "bayesian"] as const).map(
                        (paradigm) => (
                          <label
                            key={paradigm}
                            className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <input
                              type="radio"
                              name="paradigm"
                              value={paradigm}
                              checked={
                                config.phases.blockSizesMfma.paradigm ===
                                paradigm
                              }
                              onChange={(e) =>
                                updatePhase("blockSizesMfma", {
                                  paradigm: e.target.value as
                                    | "grid-search"
                                    | "bayesian",
                                })
                              }
                              disabled={isSubmitting}
                              className="mt-0.5 border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-900 capitalize">
                                {paradigm.replace("-", " ")}
                              </span>
                              <p className="text-xs text-gray-600 mt-1">
                                {PARADIGM_DESCRIPTIONS[paradigm]}
                              </p>
                            </div>
                          </label>
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of trials *
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="500"
                      value={config.phases.blockSizesMfma.trials}
                      onChange={(e) =>
                        updatePhase("blockSizesMfma", {
                          trials: parseInt(e.target.value) || 100,
                        })
                      }
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      Restricts the tuning workflow to converge on a solution
                      within this many benchmarks (10-500).
                    </p>
                  </div>
                </div>
              </div>

              {/* Phase 2: Scheduling Hyperparameters */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <input
                    type="checkbox"
                    checked={config.phases.schedulingHyperparameters.enabled}
                    onChange={(e) =>
                      updatePhase("schedulingHyperparameters", {
                        enabled: e.target.checked,
                      })
                    }
                    disabled={isSubmitting}
                    className="mt-0.5 border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-purple-600" />
                      <span className="font-medium text-gray-900">
                        Scheduling Hyperparameters
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                        Optional
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Tunes scheduling hyperparameters to further optimize
                      kernels. Will be executed after an optimal set of block
                      sizes and MFMA variants are identified.
                    </p>
                  </div>
                </div>
              </div>

              {/* Phase 3: Schedule Finetuning */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <input
                    type="checkbox"
                    checked={config.phases.scheduleFinetuning.enabled}
                    onChange={(e) =>
                      handleScheduleFinetuningToggle(e.target.checked)
                    }
                    disabled={isSubmitting}
                    className="mt-0.5 border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-600" />
                      <span className="font-medium text-gray-900">
                        Schedule Finetuning
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                        Optional
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Uses a hill-climbing approach to further optimize
                      scheduling at a lower level by selectively adding delays
                      to operations. Will be executed after an optimal set of
                      block sizes, MFMA variants, and scheduling hyperparameters
                      are identified.
                    </p>
                  </div>
                </div>

                {config.phases.scheduleFinetuning.enabled && (
                  <div className="ml-6 mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max timeout (seconds)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={config.phases.scheduleFinetuning.maxTimeout || ""}
                      onChange={(e) =>
                        updatePhase("scheduleFinetuning", {
                          maxTimeout: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        })
                      }
                      disabled={isSubmitting}
                      placeholder="No timeout"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      Maximum number of seconds any given kernel can spend on
                      this step. If timeout is reached, finetuning will be
                      interrupted and the default schedule will be selected.
                    </p>
                  </div>
                )}
              </div>

              {config.phases.scheduleFinetuning.enabled &&
                !config.phases.schedulingHyperparameters.enabled && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                      <p className="text-sm text-yellow-800">
                        Schedule Finetuning requires Scheduling Hyperparameters
                        to be enabled as they are sequentially dependent.
                      </p>
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Important Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full">
                <AlertTriangle className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-blue-900">Tuning Process</h4>
                <p className="text-sm text-blue-800 mt-1">
                  The tuning process will execute phases sequentially. Depending
                  on the selected phases and number of trials, this process may
                  take several hours to complete.
                </p>
              </div>
            </div>
          </div>
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
          disabled={isSubmitting || !isFormValid}
          className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 font-medium"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Starting Tuning...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Start Tuning {selectedKernelCount} Kernel
              {selectedKernelCount !== 1 ? "s" : ""}
            </>
          )}
        </button>
      </ModalFooter>
    </Modal>
  );
}
