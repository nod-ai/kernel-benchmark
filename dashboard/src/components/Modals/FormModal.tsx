// components/Modals/FormModal.tsx
import React, { useState } from "react";
import Modal from "../Modal/Modal";
import { ModalHeader, ModalBody, ModalFooter } from "../Modal/ModalComponents";
import type { BenchmarkWorkflowProps } from "../../types";

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BenchmarkWorkflowProps) => void;
}

const BACKEND_OPTIONS = ["wave", "iree", "torch"];

const defaultWorkflow = {
  githubUrl: "https://github.com/iree-org/wave/tree/main",
  repoName: "iree-org/wave",
  branchName: "main",
  selectedBackends: ["wave", "iree", "torch"],
};

function parseGithubUrl(url: string) {
  try {
    const match = url.match(
      /^https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/?#]+))?/
    );
    if (match) {
      const repoName = `${match[1]}/${match[2]}`;
      const branchName = match[3] || "main";
      return { repoName, branchName };
    }
  } catch {}
  return { repoName: "", branchName: "" };
}

const FormModal: React.FC<FormModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] =
    useState<BenchmarkWorkflowProps>(defaultWorkflow);

  // Update repoName and branchName when githubUrl changes
  const handleGithubUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const githubUrl = e.target.value;
    const { repoName, branchName } = parseGithubUrl(githubUrl);
    setFormData((prev) => ({
      ...prev,
      githubUrl,
      repoName,
      branchName,
    }));
  };

  const handleBackendToggle = (backend: string) => {
    setFormData((prev) => {
      const selected = prev.selectedBackends.includes(backend)
        ? prev.selectedBackends.filter((b) => b !== backend)
        : [...prev.selectedBackends, backend];
      return { ...prev, selectedBackends: selected };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
    setFormData(defaultWorkflow); // Reset form
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <form onSubmit={handleSubmit}>
        <ModalHeader>Trigger Benchmark Run</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Github URL
              </label>
              <input
                type="text"
                value={formData.githubUrl}
                onChange={handleGithubUrlChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div className="flex flex-row gap-4">
              <div>
                <label className="block text-xs text-gray-500">Repo Name</label>
                <div className="px-2 py-1 bg-gray-100 rounded">
                  {formData.repoName}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Branch</label>
                <div className="px-2 py-1 bg-gray-100 rounded">
                  {formData.branchName}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Backends
              </label>
              <div className="flex flex-row gap-2">
                {BACKEND_OPTIONS.map((backend) => (
                  <button
                    type="button"
                    key={backend}
                    onClick={() => handleBackendToggle(backend)}
                    className={`px-3 py-1 rounded-lg border transition-colors ${
                      formData.selectedBackends.includes(backend)
                        ? "bg-blue-600 text-white border-blue-700"
                        : "bg-gray-100 text-gray-700 border-gray-300"
                    }`}
                  >
                    {backend}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Submit
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default FormModal;
