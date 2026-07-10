import type { EChartsOption } from "echarts";
import { getColorsCount } from "@/registry/ui/chart";
import { applyChartUiToOption } from "./apply-chart-ui";
import { radarAreaFill } from "./color-alpha";
import { resolveAreaFillColor } from "./resolve-chart-colors";
import type { ChartPart, CompileContext, RadarSeriesPart } from "./parts/types";

function getAngleKey(ctx: CompileContext): string {
  const polar = ctx.parts.find(
    (p): p is Extract<ChartPart, { type: "polarAngleAxis" }> => p.type === "polarAngleAxis",
  );
  if (polar?.dataKey) return polar.dataKey;
  return Object.keys(ctx.data[0] ?? {})[0] ?? "skill";
}

export function compileRadarOption(ctx: CompileContext): EChartsOption {
  const angleKey = getAngleKey(ctx);
  const radars = ctx.parts.filter((p): p is RadarSeriesPart => p.type === "radar");
  const indicators = ctx.data.map((row) => {
    const values = radars.map((r) => Number(row[r.dataKey] ?? 0));
    const max = Math.max(...values, 1) * 1.2;
    return { name: String(row[angleKey] ?? ""), max };
  });

  const seriesData = radars.map((radar) => {
    const color = ctx.resolveColor(radar.dataKey, 0);
    const colorsCount = getColorsCount(ctx.config[radar.dataKey] ?? {});
    const glowing = radar.variant?.includes("glow");
    const filled = radar.variant === "filled" || radar.variant?.includes("filled");
    const linesOnly = radar.variant === "lines";
    const resolveFillColor = (key: string, index: number) =>
      resolveAreaFillColor(ctx.config, key, ctx.resolveColor, index);
    const areaStyle =
      filled && !linesOnly
        ? radarAreaFill(resolveFillColor, radar.dataKey, colorsCount)
        : undefined;

    return {
      name: ctx.config[radar.dataKey]?.label?.toString() ?? radar.dataKey,
      value: ctx.data.map((row) => Number(row[radar.dataKey] ?? 0)),
      areaStyle,
      lineStyle: { color, width: 2 },
      itemStyle: { color },
      symbol: "circle",
      symbolSize: 4,
      emphasis: glowing
        ? {
            lineStyle: { shadowBlur: 14, shadowColor: color },
            areaStyle,
          }
        : {
            lineStyle: { width: 3 },
            areaStyle,
          },
    };
  });

  const gridPart = ctx.parts.find((p): p is Extract<ChartPart, { type: "polarGrid" }> => p.type === "polarGrid");
  const gridVariant = gridPart?.variant;
  const splitLine = gridVariant === "circle" ? { lineStyle: { type: "dashed" as const } } : undefined;

  const base: EChartsOption = {
    tooltip: { trigger: "item" },
    legend: seriesData.length > 1 ? { bottom: 0 } : undefined,
    radar: {
      indicator: indicators,
      splitLine,
    },
    series: [
      {
        type: "radar",
        data: seriesData,
      },
    ],
  };

  return applyChartUiToOption(ctx, base);
}
