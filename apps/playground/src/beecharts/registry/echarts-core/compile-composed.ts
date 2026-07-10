import type { EChartsOption } from "echarts";
import { applyChartUiToOption } from "./apply-chart-ui";
import { resolveCanvasGapColor } from "./resolve-chart-chrome";
import { barBorderRadius, resolveBarRadius } from "./bar-radius";
import { categoryValues, getXKey, LINE_MARKER } from "./cartesian-series";
import { resolveCartesianGrid } from "./chart-grid";
import { buildCategoryDataZoom, gridBottomWithZoom } from "./category-data-zoom";
import type {
  BarSeriesPart,
  CompileContext,
  LineSeriesPart,
  YAxisPart,
} from "./parts/types";

export function compileComposedOption(ctx: CompileContext): EChartsOption {
  const gapColor = resolveCanvasGapColor(ctx.chartId);
  const xKey = getXKey(ctx);
  const categories = categoryValues(ctx, xKey);
  const bars = ctx.parts.filter((p): p is BarSeriesPart => p.type === "bar");
  const lines = ctx.parts.filter((p): p is LineSeriesPart => p.type === "line");
  const yAxes = ctx.parts.filter((p): p is YAxisPart => p.type === "yAxis");
  const hasGrid = ctx.parts.some((p) => p.type === "grid");
  const hasBrush = ctx.parts.some((p) => p.type === "brush");

  const yAxisList = yAxes.length
    ? yAxes.map((ya, i) => ({
        type: "value" as const,
        name: ya.unit ?? "",
        position: (ya.orientation === "right" ? "right" : "left") as "left" | "right",
        min: ya.domain?.[0],
        max: ya.domain?.[1],
        splitLine: { show: i === 0 && hasGrid },
      }))
    : [{ type: "value" as const, splitLine: { show: hasGrid } }];

  // A series may ask for the right axis; only honor it when a second axis exists,
  // otherwise yAxisIndex would point at a missing axis and ECharts renders nowhere.
  const rightAxisIndex = yAxisList.length > 1 ? 1 : 0;
  const yAxisIndexFor = (yAxisId?: string) => (yAxisId === "right" ? rightAxisIndex : 0);

  /** Column-aligned focus: highlight the hovered category across bar + line, dim the rest. */
  const columnFocusEmphasis = {
    focus: "self" as const,
    blurScope: "coordinateSystem" as const,
  };
  const columnFocusBlur = {
    itemStyle: { opacity: 0.28 },
    lineStyle: { opacity: 0.28 },
  };

  const barSeries = bars.map((bar) => {
    const r = resolveBarRadius(bar.radius, ctx.cartesian?.barRadius);
    const color = ctx.resolveColor(bar.dataKey, 0);
    return {
      type: "bar" as const,
      name: ctx.config[bar.dataKey]?.label?.toString() ?? bar.dataKey,
      yAxisIndex: yAxisIndexFor(bar.yAxisId),
      stack: bar.stackId,
      data: ctx.data.map((row) => Number(row[bar.dataKey] ?? 0)),
      itemStyle: {
        color,
        borderRadius: barBorderRadius(r, false),
      },
      blur: columnFocusBlur,
      emphasis: {
        ...columnFocusEmphasis,
        scale: true,
        itemStyle: { color, opacity: 1 },
      },
    };
  });

  const lineSeries = lines.map((line) => {
    const color = ctx.resolveColor(line.dataKey, 0);
    const markersOnly = line.variant === "points";
    return {
      type: "line" as const,
      name: ctx.config[line.dataKey]?.label?.toString() ?? line.dataKey,
      yAxisIndex: yAxisIndexFor(line.yAxisId),
      data: ctx.data.map((row) => Number(row[line.dataKey] ?? 0)),
      smooth: !markersOnly && line.curveType === "monotone",
      showLine: !markersOnly,
      triggerLineEvent: true,
      itemStyle: { color },
      lineStyle: { color, width: markersOnly ? 0 : 2 },
      showSymbol: true,
      symbol: markersOnly ? "rect" : LINE_MARKER.symbol,
      symbolSize: markersOnly ? [16, 3] : LINE_MARKER.symbolSize,
      blur: columnFocusBlur,
      emphasis: {
        ...columnFocusEmphasis,
        scale: true,
        lineStyle: { color, width: markersOnly ? 0 : 3 },
        itemStyle: {
          color,
          borderWidth: markersOnly ? 0 : 2,
          borderColor: gapColor,
        },
      },
    };
  });

  const grid = resolveCartesianGrid(ctx.parts, ctx.cartesian?.externalBrush, gridBottomWithZoom(hasBrush));
  if (yAxes.some((y) => y.orientation === "right") && !ctx.cartesian?.externalBrush) {
    grid.right = 56;
  }

  const base: EChartsOption = {
    grid,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    xAxis: { type: "category", data: categories },
    yAxis: yAxisList,
    dataZoom: buildCategoryDataZoom(hasBrush, { chartVariant: "composed" }),
    series: [...barSeries, ...lineSeries],
  };

  return applyChartUiToOption(ctx, base);
}
