import { useState } from "react";
import { Edit3, X, Loader2, Tag, Settings, AlertTriangle } from "lucide-react";
import Modal from "../Modal/Modal";
import { ModalHeader, ModalBody, ModalFooter } from "../Modal/ModalComponents";

export interface KernelBatchUpdateData {
  tag?: string;
  workflow?: "none" | "e2e" | "all";
}

interface EditKernelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (updates: KernelBatchUpdateData) => Promise<void>;
  kernelCount: number;
}

export default function EditKernelsModal({
  isOpen,
  onClose,
  onConfirm,
  kernelCount,
}: EditKernelsModalProps) {
  const [updates, setUpdates] = useState<KernelBatchUpdateData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    // Check if any updates were made
    if (!updates.tag && !updates.workflow) {
      alert("Please make at least one change before confirming.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(updates);
      onClose();
      // Reset form
      setUpdates({});
    } catch (error) {
      console.error("Failed to update kernels:", error);
      // You might want to add a toast notification here
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      // Reset form on cancel
      setUpdates({});
      onClose();
    }
  };

  const hasChanges =
    updates.tag !== undefined || updates.workflow !== undefined;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
            <Edit3 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Edit {kernelCount} Kernel{kernelCount !== 1 ? "s" : ""}
            </h2>
            <p className="text-sm text-gray-600">
              Batch update settings for selected kernels
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="space-y-6">
          {/* Tag Update Section */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg">
                <Tag className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Update Tag</h4>
                <p className="text-sm text-gray-600">
                  Set a new tag for all selected kernels
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={updates.tag !== undefined}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setUpdates((prev) => ({ ...prev, tag: "" }));
                    } else {
                      setUpdates((prev) => {
                        const { tag, ...rest } = prev;
                        return rest;
                      });
                    }
                  }}
                  disabled={isSubmitting}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-900">
                  Update tag for all selected kernels
                </span>
              </label>
              {updates.tag !== undefined && (
                <input
                  type="text"
                  value={updates.tag}
                  onChange={(e) =>
                    setUpdates((prev) => ({ ...prev, tag: e.target.value }))
                  }
                  placeholder="Enter new tag..."
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                />
              )}
            </div>
          </div>

          {/* Workflow Update Section */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-lg">
                <Settings className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">
                  Update Workflow Configuration
                </h4>
                <p className="text-sm text-gray-600">
                  Change when these kernels should be executed
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={updates.workflow !== undefined}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setUpdates((prev) => ({ ...prev, workflow: "all" }));
                    } else {
                      setUpdates((prev) => {
                        const { workflow, ...rest } = prev;
                        return rest;
                      });
                    }
                  }}
                  disabled={isSubmitting}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-900">
                  Update workflow for all selected kernels
                </span>
              </label>
              {updates.workflow !== undefined && (
                <div className="ml-6 space-y-3">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <input
                      type="radio"
                      name="workflow"
                      value="none"
                      checked={updates.workflow === "none"}
                      onChange={(e) =>
                        setUpdates((prev) => ({
                          ...prev,
                          workflow: e.target.value as "none" | "e2e" | "all",
                        }))
                      }
                      disabled={isSubmitting}
                      className="mt-0.5 border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        Never run (Disabled)
                      </span>
                      <p className="text-xs text-gray-600">
                        Kernels will be stored but not executed in any workflows
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <input
                      type="radio"
                      name="workflow"
                      value="e2e"
                      checked={updates.workflow === "e2e"}
                      onChange={(e) =>
                        setUpdates((prev) => ({
                          ...prev,
                          workflow: e.target.value as "none" | "e2e" | "all",
                        }))
                      }
                      disabled={isSubmitting}
                      className="mt-0.5 border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        End-to-end nightly only
                      </span>
                      <p className="text-xs text-gray-600">
                        Run only in comprehensive nightly workflows
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <input
                      type="radio"
                      name="workflow"
                      value="all"
                      checked={updates.workflow === "all"}
                      onChange={(e) =>
                        setUpdates((prev) => ({
                          ...prev,
                          workflow: e.target.value as "none" | "e2e" | "all",
                        }))
                      }
                      disabled={isSubmitting}
                      className="mt-0.5 border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        Both workflows
                      </span>
                      <p className="text-xs text-gray-600">
                        Run in both quick benchmarks and nightly end-to-end
                        workflows
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Summary Section */}
          {hasChanges && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full">
                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-blue-900">Changes Summary</h4>
                  <div className="text-sm text-blue-800 mt-1 space-y-1">
                    {updates.tag !== undefined && (
                      <p>
                        • Tag will be updated to: "
                        <span className="font-mono">
                          {updates.tag || "(empty)"}
                        </span>
                        "
                      </p>
                    )}
                    {updates.workflow !== undefined && (
                      <p>
                        • Workflow will be set to:{" "}
                        <span className="font-medium">
                          {updates.workflow === "none"
                            ? "Never run (Disabled)"
                            : updates.workflow === "e2e"
                              ? "End-to-end nightly only"
                              : "Both workflows"}
                        </span>
                      </p>
                    )}
                    <p className="mt-2">
                      These changes will apply to all {kernelCount} selected
                      kernel
                      {kernelCount !== 1 ? "s" : ""}.
                    </p>
                  </div>
                </div>
              </div>
            </div>
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
          disabled={isSubmitting || !hasChanges}
          className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 font-medium"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <Edit3 className="w-4 h-4" />
              Update {kernelCount} Kernel{kernelCount !== 1 ? "s" : ""}
            </>
          )}
        </button>
      </ModalFooter>
    </Modal>
  );
}
