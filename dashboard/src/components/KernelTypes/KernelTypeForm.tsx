import { useState, useEffect } from "react";
import { Plus, X, Settings, Loader2, Type, Hash } from "lucide-react";
import Modal from "../Modal/Modal";
import { ModalHeader, ModalBody, ModalFooter } from "../Modal/ModalComponents";
import type {
  KernelTypeDefinition,
  KernelTypeAttribute,
  AttributeType,
  AttributeConstraints,
} from "../../types";

interface KernelTypeFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    kernelType: KernelTypeDefinition | Omit<KernelTypeDefinition, "_id">
  ) => void;
  kernelType?: KernelTypeDefinition | null; // If provided, edit mode; if null/undefined, create mode
  isLoading?: boolean;
}

interface AttributeFormData {
  name: string;
  type: AttributeType;
  required: boolean;
  description: string;
  constraints: {
    min: string;
    max: string;
    choices: string[];
    newChoice: string;
  };
}

const createEmptyAttribute = (): AttributeFormData => ({
  name: "",
  type: "string",
  required: false,
  description: "",
  constraints: {
    min: "",
    max: "",
    choices: [],
    newChoice: "",
  },
});

const convertToFormData = (attr: KernelTypeAttribute): AttributeFormData => ({
  name: attr.name,
  type: attr.type,
  required: attr.required,
  description: attr.description || "",
  constraints: {
    min: attr.constraints?.min?.toString() || "",
    max: attr.constraints?.max?.toString() || "",
    choices: attr.constraints?.choices || [],
    newChoice: "",
  },
});

const convertFromFormData = (
  formData: AttributeFormData
): KernelTypeAttribute => {
  const constraints: AttributeConstraints = {};

  if (formData.type === "integer" || formData.type === "float") {
    if (formData.constraints.min !== "") {
      constraints.min = parseFloat(formData.constraints.min);
    }
    if (formData.constraints.max !== "") {
      constraints.max = parseFloat(formData.constraints.max);
    }
  }

  if (formData.type === "string" && formData.constraints.choices.length > 0) {
    constraints.choices = formData.constraints.choices;
  }

  return {
    name: formData.name,
    type: formData.type,
    required: formData.required,
    description: formData.description || undefined,
    constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
  };
};

export default function KernelTypeForm({
  isOpen,
  onClose,
  onSubmit,
  kernelType,
  isLoading = false,
}: KernelTypeFormProps) {
  const isEditMode = !!kernelType;

  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    description: "",
  });
  const [attributes, setAttributes] = useState<AttributeFormData[]>([
    createEmptyAttribute(),
  ]);

  // Initialize form when modal opens or kernelType changes
  useEffect(() => {
    if (isOpen) {
      if (kernelType) {
        // Edit mode - populate with existing data
        setFormData({
          name: kernelType.name,
          displayName: kernelType.displayName,
          description: kernelType.description || "",
        });
        setAttributes(kernelType.attributes.map(convertToFormData));
      } else {
        // Create mode - reset to defaults
        setFormData({ name: "", displayName: "", description: "" });
        setAttributes([createEmptyAttribute()]);
      }
    }
  }, [isOpen, kernelType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const kernelTypeData = {
      name: formData.name,
      displayName: formData.displayName,
      description: formData.description || undefined,
      attributes: attributes.map(convertFromFormData),
    };

    if (isEditMode && kernelType) {
      // Edit mode - include the ID
      onSubmit({
        ...kernelType,
        ...kernelTypeData,
      });
    } else {
      // Create mode - exclude ID
      onSubmit(kernelTypeData);
    }
  };

  const addAttribute = () => {
    setAttributes([...attributes, createEmptyAttribute()]);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const updateAttribute = (
    index: number,
    field: keyof AttributeFormData,
    value: any
  ) => {
    const updated = [...attributes];
    if (field === "constraints") {
      updated[index] = {
        ...updated[index],
        constraints: { ...updated[index].constraints, ...value },
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setAttributes(updated);
  };

  const addChoice = (attributeIndex: number) => {
    const attr = attributes[attributeIndex];
    if (attr.constraints.newChoice.trim()) {
      updateAttribute(attributeIndex, "constraints", {
        choices: [
          ...attr.constraints.choices,
          attr.constraints.newChoice.trim(),
        ],
        newChoice: "",
      });
    }
  };

  const removeChoice = (attributeIndex: number, choiceIndex: number) => {
    const attr = attributes[attributeIndex];
    updateAttribute(attributeIndex, "constraints", {
      choices: attr.constraints.choices.filter((_, i) => i !== choiceIndex),
    });
  };

  const isFormValid = () => {
    if (!formData.name.trim() || !formData.displayName.trim()) {
      return false;
    }

    if (attributes.length === 0) {
      return false;
    }

    return attributes.every((attr) => {
      if (!attr.name.trim()) return false;

      if (attr.type === "integer" || attr.type === "float") {
        if (
          attr.constraints.min !== "" &&
          isNaN(parseFloat(attr.constraints.min))
        ) {
          return false;
        }
        if (
          attr.constraints.max !== "" &&
          isNaN(parseFloat(attr.constraints.max))
        ) {
          return false;
        }
        if (
          attr.constraints.min !== "" &&
          attr.constraints.max !== "" &&
          parseFloat(attr.constraints.min) > parseFloat(attr.constraints.max)
        ) {
          return false;
        }
      }

      return true;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <form onSubmit={handleSubmit}>
        <ModalHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditMode ? "Edit Kernel Type" : "Create New Kernel Type"}
              </h2>
              <p className="text-sm text-gray-600">
                {isEditMode
                  ? "Modify kernel type configuration"
                  : "Define a new kernel type with attributes"}
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            {/* Basic Information */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg">
                  <Type className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Basic Information
                  </h3>
                  <p className="text-sm text-gray-600">
                    Core kernel type details
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Internal Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="e.g., gemm, conv, attention"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Used internally for identification
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          displayName: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="e.g., Matrix Multiplication"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Human-readable name shown in UI
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    rows={3}
                    placeholder="Optional description of this kernel type..."
                  />
                </div>
              </div>
            </div>

            {/* Attributes Section */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-lg">
                    <Hash className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Attributes</h3>
                    <p className="text-sm text-gray-600">
                      Define kernel parameters
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addAttribute}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Attribute
                </button>
              </div>

              {attributes.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Hash className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="font-medium">No attributes defined</p>
                  <p className="text-sm">
                    Add at least one attribute to continue.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {attributes.map((attr, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full">
                            <span className="text-xs font-medium text-blue-600">
                              {index + 1}
                            </span>
                          </div>
                          <h4 className="font-medium text-gray-900">
                            Attribute {index + 1}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttribute(index)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-100 p-2 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Name *
                          </label>
                          <input
                            type="text"
                            value={attr.name}
                            onChange={(e) =>
                              updateAttribute(index, "name", e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors"
                            placeholder="e.g., M, N, K"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Type *
                          </label>
                          <select
                            value={attr.type}
                            onChange={(e) =>
                              updateAttribute(
                                index,
                                "type",
                                e.target.value as AttributeType
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors"
                          >
                            <option value="integer">Integer</option>
                            <option value="float">Float</option>
                            <option value="string">String</option>
                            <option value="boolean">Boolean</option>
                          </select>
                        </div>

                        <div className="flex items-center pt-6">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={attr.required}
                              onChange={(e) =>
                                updateAttribute(
                                  index,
                                  "required",
                                  e.target.checked
                                )
                              }
                              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">
                              Required
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={attr.description}
                          onChange={(e) =>
                            updateAttribute(
                              index,
                              "description",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors"
                          placeholder="Optional description..."
                        />
                      </div>

                      {/* Type-specific constraints */}
                      {(attr.type === "integer" || attr.type === "float") && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <h5 className="text-sm font-medium text-blue-900 mb-3">
                            Value Constraints
                          </h5>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-blue-800 mb-1">
                                Min Value
                              </label>
                              <input
                                type="number"
                                step={attr.type === "float" ? "0.01" : "1"}
                                value={attr.constraints.min}
                                onChange={(e) =>
                                  updateAttribute(index, "constraints", {
                                    min: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors bg-white"
                                placeholder="Optional"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-blue-800 mb-1">
                                Max Value
                              </label>
                              <input
                                type="number"
                                step={attr.type === "float" ? "0.01" : "1"}
                                value={attr.constraints.max}
                                onChange={(e) =>
                                  updateAttribute(index, "constraints", {
                                    max: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors bg-white"
                                placeholder="Optional"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {attr.type === "string" && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <h5 className="text-sm font-medium text-green-900 mb-3">
                            Allowed Choices (Optional)
                          </h5>
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={attr.constraints.newChoice}
                                onChange={(e) =>
                                  updateAttribute(index, "constraints", {
                                    newChoice: e.target.value,
                                  })
                                }
                                className="flex-1 px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm transition-colors bg-white"
                                placeholder="Add a choice..."
                                onKeyPress={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addChoice(index);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => addChoice(index)}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            {attr.constraints.choices.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {attr.constraints.choices.map(
                                  (choice, choiceIndex) => (
                                    <span
                                      key={choiceIndex}
                                      className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-lg text-sm font-medium"
                                    >
                                      {choice}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeChoice(index, choiceIndex)
                                        }
                                        className="text-green-600 hover:text-green-800 hover:bg-green-200 rounded p-0.5 transition-colors"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isFormValid() || isLoading}
            className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isEditMode ? "Updating..." : "Creating..."}
              </>
            ) : isEditMode ? (
              "Update Kernel Type"
            ) : (
              "Create Kernel Type"
            )}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
