import type { EChartsOption } from "echarts";
import { applyChartUiToOption } from "./apply-chart-ui";
import { computeSparklineDomain, withAlpha } from "./color-alpha";
import { resolveAreaFillColor } from "./resolve-chart-colors";
import type { CompileContext, SparklinePart } from "./parts/types";

export function compileSparklineOption(ctx: CompileContext): EChartsOption {
  const sparks = ctx.parts.filter((p): p is SparklinePart => p.type === "sparkline");
  const lineSpark = sparks.find((s) => !s.showFill) ?? sparks[0];
  const fillSpark = sparks.find((s) => s.showFill);
  const showFill = Boolean(fillSpark);
  const colorKey = lineSpark?.dataKey ?? fillSpark?.dataKey ?? "trend";
  const valueKey = ctx.valueDataKey ?? "value";
  const color = ctx.resolveColor(colorKey, 0);
  const fillColor = resolveAreaFillColor(ctx.config, colorKey, ctx.resolveColor, 0);
  const values = ctx.data.map((row) => Number(row[valueKey] ?? 0));
  const [yMin, yMax] = computeSparklineDomain(values);
  const categories = values.map((_, i) => String(i));

  const base: EChartsOption = {
    grid: { left: 4, right: 4, top: 4, bottom: 4 },
    xAxis: { type: "category", data: categories, show: false, boundaryGap: false },
    yAxis: {
      type: "value",
      show: false,
      min: yMin,
      max: yMax,
      scale: true,
    },
    tooltip: { trigger: "axis" },
    series: [
      {
        type: "line",
        data: values,
        smooth: true,
        showSymbol: false,
        lineStyle: { color, width: 2 },
        areaStyle: showFill
          ? {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: withAlpha(fillColor, 0.35) },
                  { offset: 1, color: withAlpha(fillColor, 0.02) },
                ],
              },
            }
          : undefined,
      },
    ],
  };

  return applyChartUiToOption(ctx, base);
}
