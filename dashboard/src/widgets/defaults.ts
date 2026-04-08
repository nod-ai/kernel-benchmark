import type { DashboardConfig } from "../types/dashboard";

export const DEFAULT_MODULAR_CONFIG: DashboardConfig = {
  _id: "__default_modular__",
  name: "Performance Overview",
  slug: "__default__",
  createdAt: "",
  updatedAt: "",
  layout: [
    { widgetId: "roofline-overview", x: 0, y: 0, w: 6, h: 7 },
    { widgetId: "geomean-tflops-backend", x: 6, y: 0, w: 4, h: 3 },
    { widgetId: "correct-kernels", x: 10, y: 0, w: 2, h: 3 },
    { widgetId: "kernel-table", x: 6, y: 3, w: 6, h: 4 },
  ],
  widgets: [
    {
      id: "roofline-overview",
      type: "roofline",
      title: "Roofline Analysis",
      dataSource: {
        type: "kernels",
        transforms: [
          {
            type: "filter",
            rules: [{ field: "ok", operator: "eq", value: "true" }],
          },
        ],
      },
      mapping: { color: "backend" },
    },
    {
      id: "geomean-tflops-backend",
      type: "bar_chart",
      title: "Geometric Mean TFLOPs by Backend",
      style: {
        horizontal: true,
      },
      dataSource: {
        type: "kernels",
        transforms: [
          {
            type: "filter",
            rules: [{ field: "ok", operator: "eq", value: "true" }],
          },
          { type: "group_by", fields: ["backend"] },
          {
            type: "aggregate",
            function: "geo_mean",
            field: "tflops",
            as: "geoMeanTflops",
          },
          { type: "sort", field: "geoMeanTflops", direction: "desc" },
        ],
      },
      mapping: { x: "backend", y: "geoMeanTflops", color: "backend" },
    },
    {
      id: "correct-kernels",
      type: "stat_card",
      title: "Correct Kernels",
      dataSource: {
        type: "kernels",
        transforms: [
          { type: "group_by", fields: ["ok"] },
          { type: "aggregate", function: "count", field: "*", as: "count" },
          { type: "pivot", keyField: "ok", valueField: "count" },
          {
            type: "compute",
            expression: "true_count + false_count",
            as: "total",
          },
          {
            type: "format",
            field: "",
            as: "display",
            preset: "fraction",
            numerator: "true_count",
            denominator: "total",
          },
        ],
      },
      mapping: { value: "display" },
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
    {
      id: "gf-tag",
      field: "tag",
      label: "Tag",
      type: "multi",
    },
  ],
};
