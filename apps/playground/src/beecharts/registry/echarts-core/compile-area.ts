import type { EChartsOption } from "echarts";
import { applyChartUiToOption } from "./apply-chart-ui";
import { resolveCanvasGapColor } from "./resolve-chart-chrome";
import { resolveCartesianGrid } from "./chart-grid";
import { buildCategoryDataZoom, gridBottomWithZoom } from "./category-data-zoom";
import { areaVerticalFill, withAlpha } from "./color-alpha";
import { categoryValues, getXKey, LINE_MARKER } from "./cartesian-series";
import { resolveAreaFillColor } from "./resolve-chart-colors";
import type { AreaSeriesPart, CompileContext } from "./parts/types";

function isGlowing(variant?: string) {
  return variant?.includes("glow");
}

function areaStyleFor(variant: string | undefined, color: string) {
  if (variant === "gradient-reverse") {
    return {
      color: {
        type: "linear" as const,
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: withAlpha(color, 0) },
          { offset: 0.45, color: withAlpha(color, 0.08) },
          { offset: 1, color: withAlpha(color, 0.28) },
        ],
      },
    };
  }
  if (
    variant === "gradient" ||
    variant === "gradient-area" ||
    variant === undefined ||
    variant === "default"
  ) {
    return { color: areaVerticalFill(color) };
  }
  if (variant === "hatched" || variant === "lines") {
    return { color: withAlpha(color, 0.22) };
  }
  return { color: withAlpha(color, variant === "dotted" ? 0.14 : 0.22) };
}

export function compileAreaOption(ctx: CompileContext): EChartsOption {
  const gapColor = resolveCanvasGapColor(ctx.chartId);
  const xKey = getXKey(ctx);
  const categories = categoryValues(ctx, xKey);
  const areas = ctx.parts.filter((p): p is AreaSeriesPart => p.type === "area");
  const hasGrid = ctx.parts.some((p) => p.type === "grid");
  const stack =
    ctx.cartesian?.stackType === "stacked" || ctx.cartesian?.stackType === "percent"
      ? "bee-area"
      : undefined;
  const hasBrush = ctx.parts.some((p) => p.type === "brush");

  const series = areas.map((area) => {
    const color = ctx.resolveColor(area.dataKey, 0);
    const fillColor = resolveAreaFillColor(ctx.config, area.dataKey, ctx.resolveColor, 0);
    const glowing = isGlowing(area.variant);
    return {
      type: "line" as const,
      name: ctx.config[area.dataKey]?.label?.toString() ?? area.dataKey,
      stack,
      smooth: area.curveType === "monotone" || area.curveType === "bump",
      step: area.curveType === "step" ? ("end" as const) : undefined,
      data: ctx.data.map((row) => Number(row[area.dataKey] ?? 0)),
      areaStyle: areaStyleFor(area.variant, fillColor),
      lineStyle: {
        color,
        type: area.variant?.includes("dashed") ? ("dashed" as const) : ("solid" as const),
        width: area.variant === "solid-stroke" ? 2 : 1.5,
      },
      ...LINE_MARKER,
      itemStyle: { color, borderColor: gapColor, borderWidth: 1.5 },
      emphasis: glowing
        ? { focus: "series" as const, itemStyle: { shadowBlur: 16, shadowColor: color } }
        : { scale: 1.4 },
    };
  });

  const base: EChartsOption = {
    grid: resolveCartesianGrid(ctx.parts, ctx.cartesian?.externalBrush, gridBottomWithZoom(hasBrush)),
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: categories, boundaryGap: false },
    yAxis: {
      type: "value",
      splitLine: { show: hasGrid },
      max: ctx.cartesian?.stackType === "percent" ? 100 : undefined,
    },
    dataZoom: buildCategoryDataZoom(hasBrush, { chartVariant: "area" }),
    series,
  };

  return applyChartUiToOption(ctx, base);
}
