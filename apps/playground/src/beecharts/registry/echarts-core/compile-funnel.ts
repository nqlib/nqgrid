import type { EChartsOption } from "echarts";
import { applyChartUiToOption } from "./apply-chart-ui";
import { resolveFunnelLayout } from "./funnel-layout";
import {
  resolveCanvasGapColor,
  resolveCanvasTileLabelColor,
} from "./resolve-chart-chrome";
import type { CompileContext, FunnelPart, FunnelStylePart } from "./parts/types";

export function compileFunnelOption(ctx: CompileContext): EChartsOption {
  const funnel = ctx.parts.find((p): p is FunnelPart => p.type === "funnel");
  const style = ctx.parts.find((p): p is FunnelStylePart => p.type === "funnelStyle");
  const stageKey = funnel?.stageKey ?? ctx.funnel?.stageKey ?? "stage";
  const valueKey = funnel?.valueKey ?? ctx.funnel?.valueKey ?? "value";
  const { gap, borderWidth, minSize } = resolveFunnelLayout(ctx, style);
  const gapColor = resolveCanvasGapColor(ctx.chartId);
  const insideLabelColor = resolveCanvasTileLabelColor(ctx.chartId);

  const funnelData = ctx.data.map((row) => {
    const key = String(row[stageKey] ?? "");
    const color = ctx.resolveColor(key, 0);
    return {
      name: ctx.config[key]?.label?.toString() ?? key,
      value: Number(row[valueKey] ?? 0),
      itemStyle: {
        color,
        borderColor: gapColor,
        borderWidth,
      },
    };
  });

  const base: EChartsOption = {
    tooltip: { trigger: "item" },
    legend: { show: false },
    series: [
      {
        type: "funnel",
        left: "6%",
        top: 10,
        bottom: 10,
        width: "88%",
        minSize,
        maxSize: "100%",
        sort: "descending",
        gap,
        funnelAlign: "center",
        itemStyle: {
          borderWidth,
          borderColor: gapColor,
        },
        label: {
          show: true,
          position: "inside",
          color: insideLabelColor,
          fontSize: 11,
          fontWeight: 500,
          lineHeight: 16,
          formatter: "{b}\n{c}",
        },
        labelLine: { show: false },
        emphasis: {
          focus: "self",
          itemStyle: {
            shadowBlur: 14,
            shadowOffsetY: 2,
            shadowColor: "rgba(0, 0, 0, 0.22)",
          },
          label: { fontSize: 12, fontWeight: 600 },
        },
        data: funnelData,
      },
    ],
  };

  return applyChartUiToOption(ctx, base);
}
