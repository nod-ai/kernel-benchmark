import { useState, useEffect } from "react";
import { Pencil, X, Loader2 } from "lucide-react";
import Modal from "../Modal/Modal";
import { ModalHeader, ModalBody, ModalFooter } from "../Modal/ModalComponents";

interface RenameTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (oldTag: string, newTag: string) => Promise<void>;
  tag: string;
  kernelCount: number;
}

export default function RenameTagModal({
  isOpen,
  onClose,
  onConfirm,
  tag,
  kernelCount,
}: RenameTagModalProps) {
  const [newTag, setNewTag] = useState(tag);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) setNewTag(tag);
  }, [isOpen, tag]);

  const handleConfirm = async () => {
    const trimmed = newTag.trim();
    if (!trimmed || trimmed === tag) return;
    setIsSubmitting(true);
    try {
      await onConfirm(tag, trimmed);
      onClose();
    } catch (error) {
      console.error("Failed to rename tag:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = newTag.trim().length > 0 && newTag.trim() !== tag;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
            <Pencil className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Rename Tag</h2>
            <p className="text-sm text-gray-600">
              Rename "{tag}" across {kernelCount} kernel{kernelCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              New Tag Name
            </label>
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Enter new tag name..."
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              onKeyDown={(e) => e.key === "Enter" && isValid && handleConfirm()}
              autoFocus
            />
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors font-medium text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={isSubmitting || !isValid}
          className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 font-medium text-sm"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Renaming...
            </>
          ) : (
            <>
              <Pencil className="w-4 h-4" />
              Rename
            </>
          )}
        </button>
      </ModalFooter>
    </Modal>
  );
}
