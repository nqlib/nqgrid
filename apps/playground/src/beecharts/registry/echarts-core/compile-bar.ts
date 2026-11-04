/**
 * Pure server-safe bar compiler — maps parts + data to an ECharts option.
 * Never touches `document`, React hooks, or browser APIs.
 */
import type { BarSeriesOption, EChartsOption } from "echarts";
import { applyChartUiToOption } from "./apply-chart-ui";
import { barVariantFill } from "./bar-pattern";
import { resolveAreaFillColor } from "./resolve-chart-colors";
import {
  barItemBorderRadius,
  buildStackCornerRoles,
  resolveBarRadius,
  stackSegmentGapStyle,
  type StackCornerRole,
} from "./bar-radius";
import { resolveCartesianGrid } from "./chart-grid";
import { buildCategoryDataZoom, gridBottomWithZoom } from "./category-data-zoom";
import { buildMonospaceCustomSeries } from "./compile-monospace-bar";
import {
  hoverTraceBlurStyle,
  hoverTraceFocusEmphasis,
  hoverTraceSeriesId,
} from "./hover-trace-bar";
import { categoryValues, getXKey } from "./cartesian-series";
import type { BarSeriesPart, CompileContext } from "./parts/types";

type BarPointItemStyle = {
  color: unknown;
  borderRadius: [number, number, number, number];
  borderWidth?: number | [number, number, number, number];
  borderColor?: string;
};

function normalizeStackPercent(
  data: Record<string, unknown>[],
  keys: string[],
): Record<string, unknown>[] {
  return data.map((row) => {
    const total = keys.reduce((sum, key) => sum + Number(row[key] ?? 0), 0);
    if (total <= 0) return row;
    const next = { ...row };
    for (const key of keys) {
      next[key] = (Number(row[key] ?? 0) / total) * 100;
    }
    return next;
  });
}

function groupStackRoles(
  bars: BarSeriesPart[],
  rows: Record<string, unknown>[],
  defaultStack: string | undefined,
): Map<string, StackCornerRole[]> {
  const rolesByKey = new Map<string, StackCornerRole[]>();
  const groups = new Map<string, BarSeriesPart[]>();

  for (const bar of bars) {
    const stackId = bar.stackId ?? defaultStack;
    if (!stackId) continue;
    const group = groups.get(stackId) ?? [];
    group.push(bar);
    groups.set(stackId, group);
  }

  for (const groupBars of groups.values()) {
    const groupRoles = buildStackCornerRoles(groupBars, rows);
    for (const [dataKey, roles] of groupRoles) {
      rolesByKey.set(dataKey, roles);
    }
  }

  return rolesByKey;
}

function buildBarDataPoints(
  bar: BarSeriesPart,
  ctx: CompileContext,
  rows: Record<string, unknown>[],
  stack: string | undefined,
  horizontal: boolean,
  stackRoles: Map<string, StackCornerRole[]>,
  isHistogram: boolean,
) {
  const r = isHistogram
    ? resolveBarRadius(bar.radius, ctx.cartesian?.barRadius ?? 0)
    : resolveBarRadius(bar.radius, ctx.cartesian?.barRadius);
  const strokeColor = ctx.resolveColor(bar.dataKey, 0);
  const fillColor = resolveAreaFillColor(ctx.config, bar.dataKey, ctx.resolveColor, 0);
  const color = barVariantFill(bar.variant, strokeColor, horizontal, fillColor);
  const effectiveStack = bar.stackId ?? stack;
  const roles = effectiveStack ? stackRoles.get(bar.dataKey) : undefined;

  return rows.map((row, dataIndex) => {
    const value = Number(row[bar.dataKey] ?? 0);
    const role = roles?.[dataIndex];
    const borderRadius = barItemBorderRadius(bar.variant, role, r, horizontal);
    const gapStyle = role != null ? stackSegmentGapStyle(role, horizontal) : {};

    return {
      value,
      itemStyle: {
        color,
        borderRadius,
        ...gapStyle,
      } as BarPointItemStyle,
    };
  });
}

export function compileBarOption(ctx: CompileContext): EChartsOption {
  const xKey = getXKey(ctx);
  const categories = categoryValues(ctx, xKey);
  const bars = ctx.parts.filter((p): p is BarSeriesPart => p.type === "bar");
  const hasGrid = ctx.parts.some((p) => p.type === "grid");
  const hasBrush = ctx.parts.some((p) => p.type === "brush");
  const horizontal = ctx.cartesian?.layout === "horizontal";
  const stack =
    ctx.cartesian?.stackType === "stacked" || ctx.cartesian?.stackType === "percent"
      ? "bee-stack"
      : undefined;
  const barKeys = bars.map((bar) => bar.dataKey);
  const rows =
    ctx.cartesian?.stackType === "percent" ? normalizeStackPercent(ctx.data, barKeys) : ctx.data;

  const categoryAxis = {
    type: "category" as const,
    data: categories,
    axisLine: { show: true },
    axisTick: { show: false },
    ...(ctx.cartesian?.variant === "histogram"
      ? {
          axisLabel: {
            interval: 0,
            hideOverlap: false,
            width: 56,
            overflow: "truncate" as const,
          },
        }
      : {}),
  };
  const valueAxis = {
    type: "value" as const,
    axisLine: { show: false },
    splitLine: { show: hasGrid },
    max: ctx.cartesian?.stackType === "percent" ? 100 : undefined,
    axisLabel: ctx.cartesian?.stackType === "percent" ? { formatter: "{value}%" } : undefined,
  };

  const hasMonospace = bars.some((bar) => bar.variant === "monospace");
  const hasHoverTrace = bars.some((bar) => bar.variant === "hover-trace");
  const isHistogram = ctx.cartesian?.variant === "histogram";
  const stackRoles = groupStackRoles(bars, rows, stack);
  const histogramLayout = isHistogram
    ? { barCategoryGap: 0, barGap: 0, barWidth: "100%" as const }
    : {};
  const stackedLayout = stack
    ? { barGap: 0, barCategoryGap: "20%" as const, barWidth: "55%" as const }
    : {};

  const series = bars.map((bar) => {
    if (bar.variant === "monospace") {
      return buildMonospaceCustomSeries(bar, ctx, rows);
    }

    if (bar.variant === "hover-trace") {
      const color = ctx.resolveColor(bar.dataKey, 0);
      return {
        type: "bar" as const,
        id: hoverTraceSeriesId(bar.dataKey),
        name: ctx.config[bar.dataKey]?.label?.toString() ?? bar.dataKey,
        triggerEvent: true,
        data: buildBarDataPoints(bar, ctx, rows, stack, horizontal, stackRoles, isHistogram) as BarSeriesOption["data"],
        stack: bar.stackId ?? stack,
        blur: hoverTraceBlurStyle,
        emphasis: {
          ...hoverTraceFocusEmphasis,
          itemStyle: { color, opacity: 1 },
        },
        ...histogramLayout,
        ...stackedLayout,
      };
    }

    return {
      type: "bar" as const,
      name: ctx.config[bar.dataKey]?.label?.toString() ?? bar.dataKey,
      data: buildBarDataPoints(bar, ctx, rows, stack, horizontal, stackRoles, isHistogram) as BarSeriesOption["data"],
      stack: bar.stackId ?? stack,
      emphasis: { focus: "series" as const, scale: !isHistogram && !stack },
      ...histogramLayout,
      ...stackedLayout,
    };
  });

  const base: EChartsOption = {
    grid: {
      ...resolveCartesianGrid(
        ctx.parts,
        ctx.cartesian?.externalBrush,
        horizontal ? (hasMonospace ? 32 : 48) : gridBottomWithZoom(hasBrush, hasMonospace ? 32 : 48),
        horizontal,
      ),
      ...(hasHoverTrace && !horizontal ? { left: 56 } : {}),
    },
    tooltip: { trigger: hasMonospace || hasHoverTrace ? "item" : "axis" },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    dataZoom: buildCategoryDataZoom(hasBrush, {
      axisDim: horizontal ? "y" : "x",
      chartVariant: "bar",
    }),
    series,
  };

  return applyChartUiToOption(ctx, base);
}
