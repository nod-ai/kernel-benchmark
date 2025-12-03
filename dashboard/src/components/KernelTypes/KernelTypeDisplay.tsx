import { useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings,
  Info,
} from "lucide-react";
import type { KernelTypeDefinition } from "../../types";

interface KernelTypeDisplayProps {
  kernelTypes: KernelTypeDefinition[];
  selectedKernelType: KernelTypeDefinition | null;
  onSelectKernelType: (kernelType: KernelTypeDefinition) => void;
  onCreateNewType: () => void;
  onEditKernelType?: (kernelType: KernelTypeDefinition) => void;
  onDeleteKernelType?: (kernelType: KernelTypeDefinition) => void;
}

export default function KernelTypeDisplay({
  kernelTypes,
  selectedKernelType,
  onSelectKernelType,
  onCreateNewType,
  onEditKernelType,
  onDeleteKernelType,
}: KernelTypeDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Kernel Types</h2>
          <p className="text-gray-600 mt-1">
            Select a kernel type to configure and add kernels
          </p>
        </div>
        <button
          onClick={onCreateNewType}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors duration-200"
        >
          <Plus className="w-4 h-4" />
          <span>New Type</span>
        </button>
      </div>

      {/* Kernel Type Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {kernelTypes.map((kernelType) => (
          <div
            key={kernelType._id}
            className={`relative group cursor-pointer rounded-lg border-2 transition-all duration-200 ${
              selectedKernelType?._id === kernelType._id
                ? "border-blue-500 bg-blue-50 shadow-md"
                : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
            }`}
            onClick={() => onSelectKernelType(kernelType)}
          >
            <div className="p-3">
              {/* Simplified Layout - Icon and Name */}
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg flex-shrink-0 ${
                    selectedKernelType?._id === kernelType._id
                      ? "bg-blue-100"
                      : "bg-gray-100 group-hover:bg-gray-200"
                  }`}
                >
                  <Settings
                    className={`w-4 h-4 ${
                      selectedKernelType?._id === kernelType._id
                        ? "text-blue-600"
                        : "text-gray-600"
                    }`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate text-sm">
                    {kernelType.displayName}
                  </h3>
                </div>

                {/* Selection Indicator */}
                {selectedKernelType?._id === kernelType._id && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0 group-hover:hidden" />
                )}
              </div>

              {/* Action Buttons */}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {onEditKernelType && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditKernelType(kernelType);
                    }}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                    title="Edit kernel type"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDeleteKernelType && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteKernelType(kernelType);
                    }}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                    title="Delete kernel type"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Kernel Type Details */}
      {selectedKernelType && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Details Header */}
          <div className="border-b border-gray-200 bg-gray-50">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Settings className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg text-gray-900">
                    {selectedKernelType.displayName}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {selectedKernelType.attributes.length} attributes configured
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {showDetails ? "Hide" : "Show"} Details
                </span>
                {showDetails ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>
          </div>

          {/* Collapsible Details Content */}
          {showDetails && (
            <div className="p-6 space-y-6">
              {/* Description */}
              {selectedKernelType.description && (
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">
                      Description
                    </h4>
                    <p className="text-gray-600 leading-relaxed">
                      {selectedKernelType.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Attributes */}
              <div>
                <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-gray-600" />
                  Attributes ({selectedKernelType.attributes.length})
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {selectedKernelType.attributes.map((attr) => (
                    <div
                      key={attr.name}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                    >
                      {/* Attribute Header */}
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-gray-900">
                          {attr.name}
                        </h5>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            attr.required
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {attr.required ? "Required" : "Optional"}
                        </span>
                      </div>

                      {/* Attribute Details */}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-700">
                            Type:
                          </span>
                          <span className="px-2 py-1 bg-white rounded border text-gray-900 font-mono text-xs">
                            {attr.type}
                          </span>
                        </div>

                        {/* Constraints */}
                        {(attr.constraints?.min !== undefined ||
                          attr.constraints?.max !== undefined) && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-700">
                              Range:
                            </span>
                            <span className="text-gray-600">
                              {attr.constraints.min} - {attr.constraints.max}
                            </span>
                          </div>
                        )}

                        {attr.constraints?.choices && (
                          <div>
                            <span className="font-medium text-gray-700">
                              Choices:
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {attr.constraints.choices.map((choice, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-white rounded border text-gray-700 text-xs"
                                >
                                  {choice}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Description */}
                        {attr.description && (
                          <div>
                            <span className="font-medium text-gray-700">
                              Description:
                            </span>
                            <p className="text-gray-600 mt-1 leading-relaxed">
                              {attr.description}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
