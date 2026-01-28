import { useState, useEffect } from "react";
import {
  Check,
  X,
  Loader2,
  CalendarDays,
  Type,
  Link as LinkIcon,
} from "lucide-react";
import Modal from "../Modal/Modal";
import { ModalHeader, ModalBody, ModalFooter } from "../Modal/ModalComponents";
import { type KernelConfig, type KernelSelection } from "../../types";
import { fetchKernels } from "../../utils/github";
import KernelSelector from "./blocks/KernelSelector";
import ScheduleSelector, { type Schedule } from "./blocks/ScheduleSelector";
import MachineSelector from "./blocks/MachineSelector";
import BackendSelector from "./blocks/BackendSelector";
import BranchSelector from "./blocks/BranchSelector";
import { simplifyNameForUrl, toMMDDYYYY, toYYYYMMDD } from "../../utils/utils";

export interface TrackerConfig {
  name: string;
  blobName: string;
  dashboardName?: string;
  kernelSelection: KernelSelection;
  backends: string[]; // Array of backends
  machine: string;
  schedule: Schedule;
  branch: string;
}

interface AddTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: TrackerConfig) => void;
  editingTracker?: TrackerConfig & { _id?: string };
}

export default function AddTrackerModal({
  isOpen,
  onClose,
  onConfirm,
  editingTracker,
}: AddTrackerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingKernels, setIsLoadingKernels] = useState(false);
  const [kernels, setKernels] = useState<KernelConfig[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [machine, setMachine] = useState("mi325");
  const [kernelSelection, setKernelSelection] = useState<KernelSelection>({
    type: "specific-tags",
    tags: [],
  });
  const [selectedBackends, setSelectedBackends] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({
    isInterval: false,
    startDate: "",
    timeOfDay: "09:00",
    daysOfWeek: [],
  });
  const [branch, setBranch] = useState("main");

  const isEditing = !!editingTracker;
  const simplifiedName = simplifyNameForUrl(name);
  const dashboardUrl = import.meta.env.VITE_DASHBOARD_URL || window.location.origin;
  const previewUrl = simplifiedName
    ? `${dashboardUrl}/dashboard/tracker/${simplifiedName}`
    : "";

  // Load kernels data when modal opens
  useEffect(() => {
    if (isOpen && kernels.length === 0) {
      loadKernels();
    }
  }, [isOpen]);

  // Populate form when editing
  useEffect(() => {
    if (isOpen && editingTracker) {
      setName(editingTracker.name);
      setMachine(editingTracker.machine);
      setKernelSelection(editingTracker.kernelSelection);
      setSelectedBackends(editingTracker.backends);
      setBranch(editingTracker.branch || "main");
      // Convert dates from MM-DD-YYYY to YYYY-MM-DD for HTML inputs
      const scheduleForForm: Schedule = {
        ...editingTracker.schedule,
        startDate: toYYYYMMDD(editingTracker.schedule.startDate),
        endDate: editingTracker.schedule.endDate
          ? toYYYYMMDD(editingTracker.schedule.endDate)
          : undefined,
      };
      setSchedule(scheduleForForm);
    } else if (isOpen && !editingTracker) {
      resetForm();
    }
  }, [isOpen, editingTracker]);

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

  const resetForm = () => {
    setName("");
    setMachine("mi325");
    setKernelSelection({
      type: "specific-tags",
      tags: [],
    });
    setSelectedBackends([]);
    setSchedule({
      isInterval: false,
      startDate: "",
      timeOfDay: "09:00",
      daysOfWeek: [],
    });
    setBranch("main");
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      // Convert dates to MM-DD-YYYY format for backend
      const scheduleForBackend: Schedule = {
        ...schedule,
        startDate: toMMDDYYYY(schedule.startDate),
        endDate: schedule.endDate ? toMMDDYYYY(schedule.endDate) : undefined,
      };

      const config: TrackerConfig = {
        name: name.trim(),
        blobName: simplifiedName,
        dashboardName: simplifiedName,
        kernelSelection,
        backends: selectedBackends,
        machine,
        schedule: scheduleForBackend,
        branch,
      };

      await onConfirm(config);
      resetForm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  const isFormValid = () => {
    if (!name.trim()) return false;
    if (!machine) return false;
    if (!kernelSelection.tags || kernelSelection.tags.length === 0) return false;
    if (selectedBackends.length === 0) return false;
    if (!schedule.startDate) return false;
    if (!schedule.timeOfDay) return false;

    // Validate schedule based on type
    if (!schedule.isInterval) {
      // Weekly schedule
      if (!schedule.daysOfWeek || schedule.daysOfWeek.length === 0) return false;
    } else {
      // Interval schedule
      if (!schedule.intervalValue || schedule.intervalValue < 1) return false;
      if (!schedule.intervalUnit) return false;
    }

    return true;
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
            <CalendarDays className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? "Edit Tracker" : "Add New Tracker"}
            </h2>
            <p className="text-sm text-gray-600">
              {isEditing
                ? "Update tracker configuration"
                : "Track kernels across backends on a schedule"}
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
              {/* Tracker Name */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
                    <Type className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      Tracker Name *
                    </h4>
                    <p className="text-sm text-gray-600">
                      Give your tracker a descriptive name
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., MI350 Kernel Comparison"
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {previewUrl && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <LinkIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-500 mb-1">
                            DASHBOARD URL
                          </p>
                          <p className="text-sm text-gray-900 font-mono break-all">
                            {previewUrl}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Backend Selection */}
              <BackendSelector
                selectedBackends={selectedBackends}
                onChange={setSelectedBackends}
                disabled={isSubmitting}
              />

              {/* Machine Selection */}
              <MachineSelector
                machine={machine}
                onChange={setMachine}
                disabled={isSubmitting}
              />

              {/* Branch Selection */}
              <BranchSelector
                branch={branch}
                onChange={setBranch}
                disabled={isSubmitting}
              />

              {/* Kernel Tags Selection */}
              <KernelSelector
                selection={kernelSelection}
                onChange={setKernelSelection}
                kernels={kernels}
                availableTags={availableTags}
                disabled={isSubmitting}
                tagsOnly={true}
              />

              {/* Schedule Configuration */}
              <ScheduleSelector
                schedule={schedule}
                onChange={setSchedule}
                disabled={isSubmitting}
              />
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
          disabled={isSubmitting || !isFormValid() || isLoadingKernels}
          className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 font-medium"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating Tracker...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              {isEditing ? "Update Tracker" : "Create Tracker"}
            </>
          )}
        </button>
      </ModalFooter>
    </Modal>
  );
}
