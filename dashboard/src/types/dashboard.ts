export type WidgetType =
  | "pie_chart"
  | "bar_chart"
  | "line_chart"
  | "scatter_plot"
  | "roofline"
  | "stat_card"
  | "table"
  | "bell_curve";

export type AggregateFunction =
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "geo_mean"
  | "count_where";

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "contains"
  | "regex";

export type GlobalFilterType = "single" | "multi" | "range" | "date_range";

export type DataSourceType =
  | "kernels"
  | "runs"
  | "benchmark_stats"
  | "tracker_performance";

export interface FilterRule {
  field: string;
  operator: FilterOperator;
  value: any; // static value, or "$global.<filterId>" for linked global filter
}

export type Transform =
  | { type: "filter"; rules: FilterRule[] }
  | { type: "group_by"; fields: string[] }
  | {
      type: "aggregate";
      function: AggregateFunction;
      field: string;
      as: string;
    }
  | { type: "compute"; expression: string; as: string }
  | { type: "pivot"; keyField: string; valueField: string }
  | { type: "sort"; field: string; direction: "asc" | "desc" }
  | { type: "limit"; count: number };

export interface DataSourceConfig {
  type: DataSourceType;
  transforms: Transform[];
}

export interface DataMapping {
  x?: string;
  y?: string;
  color?: string;
  size?: string;
  label?: string;
  segment?: string;
  value?: string;
}

export interface WidgetStyleConfig {
  backgroundColor?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  colorScheme?: string;
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  dataSource: DataSourceConfig;
  mapping: DataMapping;
  style?: WidgetStyleConfig;
  localFilters?: FilterRule[];
  /** When true, global filters are NOT auto-applied; the widget manages its own filtering. */
  disableGlobalFilters?: boolean;
}

export interface WidgetLayout {
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GlobalFilterConfig {
  id: string;
  field: string;
  label: string;
  type: GlobalFilterType;
  defaultValue?: any;
}

export interface DashboardConfig {
  _id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  layout: WidgetLayout[];
  widgets: WidgetConfig[];
  globalFilters: GlobalFilterConfig[];
}

export interface DashboardSummary {
  _id: string;
  name: string;
  slug: string;
  updatedAt: string;
}

export interface WidgetProps {
  config: WidgetConfig;
  data: Record<string, any>[];
  globalFilterValues: Record<string, any>;
  onFilterChange?: (filterId: string, value: any) => void;
  isEditing?: boolean;
}

export const WIDGET_TYPE_META: Record<
  WidgetType,
  { label: string; icon: string; description: string }
> = {
  pie_chart: {
    label: "Pie Chart",
    icon: "PieChart",
    description: "Show proportions of a whole",
  },
  bar_chart: {
    label: "Bar Chart",
    icon: "BarChart3",
    description: "Compare values across categories",
  },
  line_chart: {
    label: "Line Chart",
    icon: "TrendingUp",
    description: "Show trends over time or sequence",
  },
  scatter_plot: {
    label: "Scatter Plot",
    icon: "ScatterChart",
    description: "Plot two variables against each other",
  },
  roofline: {
    label: "Roofline Plot",
    icon: "TrendingUp",
    description: "Arithmetic intensity vs performance",
  },
  stat_card: {
    label: "Stat Card",
    icon: "Hash",
    description: "Display a single summary number",
  },
  table: {
    label: "Data Table",
    icon: "Table",
    description: "Tabular view with sorting",
  },
  bell_curve: {
    label: "Distribution",
    icon: "BarChart3",
    description: "Frequency distribution curve",
  },
};
