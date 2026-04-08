import type { DashboardConfig } from "../types/dashboard";

/**
 * The default "Performance Overview" modular dashboard that ships out-of-the-box.
 * Replicates the data the existing fixed dashboard shows, but using the widget system.
 */
export const DEFAULT_MODULAR_CONFIG: DashboardConfig = {
  _id: "__default_modular__",
  name: "Performance Overview",
  slug: "__default__",
  createdAt: "",
  updatedAt: "",
  layout: [
    { widgetId: "success-pie", x: 0, y: 0, w: 4, h: 3 },
    { widgetId: "kernel-count", x: 4, y: 0, w: 2, h: 3 },
    { widgetId: "avg-tflops", x: 6, y: 0, w: 2, h: 3 },
    { widgetId: "tflops-by-backend", x: 8, y: 0, w: 4, h: 3 },
    { widgetId: "runtime-by-backend", x: 0, y: 3, w: 6, h: 4 },
    { widgetId: "kernel-table", x: 6, y: 3, w: 6, h: 4 },
  ],
  widgets: [
    {
      id: "success-pie",
      type: "pie_chart",
      title: "Kernel Success Rate",
      dataSource: {
        type: "kernels",
        transforms: [
          { type: "group_by", fields: ["ok"] },
          { type: "aggregate", function: "count", field: "*", as: "count" },
        ],
      },
      mapping: { segment: "ok", value: "count" },
    },
    {
      id: "kernel-count",
      type: "stat_card",
      title: "Total Kernels",
      dataSource: {
        type: "kernels",
        transforms: [
          { type: "aggregate", function: "count", field: "*", as: "total" },
        ],
      },
      mapping: { value: "total" },
    },
    {
      id: "avg-tflops",
      type: "stat_card",
      title: "Avg TFLOPs",
      dataSource: {
        type: "kernels",
        transforms: [
          { type: "filter", rules: [{ field: "ok", operator: "eq", value: "true" }] },
          { type: "aggregate", function: "avg", field: "tflops", as: "avg" },
        ],
      },
      mapping: { value: "avg" },
    },
    {
      id: "tflops-by-backend",
      type: "bar_chart",
      title: "Avg TFLOPs by Backend",
      dataSource: {
        type: "kernels",
        transforms: [
          { type: "filter", rules: [{ field: "ok", operator: "eq", value: "true" }] },
          { type: "group_by", fields: ["backend"] },
          { type: "aggregate", function: "avg", field: "tflops", as: "avgTflops" },
        ],
      },
      mapping: { x: "backend", y: "avgTflops", color: "backend" },
    },
    {
      id: "runtime-by-backend",
      type: "bar_chart",
      title: "Avg Runtime (us) by Backend",
      dataSource: {
        type: "kernels",
        transforms: [
          { type: "filter", rules: [{ field: "ok", operator: "eq", value: "true" }] },
          { type: "group_by", fields: ["backend"] },
          {
            type: "aggregate",
            function: "avg",
            field: "meanMicroseconds",
            as: "avgRuntime",
          },
        ],
      },
      mapping: { x: "backend", y: "avgRuntime", color: "backend" },
    },
    {
      id: "kernel-table",
      type: "table",
      title: "Kernel Results",
      dataSource: {
        type: "kernels",
        transforms: [
          { type: "sort", field: "tflops", direction: "desc" },
          { type: "limit", count: 50 },
        ],
      },
      mapping: { x: "name,backend,tflops,meanMicroseconds,ok" },
    },
  ],
  globalFilters: [
    {
      id: "gf-kernelType",
      field: "kernelType",
      label: "Kernel Type",
      type: "single",
    },
    {
      id: "gf-machine",
      field: "machine",
      label: "Machine",
      type: "single",
    },
    {
      id: "gf-backend",
      field: "backend",
      label: "Backend",
      type: "multi",
    },
  ],
};
