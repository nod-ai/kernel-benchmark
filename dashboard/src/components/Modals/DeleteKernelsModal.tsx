import { FaExclamationTriangle } from "react-icons/fa";
import Modal from "../Modal/Modal";
import { ModalHeader, ModalBody, ModalFooter } from "../Modal/ModalComponents";

interface DeleteKernelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  kernelCount: number;
  isLoading?: boolean;
}

export default function DeleteKernelsModal({
  isOpen,
  onClose,
  onConfirm,
  kernelCount,
  isLoading = false,
}: DeleteKernelsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-full">
            <FaExclamationTriangle className="text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Delete Kernel{kernelCount !== 1 ? "s" : ""}
          </h2>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete{" "}
            <strong>
              {kernelCount} kernel{kernelCount !== 1 ? "s" : ""}
            </strong>
            ?
          </p>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-800 mb-2">This action will:</h4>
            <ul className="text-sm text-red-700 space-y-1">
              <li>
                • Permanently remove {kernelCount !== 1 ? "these" : "this"}{" "}
                kernel{kernelCount !== 1 ? "s" : ""} from the database
              </li>
              <li>• Remove all associated configuration data</li>
              <li>
                • Remove any existing tuning results for{" "}
                {kernelCount !== 1 ? "these" : "this"} kernel
                {kernelCount !== 1 ? "s" : ""}
              </li>
            </ul>
          </div>

          <p className="text-sm text-gray-500">
            This action cannot be undone. Please make sure you want to proceed.
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Deleting...
            </>
          ) : (
            <>Delete Kernel{kernelCount !== 1 ? "s" : ""}</>
          )}
        </button>
      </ModalFooter>
    </Modal>
  );
}
