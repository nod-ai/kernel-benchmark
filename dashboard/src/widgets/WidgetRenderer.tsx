import { useMemo } from "react";
import type { WidgetConfig, WidgetProps, GlobalFilterConfig } from "../types/dashboard";
import { executePipeline, buildGlobalFilterRules } from "../utils/pipeline";
import widgetRegistry from "./registry";

interface WidgetRendererProps {
  config: WidgetConfig;
  rawData: Record<string, any>[];
  globalFilters: GlobalFilterConfig[];
  globalFilterValues: Record<string, any>;
  onFilterChange?: (filterId: string, value: any) => void;
  onKernelSelect?: (kernelId: string | null) => void;
  selectedKernelId?: string | null;
  isEditing?: boolean;
  profilingManifest?: Record<string, any> | null;
  blobName?: string | null;
}

export default function WidgetRenderer({
  config,
  rawData,
  globalFilters,
  globalFilterValues,
  onFilterChange,
  onKernelSelect,
  selectedKernelId,
  isEditing = false,
  profilingManifest,
  blobName,
}: WidgetRendererProps) {
  const autoRules = useMemo(
    () =>
      config.disableGlobalFilters
        ? undefined
        : buildGlobalFilterRules(globalFilters, globalFilterValues),
    [config.disableGlobalFilters, globalFilters, globalFilterValues]
  );

  const transformedData = useMemo(
    () =>
      executePipeline(
        rawData,
        config.dataSource.transforms,
        globalFilterValues,
        autoRules
      ),
    [rawData, config.dataSource.transforms, globalFilterValues, autoRules]
  );

  const Component = widgetRegistry[config.type];

  if (!Component) {
    return (
      <div className="flex items-center justify-center h-full bg-red-50 text-red-600 rounded-lg p-4 text-sm">
        Unknown widget type: {config.type}
      </div>
    );
  }

  const widgetProps: WidgetProps = {
    config,
    data: transformedData,
    globalFilterValues,
    onFilterChange,
    onKernelSelect,
    selectedKernelId,
    isEditing,
    profilingManifest: config.rocprofEnabled ? profilingManifest : undefined,
    blobName: config.rocprofEnabled ? blobName : undefined,
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">
      {config.title && (
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-800">{config.title}</h3>
        </div>
      )}
      <div className="flex-1 p-4 min-h-0">
        <Component {...widgetProps} />
      </div>
    </div>
  );
}
