import type { EChartsOption } from "echarts";
import { applyChartUiToOption } from "./apply-chart-ui";
import { resolveCartesianGrid } from "./chart-grid";
import { buildCategoryDataZoom, gridBottomWithZoom } from "./category-data-zoom";
import type { CompileContext, WaterfallPart, WaterfallRow } from "./parts/types";

export function compileWaterfallOption(ctx: CompileContext): EChartsOption {
  const wf = ctx.parts.find((p): p is WaterfallPart => p.type === "waterfall");
  const nameKey = wf?.nameKey ?? ctx.nameKey ?? "name";
  const valueKey = wf?.valueKey ?? ctx.valueKey ?? "value";
  const typeKey = wf?.typeKey ?? "type";
  const hasGrid = ctx.parts.some((p) => p.type === "grid");
  const hasBrush = ctx.parts.some((p) => p.type === "brush");

  const rows = ctx.data as WaterfallRow[];
  let running = 0;
  const placeholders: number[] = [];
  const values: number[] = [];
  const categories: string[] = [];
  const colors: string[] = [];

  for (const row of rows) {
    const record = row as Record<string, unknown>;
    const name = String(record[nameKey] ?? "");
    const value = Number(record[valueKey] ?? 0);
    const kind = (record[typeKey] ?? record.type) as WaterfallRow["type"];
    categories.push(ctx.config[name]?.label?.toString() ?? name);

    if (kind === "start" || kind === "total") {
      placeholders.push(0);
      values.push(value);
      running = value;
    } else if (value < 0) {
      placeholders.push(running + value);
      values.push(-value);
      running += value;
    } else {
      placeholders.push(running);
      values.push(value);
      running += value;
    }
    colors.push(ctx.resolveColor(name, 0));
  }

  const base: EChartsOption = {
    grid: resolveCartesianGrid(ctx.parts, ctx.cartesian?.externalBrush, gridBottomWithZoom(hasBrush)),
    tooltip: { trigger: "axis" },
    legend: { show: false },
    xAxis: { type: "category", data: categories },
    yAxis: { type: "value", splitLine: { show: hasGrid } },
    dataZoom: buildCategoryDataZoom(hasBrush, { chartVariant: "waterfall" }),
    series: [
      {
        type: "bar",
        name: "__wf_placeholder__",
        stack: "wf",
        silent: true,
        animation: false,
        itemStyle: { color: "rgba(0,0,0,0)", borderColor: "rgba(0,0,0,0)" },
        emphasis: { disabled: true },
        tooltip: { show: false },
        data: placeholders,
      },
      {
        type: "bar",
        name: "__wf_values__",
        stack: "wf",
        data: values.map((v, i) => ({
          value: v,
          itemStyle: { color: colors[i], borderRadius: [4, 4, 0, 0] },
        })),
      },
    ],
  };

  return applyChartUiToOption(ctx, base);
}
