import type { ComponentType } from "react";
import type { WidgetType, WidgetProps } from "../types/dashboard";

import PieChartWidget from "./PieChartWidget";
import BarChartWidget from "./BarChartWidget";
import LineChartWidget from "./LineChartWidget";
import ScatterPlotWidget from "./ScatterPlotWidget";
import RooflineWidget from "./RooflineWidget";
import StatCardWidget from "./StatCardWidget";
import TableWidget from "./TableWidget";
import BellCurveWidget from "./BellCurveWidget";

const widgetRegistry: Record<WidgetType, ComponentType<WidgetProps>> = {
  pie_chart: PieChartWidget,
  bar_chart: BarChartWidget,
  line_chart: LineChartWidget,
  scatter_plot: ScatterPlotWidget,
  roofline: RooflineWidget,
  stat_card: StatCardWidget,
  table: TableWidget,
  bell_curve: BellCurveWidget,
};

export default widgetRegistry;
