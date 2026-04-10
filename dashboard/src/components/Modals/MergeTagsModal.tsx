import { useState, useEffect } from "react";
import { Merge, Loader2 } from "lucide-react";
import Modal from "../Modal/Modal";
import { ModalHeader, ModalBody, ModalFooter } from "../Modal/ModalComponents";

interface MergeTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sourceTag: string, targetTag: string) => Promise<void>;
  sourceTag: string;
  kernelCount: number;
  allTags: string[];
}

export default function MergeTagsModal({
  isOpen,
  onClose,
  onConfirm,
  sourceTag,
  kernelCount,
  allTags,
}: MergeTagsModalProps) {
  const [targetTag, setTargetTag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otherTags = allTags.filter((t) => t !== sourceTag);

  useEffect(() => {
    if (isOpen) setTargetTag(otherTags[0] ?? "");
  }, [isOpen, sourceTag]);

  const handleConfirm = async () => {
    if (!targetTag) return;
    setIsSubmitting(true);
    try {
      await onConfirm(sourceTag, targetTag);
      onClose();
    } catch (error) {
      console.error("Failed to merge tags:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-lg">
            <Merge className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Merge Tag</h2>
            <p className="text-sm text-gray-600">
              Move {kernelCount} kernel{kernelCount !== 1 ? "s" : ""} from "{sourceTag}" into another tag
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">From</div>
            <div className="text-sm font-medium text-gray-800">{sourceTag}</div>
          </div>

          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <Merge className="w-4 h-4 text-purple-600" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Into</label>
            {otherTags.length > 0 ? (
              <select
                value={targetTag}
                onChange={(e) => setTargetTag(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              >
                {otherTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No other tags available to merge into.
              </p>
            )}
          </div>

          {targetTag && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800">
              All {kernelCount} kernel{kernelCount !== 1 ? "s" : ""} tagged "{sourceTag}" will be
              re-tagged to "{targetTag}". The "{sourceTag}" group will disappear.
            </div>
          )}
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
          disabled={isSubmitting || !targetTag || otherTags.length === 0}
          className="px-4 py-2 text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 font-medium text-sm"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Merging...
            </>
          ) : (
            <>
              <Merge className="w-4 h-4" />
              Merge
            </>
          )}
        </button>
      </ModalFooter>
    </Modal>
  );
}
