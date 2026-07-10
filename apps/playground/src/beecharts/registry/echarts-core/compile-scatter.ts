import type { EChartsOption } from "echarts";
import { applyChartUiToOption } from "./apply-chart-ui";
import type { ChartPart, CompileContext, ScatterSeriesPart } from "./parts/types";

function getAxisKey(ctx: CompileContext, axis: "xAxis" | "yAxis", fallback: string) {
  const part = ctx.parts.find((p): p is Extract<ChartPart, { type: typeof axis }> => p.type === axis);
  return part?.dataKey ?? fallback;
}

export function compileScatterOption(ctx: CompileContext): EChartsOption {
  const scatters = ctx.parts.filter((p): p is ScatterSeriesPart => p.type === "scatter");
  const hasGrid = ctx.parts.some((p) => p.type === "grid");
  const xKey = getAxisKey(ctx, "xAxis", "x");
  const yKey = getAxisKey(ctx, "yAxis", "y");

  const series = scatters.map((scatter) => {
    const color = ctx.resolveColor(scatter.dataKey, 0);
    const points = scatter.points ?? [];
    const data = points.map((p) => [Number(p[xKey] ?? p.x ?? 0), Number(p[yKey] ?? p.y ?? 0)]);
    const glowing = scatter.variant?.includes("glow");
    return {
      type: "scatter" as const,
      name: ctx.config[scatter.dataKey]?.label?.toString() ?? scatter.dataKey,
      data,
      symbolSize: scatter.variant === "bubble" ? 14 : 8,
      itemStyle: { color },
      emphasis: glowing ? { itemStyle: { shadowBlur: 14, shadowColor: color } } : undefined,
    };
  });

  const base: EChartsOption = {
    grid: { left: 56, right: 24, top: 24, bottom: 48, containLabel: true },
    tooltip: { trigger: "item" },
    xAxis: { type: "value", splitLine: { show: hasGrid } },
    yAxis: { type: "value", splitLine: { show: hasGrid } },
    series,
  };

  return applyChartUiToOption(ctx, base);
}
