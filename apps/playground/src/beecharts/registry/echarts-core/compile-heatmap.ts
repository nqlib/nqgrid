import type { EChartsOption } from "echarts";
import { applyChartUiToOption } from "./apply-chart-ui";
import { buildHeatmapDataZoom } from "./category-data-zoom";
import type { CompileContext, HeatmapPart } from "./parts/types";
import type { HeatmapCell } from "@/registry/lib/chart-recipes";

export function compileHeatmapOption(ctx: CompileContext): EChartsOption {
  const heatmaps = ctx.parts.filter((p): p is HeatmapPart => p.type === "heatmap");
  const part = heatmaps[0];
  const cells = (part?.cells ?? (ctx.data as unknown as HeatmapCell[])) as HeatmapCell[];
  if (!cells.length) {
    return { series: [] };
  }
  const xLabels = part?.xLabels ?? [...new Set(cells.map((c) => c.col))].sort();
  const yLabels = part?.yLabels ?? [...new Set(cells.map((c) => c.row))].sort();
  const min = part?.min ?? Math.min(...cells.map((c) => c.value));
  const max = part?.max ?? Math.max(...cells.map((c) => c.value));

  const data = cells.map((c) => [
    xLabels.indexOf(c.col),
    yLabels.indexOf(c.row),
    c.value,
  ]);

  const enableZoom = part?.enableZoom ?? true;
  const colorKey = part?.dataKey ?? "intensity";
  const themeColors =
    ctx.config[colorKey]?.colors?.light ?? ctx.config[colorKey]?.colors?.dark ?? [];
  const colorStops = Math.min(Math.max(themeColors.length, 3), 4);

  const base: EChartsOption = {
    tooltip: { position: "top" },
    grid: {
      left: enableZoom ? 56 : 64,
      right: 24,
      top: 24,
      bottom: enableZoom ? 48 : 64,
      containLabel: true,
    },
    xAxis: { type: "category", data: xLabels, splitArea: { show: true } },
    yAxis: { type: "category", data: yLabels, splitArea: { show: true } },
    dataZoom: buildHeatmapDataZoom(enableZoom),
    visualMap: {
      min,
      max,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: {
        color: Array.from({ length: colorStops }, (_, index) =>
          ctx.resolveColor(colorKey, Math.min(index, Math.max(themeColors.length - 1, 0))),
        ),
      },
    },
    series: [
      {
        type: "heatmap",
        data,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 10 } },
      },
    ],
  };

  return applyChartUiToOption(ctx, base);
}
