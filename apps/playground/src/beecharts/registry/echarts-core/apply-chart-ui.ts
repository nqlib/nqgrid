import type { ChartConfig } from "@/registry/ui/chart";
import type { EChartsOption } from "echarts";
import { applyChartAnimationToOption } from "./apply-chart-animation";
import { applyChartChromeToOption } from "./apply-chart-chrome";
import { applyTooltipToOption, hideBuiltInLegend } from "./echarts-tooltip";
import type { CompileContext, LegendPart, TooltipPart } from "./parts/types";

export function applyChartUiToOption(
  ctx: CompileContext,
  option: EChartsOption,
): EChartsOption {
  const tooltipPart = ctx.parts.find((p): p is TooltipPart => p.type === "tooltip");
  const legendPart = ctx.parts.find((p): p is LegendPart => p.type === "legend");

  let next = applyChartChromeToOption(ctx.chartId, option, {
    hasHtmlTooltip: Boolean(tooltipPart && !tooltipPart.hide),
  });
  next = applyTooltipToOption(next, ctx.config as ChartConfig, ctx.chartId, tooltipPart);
  if (legendPart) {
    next = hideBuiltInLegend(next);
  }
  next = applyChartAnimationToOption(next);
  return next;
}
