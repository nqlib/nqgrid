import type { EChartsOption } from "echarts";
import type { ChartPart } from "./parts/types";

export type ChartGridInsets = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  containLabel: boolean;
};

export type ChartPlotInsets = {
  left: number;
  right: number;
};

type AxisLike = { type?: string; boundaryGap?: boolean | [boolean, boolean] };

function asPixels(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Read cartesian grid padding from a compiled ECharts option. */
export function extractGridInsets(option: EChartsOption): ChartGridInsets {
  const raw = option.grid;
  const grid = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;

  return {
    left: asPixels(grid?.left, 48),
    right: asPixels(grid?.right, 24),
    top: asPixels(grid?.top, 24),
    bottom: asPixels(grid?.bottom, 48),
    containLabel: grid?.containLabel !== false,
  };
}

function firstAxis(axis: EChartsOption["xAxis"] | EChartsOption["yAxis"]): AxisLike | undefined {
  if (axis == null) return undefined;
  return (Array.isArray(axis) ? axis[0] : axis) as AxisLike;
}

/** Category band layout for brush handle positioning (matches ECharts category axis). */
export function extractCategoryBoundaryGap(option: EChartsOption): boolean {
  const xAxis = firstAxis(option.xAxis);
  if (xAxis?.type === "category") {
    const gap = xAxis.boundaryGap;
    if (gap === false) return false;
    if (Array.isArray(gap)) return gap[0] !== false;
    return true;
  }

  const yAxis = firstAxis(option.yAxis);
  if (yAxis?.type === "category") {
    const gap = yAxis.boundaryGap;
    if (gap === false) return false;
    if (Array.isArray(gap)) return gap[1] !== false;
    return true;
  }

  return false;
}

export function indexToPlotPercent(
  index: number,
  totalPoints: number,
  boundaryGap: boolean,
): number {
  if (totalPoints <= 1) return 0;
  if (boundaryGap) return ((index + 0.5) / totalPoints) * 100;
  return (index / (totalPoints - 1)) * 100;
}

/** Tighter horizontal grid when using the footer `BeeChartBrush` (not built-in dataZoom). */
export function resolveCartesianGrid(
  parts: ChartPart[],
  externalBrush: boolean | undefined,
  bottom: number,
  horizontal = false,
): ChartGridInsets {
  const hasBuiltInBrush = parts.some((p) => p.type === "brush");
  const compact = Boolean(externalBrush) && !hasBuiltInBrush;

  return {
    left: compact ? (horizontal ? 56 : 8) : horizontal && hasBuiltInBrush ? 72 : 48,
    right: compact ? 8 : 24,
    top: 24,
    bottom,
    containLabel: true,
  };
}
