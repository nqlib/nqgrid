/**
 * Pure server-safe pie compiler — maps parts + data to an ECharts option.
 * Never touches `document`, React hooks, or browser APIs.
 */
import type { EChartsOption } from "echarts";
import { applyChartUiToOption } from "./apply-chart-ui";
import { resolveCanvasChartChrome } from "./resolve-chart-chrome";
import type { CompileContext, PieSeriesPart } from "./parts/types";

export function compilePieOption(ctx: CompileContext): EChartsOption {
  const pies = ctx.parts.filter((p): p is PieSeriesPart => p.type === "pie");
  const pie = pies[0];
  const nameKey =
    pie?.nameKey ?? ctx.nameKey ?? Object.keys(ctx.data[0] ?? {})[0] ?? "name";
  const valueKey = pie?.dataKey ?? "value";

  const pieData = ctx.data.map((row) => {
    const seriesKey = String(row[nameKey] ?? "");
    return {
      name: ctx.config[seriesKey]?.label?.toString() ?? seriesKey,
      value: Number(row[valueKey] ?? row[seriesKey] ?? 0),
      itemStyle: { color: ctx.resolveColor(seriesKey, 0) },
    };
  });

  const inner = pie?.innerRadius ?? 0;
  const outer = pie?.outerRadius ?? "70%";
  const labelColor = resolveCanvasChartChrome(ctx.chartId).muted;

  const base: EChartsOption = {
    tooltip: { trigger: "item" },
    series: [
      {
        type: "pie",
        radius: [inner, outer],
        data: pieData,
        // Slice name on a leader line by default; values still live in the
        // tooltip and the shared HTML <Legend> footer.
        label: {
          show: pie?.showLabels ?? true,
          color: labelColor,
          fontSize: 12,
          formatter: "{b}",
        },
        labelLine: { show: pie?.showLabels ?? true, length: 10, length2: 8 },
        emphasis: { itemStyle: { shadowBlur: 10 } },
      },
    ],
  };

  return applyChartUiToOption(ctx, base);
}
