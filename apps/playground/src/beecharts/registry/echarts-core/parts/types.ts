import type { ChartConfig } from "@/registry/ui/chart";

export type StackType = "default" | "stacked" | "percent";
export type BarLayout = "vertical" | "horizontal";

export type GridPart = { type: "grid"; id: string; show?: boolean };
export type XAxisPart = {
  type: "xAxis";
  id: string;
  dataKey?: string;
  hide?: boolean;
  tickFormatter?: (value: unknown) => string;
  domain?: [number, number];
  ticks?: number[];
};
export type YAxisPart = {
  type: "yAxis";
  id: string;
  dataKey?: string;
  yAxisId?: string;
  hide?: boolean;
  orientation?: "left" | "right";
  domain?: [number, number];
  unit?: string;
};
export type BarSeriesPart = {
  type: "bar";
  id: string;
  dataKey: string;
  variant?: string;
  yAxisId?: string;
  stackId?: string;
  /** Corner radius in px; falls back to chart `barRadius`. */
  radius?: number;
  /** When false, omitted from the HTML `<Legend />` (series still renders). */
  showInLegend?: boolean;
};
export type LineSeriesPart = {
  type: "line";
  id: string;
  dataKey: string;
  curveType?: "linear" | "monotone" | "step" | "bump";
  yAxisId?: string;
  smooth?: boolean;
  /** `points` — markers only (box-plot median ticks). */
  variant?: string;
  showInLegend?: boolean;
};

export type AreaSeriesPart = {
  type: "area";
  id: string;
  dataKey: string;
  curveType?: "linear" | "monotone" | "step" | "bump";
  variant?: string;
};

export type ScatterSeriesPart = {
  type: "scatter";
  id: string;
  dataKey: string;
  points?: Array<Record<string, number>>;
  xKey?: string;
  yKey?: string;
  variant?: string;
};

export type RadarSeriesPart = {
  type: "radar";
  id: string;
  dataKey: string;
  variant?: string;
};

export type PolarAngleAxisPart = { type: "polarAngleAxis"; id: string; dataKey?: string };
export type PolarGridPart = { type: "polarGrid"; id: string; variant?: string };

export type SankeyGraph = {
  nodes: Array<{ name: string }>;
  links: Array<{ source: number | string; target: number | string; value: number }>;
};

export type SankeyPart = {
  type: "sankey";
  id: string;
  graph: SankeyGraph;
  linkVariant?: string;
};

export type FunnelPart = {
  type: "funnel";
  id: string;
  stageKey?: string;
  valueKey?: string;
};

/** Controls spacing and taper between funnel stages. */
export type FunnelConnection = "seamless" | "default" | "segmented";
export type FunnelTaper = "soft" | "default" | "steep";

export type FunnelStylePart = {
  type: "funnelStyle";
  id: string;
  /** Stage spacing preset — use `stageGap` for exact pixels. */
  connection?: FunnelConnection;
  /** Width taper between top and bottom stages. */
  taper?: FunnelTaper;
  /** Pixel gap override (wins over `connection` gap). */
  stageGap?: number;
};

export type WaterfallRow = {
  name: string;
  value: number;
  type?: "start" | "increase" | "decrease" | "total";
};

export type WaterfallPart = {
  type: "waterfall";
  id: string;
  nameKey?: string;
  valueKey?: string;
  typeKey?: string;
};

export type TreemapNode = {
  name: string;
  value?: number;
  children?: TreemapNode[];
};

export type TreemapStylePart = {
  type: "treemapStyle";
  id: string;
  glowingTiles?: string[];
  showLabels?: boolean;
  isClickable?: boolean;
};

export type TreemapPart = {
  type: "treemap";
  id: string;
  dataKey: string;
  tree?: TreemapNode[];
};

export type SparklinePart = {
  type: "sparkline";
  id: string;
  dataKey: string;
  showFill?: boolean;
  variant?: string;
};

export type RadialBarPart = {
  type: "radialBar";
  id: string;
  dataKey: string;
  cornerRadius?: number;
  barSize?: number;
  showBackground?: boolean;
  glowingBars?: string[];
  isClickable?: boolean;
  showLabels?: boolean;
};

export type BrushPart = { type: "brush"; id: string };
export type PieSeriesPart = {
  type: "pie";
  id: string;
  dataKey?: string;
  nameKey?: string;
  innerRadius?: number | string;
  outerRadius?: number | string;
  showLabels?: boolean;
};
export type HeatmapPart = {
  type: "heatmap";
  id: string;
  dataKey: string;
  cells?: Array<{ row: string; col: string; x: number; y: number; value: number }>;
  xLabels?: string[];
  yLabels?: string[];
  min?: number;
  max?: number;
  enableZoom?: boolean;
};

export type CalendarPart = {
  type: "calendar";
  id: string;
  dataKey: string;
  cells?: Array<{
    date: string;
    value: number;
    assignedHours: number;
    availableHours: number;
  }>;
  range?: string | [string, string];
  min?: number;
  max?: number;
  cellSize?: number | "auto" | (number | "auto")[];
  orient?: "horizontal" | "vertical";
  showDayLabel?: boolean;
};
export type GaugePart = {
  type: "gauge";
  id: string;
  dataKey: string;
  nameKey?: string;
  min?: number;
  max?: number;
  target?: number;
};

export type TooltipPart = {
  type: "tooltip";
  id: string;
  variant?: "default" | "frosted-glass";
  roundness?: "sm" | "md" | "lg" | "xl";
  hideLabel?: boolean;
  hideIndicator?: boolean;
  hide?: boolean;
};

export type LegendPart = {
  type: "legend";
  id: string;
  variant?: string;
  isClickable?: boolean;
  align?: "left" | "center" | "right";
  hide?: boolean;
};

export type ChartPart =
  | GridPart
  | XAxisPart
  | YAxisPart
  | BarSeriesPart
  | LineSeriesPart
  | AreaSeriesPart
  | ScatterSeriesPart
  | RadarSeriesPart
  | PolarAngleAxisPart
  | PolarGridPart
  | SankeyPart
  | FunnelPart
  | FunnelStylePart
  | WaterfallPart
  | TreemapPart
  | TreemapStylePart
  | SparklinePart
  | RadialBarPart
  | BrushPart
  | PieSeriesPart
  | HeatmapPart
  | CalendarPart
  | GaugePart
  | TooltipPart
  | LegendPart;

/** Cartesian bar/line/area/composed/waterfall layout and brush options. */
export type CartesianCompileConfig = {
  layout?: BarLayout;
  stackType?: StackType;
  variant?: string;
  /** Default corner radius for all `<Bar />` series (px). */
  barRadius?: number;
  /** Footer `BeeChartBrush` is active — use tighter cartesian grid margins. */
  externalBrush?: boolean;
  /** Monospace bars: false = intro expanded width, true = collapsed thin rest state. */
  monospaceCollapsed?: boolean;
  /** Hovered category index for monospace width expand. */
  monospaceHoveredIndex?: number | null;
};

/** Radial / polar gauge layout options. */
export type RadialCompileConfig = {
  radialVariant?: "full" | "semi";
  /** `concentric` — arc per ring; `rose` — nightingale petals from center. */
  radialLayout?: "concentric" | "rose";
  radialInnerRadius?: number | string;
  radialOuterRadius?: number | string;
};

/** Funnel stage wiring and visual presets. */
export type FunnelCompileConfig = {
  stageKey?: string;
  valueKey?: string;
  /** Funnel stage spacing in px (overrides connection preset gap). */
  stageGap?: number;
  funnelConnection?: FunnelConnection;
  funnelTaper?: FunnelTaper;
};

export type CompileContext<TData extends Record<string, unknown> = Record<string, unknown>> = {
  config: ChartConfig;
  data: TData[];
  parts: ChartPart[];
  chartId: string;
  resolveColor: (key: string, index?: number) => string;
  xDataKey?: string;
  nameKey?: string;
  valueKey?: string;
  valueDataKey?: string;
  cartesian?: CartesianCompileConfig;
  radial?: RadialCompileConfig;
  funnel?: FunnelCompileConfig;
};
