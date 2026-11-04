import * as echarts from "echarts/core";
import {
  BarChart,
  CustomChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  SankeyChart,
  ScatterChart,
  TreemapChart,
} from "echarts/charts";
import {
  CalendarComponent,
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  PolarComponent,
  RadarComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  CustomChart,
  LineChart,
  PieChart,
  HeatmapChart,
  GaugeChart,
  RadarChart,
  ScatterChart,
  SankeyChart,
  TreemapChart,
  FunnelChart,
  CalendarComponent,
  GraphicComponent,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  DataZoomComponent,
  PolarComponent,
  RadarComponent,
  CanvasRenderer,
]);

export { echarts };
