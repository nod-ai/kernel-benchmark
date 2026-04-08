import { useMemo, useCallback, useState } from "react";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  verticalCompactor,
} from "react-grid-layout";
import type { Layout, LayoutItem } from "react-grid-layout";
import { Settings, Trash2 } from "lucide-react";
import "react-grid-layout/css/styles.css";

import type {
  DashboardConfig,
  WidgetLayout,
  WidgetConfig,
  WidgetType,
  GlobalFilterConfig,
} from "../types/dashboard";
import WidgetRenderer from "../widgets/WidgetRenderer";
import GlobalFilterBar from "./GlobalFilterBar";
import EditToolbar from "./DashboardEditor/EditToolbar";
import WidgetCatalog from "./DashboardEditor/WidgetCatalog";
import WidgetConfigModal from "./DashboardEditor/WidgetConfigModal";

interface DashboardRendererProps {
  config: DashboardConfig;
  rawData: Record<string, any>[];
  globalFilterValues: Record<string, any>;
  onGlobalFilterChange: (filterId: string, value: any) => void;
  onConfigChange?: (config: DashboardConfig) => void;
  onSave?: (config: DashboardConfig) => Promise<void> | void;
}

function toRGLLayout(layout: WidgetLayout[]): LayoutItem[] {
  return layout.map((item) => ({
    i: item.widgetId,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: 2,
    minH: 2,
  }));
}

function fromRGLLayout(rglLayout: readonly LayoutItem[]): WidgetLayout[] {
  return rglLayout.map((item) => ({
    widgetId: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
  }));
}

function makeDefaultWidget(type: WidgetType): WidgetConfig {
  const id = `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    type,
    title: `New ${type.replace("_", " ")}`,
    dataSource: { type: "kernels", transforms: [] },
    mapping: {},
  };
}

export default function DashboardRenderer({
  config,
  rawData,
  globalFilterValues,
  onGlobalFilterChange,
  onConfigChange,
  onSave,
}: DashboardRendererProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { width, containerRef, mounted } = useContainerWidth();

  const rglLayout = useMemo(() => toRGLLayout(config.layout), [config.layout]);

  const mutateConfig = useCallback(
    (updater: (prev: DashboardConfig) => DashboardConfig) => {
      const next = updater(config);
      setHasChanges(true);
      onConfigChange?.(next);
    },
    [config, onConfigChange]
  );

  const handleLayoutChange = useCallback(
    (current: Layout) => {
      if (!isEditing) return;
      mutateConfig((prev) => ({
        ...prev,
        layout: fromRGLLayout(current),
      }));
    },
    [isEditing, mutateConfig]
  );

  const handleAddWidget = useCallback(
    (type: WidgetType) => {
      const widget = makeDefaultWidget(type);
      const maxY = config.layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
      const layoutItem: WidgetLayout = {
        widgetId: widget.id,
        x: 0,
        y: maxY,
        w: 6,
        h: 3,
      };
      mutateConfig((prev) => ({
        ...prev,
        widgets: [...prev.widgets, widget],
        layout: [...prev.layout, layoutItem],
      }));
      setShowCatalog(false);
      setEditingWidget(widget);
    },
    [config.layout, mutateConfig]
  );

  const handleDeleteWidget = useCallback(
    (widgetId: string) => {
      mutateConfig((prev) => ({
        ...prev,
        widgets: prev.widgets.filter((w) => w.id !== widgetId),
        layout: prev.layout.filter((l) => l.widgetId !== widgetId),
      }));
    },
    [mutateConfig]
  );

  const handleSaveWidget = useCallback(
    (updated: WidgetConfig) => {
      mutateConfig((prev) => ({
        ...prev,
        widgets: prev.widgets.map((w) => (w.id === updated.id ? updated : w)),
      }));
      setEditingWidget(null);
    },
    [mutateConfig]
  );

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await onSave(config);
      setHasChanges(false);
      setIsEditing(false);
      setSaveMessage({ type: "success", text: "Dashboard saved" });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setSaveMessage({ type: "error", text: err?.message || "Save failed" });
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  }, [config, onSave]);

  const handleDiscard = useCallback(() => {
    setHasChanges(false);
    setIsEditing(false);
  }, []);

  const handleAddFilter = useCallback(
    (filter: GlobalFilterConfig) => {
      mutateConfig((prev) => ({
        ...prev,
        globalFilters: [...prev.globalFilters, filter],
      }));
    },
    [mutateConfig]
  );

  const handleUpdateFilter = useCallback(
    (updated: GlobalFilterConfig) => {
      mutateConfig((prev) => ({
        ...prev,
        globalFilters: prev.globalFilters.map((f) =>
          f.id === updated.id ? updated : f
        ),
      }));
    },
    [mutateConfig]
  );

  const handleDeleteFilter = useCallback(
    (filterId: string) => {
      mutateConfig((prev) => ({
        ...prev,
        globalFilters: prev.globalFilters.filter((f) => f.id !== filterId),
      }));
    },
    [mutateConfig]
  );

  return (
    <div className="flex flex-col gap-4" ref={containerRef}>
      {/* Save feedback toast */}
      {saveMessage && (
        <div
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            saveMessage.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Edit toolbar */}
      <div className="flex justify-end">
        <EditToolbar
          isEditing={isEditing}
          isSaving={isSaving}
          onToggleEdit={() => setIsEditing(true)}
          onAddWidget={() => setShowCatalog(true)}
          onSave={handleSave}
          onDiscard={handleDiscard}
          hasUnsavedChanges={hasChanges}
        />
      </div>

      {/* Global filters */}
      {(config.globalFilters.length > 0 || isEditing) && (
        <GlobalFilterBar
          filters={config.globalFilters}
          values={globalFilterValues}
          rawData={rawData}
          onChange={onGlobalFilterChange}
          isEditing={isEditing}
          onAddFilter={handleAddFilter}
          onUpdateFilter={handleUpdateFilter}
          onDeleteFilter={handleDeleteFilter}
        />
      )}

      {/* Widget grid */}
      {mounted && (
        <ResponsiveGridLayout
          className="layout"
          width={width}
          layouts={{ lg: rglLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
          rowHeight={80}
          dragConfig={{ enabled: isEditing, bounded: false, threshold: 3 }}
          resizeConfig={{ enabled: isEditing, handles: ["se"] }}
          onLayoutChange={handleLayoutChange}
          compactor={verticalCompactor}
          margin={[16, 16]}
        >
          {config.widgets.map((widget) => (
            <div key={widget.id} className="relative group">
              {isEditing && (
                <div className="absolute top-1 right-1 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditingWidget(widget)}
                    className="p-1 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
                    title="Configure widget"
                  >
                    <Settings className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleDeleteWidget(widget.id)}
                    className="p-1 bg-white border border-red-300 rounded shadow-sm hover:bg-red-50"
                    title="Remove widget"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              )}
              <WidgetRenderer
                config={widget}
                rawData={rawData}
                globalFilters={config.globalFilters}
                globalFilterValues={globalFilterValues}
                onFilterChange={onGlobalFilterChange}
                isEditing={isEditing}
              />
            </div>
          ))}
        </ResponsiveGridLayout>
      )}

      {/* Modals */}
      {showCatalog && (
        <WidgetCatalog
          onSelect={handleAddWidget}
          onClose={() => setShowCatalog(false)}
        />
      )}
      {editingWidget && (
        <WidgetConfigModal
          initial={editingWidget}
          rawData={rawData}
          onSave={handleSaveWidget}
          onCancel={() => setEditingWidget(null)}
        />
      )}
    </div>
  );
}
