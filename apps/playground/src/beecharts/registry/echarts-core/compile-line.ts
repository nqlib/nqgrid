/**
 * Pure server-safe line compiler — maps parts + data to an ECharts option.
 * Never touches `document`, React hooks, or browser APIs.
 */
import type { EChartsOption } from "echarts";
import { applyChartUiToOption } from "./apply-chart-ui";
import { categoryValues, getXKey, LINE_MARKER } from "./cartesian-series";
import { resolveCartesianGrid } from "./chart-grid";
import { buildCategoryDataZoom, gridBottomWithZoom } from "./category-data-zoom";
import type { CompileContext, LineSeriesPart } from "./parts/types";

export function compileLineOption(ctx: CompileContext): EChartsOption {
  const xKey = getXKey(ctx);
  const categories = categoryValues(ctx, xKey);
  const lines = ctx.parts.filter((p): p is LineSeriesPart => p.type === "line");
  const hasGrid = ctx.parts.some((p) => p.type === "grid");
  const hasBrush = ctx.parts.some((p) => p.type === "brush");

  const series = lines.map((line) => {
    const color = ctx.resolveColor(line.dataKey, 0);
    return {
      type: "line" as const,
      name: ctx.config[line.dataKey]?.label?.toString() ?? line.dataKey,
      data: ctx.data.map((row) => Number(row[line.dataKey] ?? 0)),
      smooth: line.curveType === "monotone",
      step: line.curveType === "step" ? ("end" as const) : undefined,
      itemStyle: { color },
      lineStyle: { color },
      ...LINE_MARKER,
      // Match composed-chart hover feedback: highlight the hovered series.
      emphasis: { focus: "series" as const },
    };
  });

  const base: EChartsOption = {
    grid: resolveCartesianGrid(ctx.parts, ctx.cartesian?.externalBrush, gridBottomWithZoom(hasBrush)),
    tooltip: { trigger: "axis" },
    // HTML legend via `<Legend />`; never use ECharts built-in legend here.
    xAxis: { type: "category", data: categories },
    yAxis: {
      type: "value",
      splitLine: {
        show: hasGrid,
        lineStyle: { type: "dashed", opacity: 0.35 },
      },
    },
    dataZoom: buildCategoryDataZoom(hasBrush, { chartVariant: "line" }),
    series,
  };

  return applyChartUiToOption(ctx, base);
}
