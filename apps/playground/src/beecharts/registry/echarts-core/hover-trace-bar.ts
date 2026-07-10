import type { EChartsOption } from "echarts";
import type { EChartsType } from "echarts/core";
import { resolveCanvasChartChrome } from "./resolve-chart-chrome";

export const BEE_HOVER_TRACE_GRAPHIC_ID = "bee-hover-trace";

/** ECharts series id for a hover-trace variant — parameterized by `dataKey` for reuse outside bar charts. */
export function hoverTraceSeriesId(dataKey: string): string {
  return `bee-hover-trace-${dataKey}`;
}

export const hoverTraceBlurStyle = {
  itemStyle: { opacity: 0.2 },
} as const;

export const hoverTraceFocusEmphasis = {
  focus: "self" as const,
  blurScope: "coordinateSystem" as const,
  scale: false,
  itemStyle: { opacity: 1 },
};

type GridRect = { x: number; y: number; width: number; height: number };

function getGridRect(chart: EChartsType): GridRect | null {
  type GridModel = {
    coordinateSystem?: { getRect?: () => GridRect };
  };
  const inst = chart as unknown as {
    getModel(): { getComponent(name: string, idx: number): GridModel };
  };
  return inst.getModel().getComponent("grid", 0)?.coordinateSystem?.getRect?.() ?? null;
}

function traceYPixel(
  chart: EChartsType,
  categoryIndex: number,
  traceY: number,
): number | null {
  const pixel = chart.convertToPixel({ seriesIndex: 0 }, [categoryIndex, traceY]);
  if (!Array.isArray(pixel) || pixel.length < 2) return null;
  const y = pixel[1] ?? null;
  return y !== null && Number.isFinite(y) ? y : null;
}

export function peakBarIndex(
  rows: Record<string, unknown>[],
  dataKey: string,
): number {
  if (rows.length === 0) return 0;
  let peakIndex = 0;
  let peakValue = Number(rows[0]?.[dataKey] ?? 0);
  for (let i = 1; i < rows.length; i++) {
    const value = Number(rows[i]?.[dataKey] ?? 0);
    if (value > peakValue) {
      peakValue = value;
      peakIndex = i;
    }
  }
  return peakIndex;
}

export function hoverTraceValueAt(
  rows: Record<string, unknown>[],
  dataKey: string,
  index: number,
): number {
  return Number(rows[index]?.[dataKey] ?? 0);
}

/** Canvas-safe hover trace — dashed line, value pill, end dot (beecharts ReferenceLine parity). */
export function buildHoverTraceGraphic(
  chart: EChartsType,
  categoryIndex: number,
  traceY: number,
  chartId: string,
): EChartsOption["graphic"] {
  const grid = getGridRect(chart);
  const yPx = traceYPixel(chart, categoryIndex, traceY);
  if (!grid || yPx == null) return [];

  const chrome = resolveCanvasChartChrome(chartId);
  const formatted = traceY.toLocaleString();
  const labelWidth = formatted.length * 7 + 12;
  const pillHeight = 18;
  const pillY = yPx - pillHeight / 2;
  const lineX1 = grid.x;
  const lineX2 = grid.x + grid.width;
  // Pill sits inside the plot at the line origin — avoids bleeding over y-axis labels.
  const pillX = lineX1 + 4;
  const dashX1 = pillX + labelWidth + 6;

  return [
    {
      type: "group",
      id: BEE_HOVER_TRACE_GRAPHIC_ID,
      z: 100,
      children: [
        {
          type: "line",
          id: `${BEE_HOVER_TRACE_GRAPHIC_ID}-line`,
          shape: { x1: dashX1, y1: yPx, x2: lineX2, y2: yPx },
          style: {
            stroke: chrome.foreground,
            lineWidth: 1,
            lineDash: [4, 4],
          },
          transition: ["shape"],
        },
        {
          type: "rect",
          id: `${BEE_HOVER_TRACE_GRAPHIC_ID}-label-bg`,
          shape: { x: pillX, y: pillY, width: labelWidth, height: pillHeight, r: 4 },
          style: { fill: chrome.foreground },
          transition: ["shape"],
        },
        {
          type: "text",
          id: `${BEE_HOVER_TRACE_GRAPHIC_ID}-label`,
          style: {
            text: formatted,
            fill: chrome.background,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          },
          x: pillX + 6,
          y: yPx,
          transition: ["x", "y"],
        },
        {
          type: "circle",
          id: `${BEE_HOVER_TRACE_GRAPHIC_ID}-dot`,
          shape: { cx: lineX2, cy: yPx, r: 3 },
          style: { fill: chrome.foreground },
          transition: ["shape"],
        },
      ],
    },
  ];
}
