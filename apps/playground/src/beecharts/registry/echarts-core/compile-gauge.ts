import type { EChartsOption } from "echarts";
import { applyChartUiToOption } from "./apply-chart-ui";
import type { CompileContext, GaugePart } from "./parts/types";

export function compileGaugeOption(ctx: CompileContext): EChartsOption {
  const gauges = ctx.parts.filter((p): p is GaugePart => p.type === "gauge");
  const radialAsGauge = ctx.parts.find((p) => p.type === "radialBar");
  const gauge =
    gauges[0] ??
    (radialAsGauge
      ? {
          type: "gauge" as const,
          id: radialAsGauge.id,
          dataKey: radialAsGauge.dataKey,
          target: undefined,
        }
      : undefined);
  const nameKey = ctx.nameKey ?? gauge?.nameKey ?? "series";
  const valueKey = gauge?.dataKey ?? "value";
  const target = gauge?.target;
  const row = ctx.data[0] ?? {};
  const seriesKey = String(row[nameKey] ?? "");
  const value = Number(row[valueKey] ?? 0);
  const min = gauge?.min ?? 0;
  const max = gauge?.max ?? 100;
  const color = ctx.resolveColor(seriesKey, 0);
  const colorEnd = ctx.resolveColor(seriesKey, 1) ?? color;

  const series: EChartsOption["series"] = [
    {
      type: "gauge",
      startAngle: 180,
      endAngle: 0,
      min,
      max,
      progress: { show: true, width: 12 },
      axisLine: {
        lineStyle: {
          width: 12,
          color: [[1, colorEnd]],
        },
      },
      pointer: { show: true },
      title: {
        // Pin the series name below the value so the two never overlap.
        // Gauge's default title offset sits over the dial / detail text.
        offsetCenter: [0, "78%"],
        fontSize: 12,
      },
      detail: {
        valueAnimation: true,
        formatter: "{value}",
        fontSize: 20,
        offsetCenter: [0, "38%"],
      },
      data: [{ value, name: ctx.config[seriesKey]?.label?.toString() ?? seriesKey }],
      itemStyle: { color },
    },
  ];

  if (target != null) {
    (series as object[]).push({
      type: "gauge",
      startAngle: 180,
      endAngle: 0,
      min,
      max,
      pointer: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: { show: false },
      data: [{ value: target }],
      markPoint: undefined,
    });
  }

  const base: EChartsOption = {
    tooltip: { trigger: "item" },
    series,
  };

  return applyChartUiToOption(ctx, base);
}
