import type { EChartsOption } from "echarts";
import { getColorsCount } from "@/registry/ui/chart";
import { applyChartUiToOption } from "./apply-chart-ui";
import type { CompileContext, RadialBarPart } from "./parts/types";
import { resolveCanvasChartChrome } from "./resolve-chart-chrome";

const DEFAULT_INNER_RADIUS = "30%";
const DEFAULT_OUTER_RADIUS = "100%";
const DEFAULT_CORNER_RADIUS = 5;
const DEFAULT_BAR_SIZE = 14;

function getNameKey(ctx: CompileContext): string {
  if (ctx.nameKey) return ctx.nameKey;
  return Object.keys(ctx.data[0] ?? {})[0] ?? "name";
}

function configKeyFromRow(row: Record<string, unknown>, nameKey: string): string {
  return String(row[nameKey] ?? "");
}

function itemColor(configKey: string, ctx: CompileContext): string | object {
  const entry = ctx.config[configKey];
  const count = entry ? getColorsCount(entry) : 1;
  if (count <= 1) return ctx.resolveColor(configKey, 0);

  return {
    type: "linear",
    x: 0,
    y: 0,
    x2: 1,
    y2: 1,
    colorStops: Array.from({ length: count }, (_, i) => ({
      offset: i / (count - 1),
      color: ctx.resolveColor(configKey, i),
    })),
  };
}

function shadowColorFromItem(color: string | object, configKey: string, ctx: CompileContext): string {
  return typeof color === "string" ? color : ctx.resolveColor(configKey, 0);
}

function variantAngles(semi: boolean) {
  if (semi) {
    return { startAngle: 180, endAngle: 0, center: ["50%", "70%"] as [string, string] };
  }
  return { startAngle: 90, endAngle: -270, center: ["50%", "50%"] as [string, string] };
}

export function compileRadialBarOption(ctx: CompileContext): EChartsOption {
  const radial = ctx.parts.find((p): p is RadialBarPart => p.type === "radialBar");
  const valueKey = radial?.dataKey ?? "value";
  const nameKey = getNameKey(ctx);
  const semi = ctx.radial?.radialVariant === "semi";
  const { startAngle, endAngle, center } = variantAngles(semi);

  const innerRadius = ctx.radial?.radialInnerRadius ?? DEFAULT_INNER_RADIUS;
  const outerRadius = ctx.radial?.radialOuterRadius ?? DEFAULT_OUTER_RADIUS;
  const cornerRadius = radial?.cornerRadius ?? DEFAULT_CORNER_RADIUS;
  const barSize = radial?.barSize ?? DEFAULT_BAR_SIZE;
  const showBackground = radial?.showBackground ?? true;
  const glowingBars = new Set(radial?.glowingBars ?? []);

  const chrome = resolveCanvasChartChrome(ctx.chartId);
  const trackColor = chrome.splitLine;

  const categories = ctx.data.map((row) => {
    const key = configKeyFromRow(row, nameKey);
    return ctx.config[key]?.label?.toString() ?? key;
  });

  const numericValues = ctx.data.map((row) => Number(row[valueKey] ?? 0));
  const angleMax = Math.max(...numericValues, 1);

  const showLabels = radial?.showLabels ?? true;

  const seriesData = ctx.data.map((row, i) => {
    const configKey = configKeyFromRow(row, nameKey);
    const color = itemColor(configKey, ctx);
    const glowing = glowingBars.has(configKey);
    const shadowColor = shadowColorFromItem(color, configKey, ctx);

    return {
      value: numericValues[i],
      itemStyle: {
        color,
        borderRadius: cornerRadius,
        ...(glowing
          ? { shadowBlur: 12, shadowColor, shadowOffsetX: 0, shadowOffsetY: 0 }
          : {}),
      },
    };
  });

  const base: EChartsOption = {
    tooltip: { trigger: "item" },
    polar: {
      center,
      radius: [innerRadius, outerRadius],
    },
    /** Arc length — one row fills `(value / max) × sweep`. */
    angleAxis: {
      type: "value",
      min: 0,
      max: angleMax,
      startAngle,
      endAngle,
      clockwise: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    },
    /** Concentric ring per category (innermost row first). */
    radiusAxis: {
      type: "category",
      data: categories,
      // Draw labels above the arcs and halo each glyph with the chart
      // background so the ring name stays legible whether it sits over a
      // coloured arc, the muted track, or an empty gap.
      z: 10,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        show: showLabels,
        // Show every ring name — a category axis otherwise auto-thins labels
        // it thinks collide, which is why only a couple appeared.
        interval: 0,
        color: chrome.foreground,
        fontSize: 11,
        fontWeight: 500,
        textBorderColor: chrome.background,
        textBorderWidth: 3,
      },
      splitLine: { show: false },
    },
    series: [
      {
        type: "bar",
        coordinateSystem: "polar",
        data: seriesData,
        barWidth: barSize,
        roundCap: true,
        showBackground,
        backgroundStyle: {
          color: trackColor,
          opacity: 0.35,
          borderRadius: cornerRadius,
        },
        label: { show: false },
        emphasis: {
          focus: "self",
          itemStyle: {
            shadowBlur: 16,
          },
        },
      },
    ],
  };

  return applyChartUiToOption(ctx, base);
}

/** Nightingale rose — category on angle, value as radial length (petals from center). */
export function compileRoseBarOption(ctx: CompileContext): EChartsOption {
  const radial = ctx.parts.find((p): p is RadialBarPart => p.type === "radialBar");
  const valueKey = radial?.dataKey ?? "value";
  const nameKey = getNameKey(ctx);
  const semi = ctx.radial?.radialVariant === "semi";
  const { startAngle, endAngle, center } = variantAngles(semi);

  const innerRadius = ctx.radial?.radialInnerRadius ?? 0;
  const outerRadius = ctx.radial?.radialOuterRadius ?? DEFAULT_OUTER_RADIUS;
  const cornerRadius = radial?.cornerRadius ?? DEFAULT_CORNER_RADIUS;
  const barSize = radial?.barSize;
  const showBackground = radial?.showBackground ?? false;
  const glowingBars = new Set(radial?.glowingBars ?? []);

  const chrome = resolveCanvasChartChrome(ctx.chartId);
  const trackColor = chrome.splitLine;

  const categories = ctx.data.map((row) => {
    const key = configKeyFromRow(row, nameKey);
    return ctx.config[key]?.label?.toString() ?? key;
  });

  const numericValues = ctx.data.map((row) => Number(row[valueKey] ?? 0));
  const radiusMax = Math.max(...numericValues, 1) * 1.05;

  const seriesData = ctx.data.map((row, i) => {
    const configKey = configKeyFromRow(row, nameKey);
    const color = itemColor(configKey, ctx);
    const glowing = glowingBars.has(configKey);
    const shadowColor = shadowColorFromItem(color, configKey, ctx);

    return {
      value: numericValues[i],
      name: categories[i],
      itemStyle: {
        color,
        borderRadius: cornerRadius,
        ...(glowing
          ? { shadowBlur: 12, shadowColor, shadowOffsetX: 0, shadowOffsetY: 0 }
          : {}),
      },
    };
  });

  const base: EChartsOption = {
    tooltip: { trigger: "item" },
    polar: {
      center,
      radius: innerRadius === 0 ? outerRadius : [innerRadius, outerRadius],
    },
    angleAxis: {
      type: "category",
      data: categories,
      startAngle,
      endAngle,
      clockwise: true,
      axisLine: { show: false },
      axisTick: { show: false },
      // Name each petal by default; opt out with <RadialBar showLabels={false} />.
      axisLabel: {
        show: radial?.showLabels ?? true,
        color: chrome.muted,
        fontSize: 11,
      },
      splitLine: { show: false },
    },
    radiusAxis: {
      type: "value",
      min: 0,
      max: radiusMax,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    },
    series: [
      {
        type: "bar",
        coordinateSystem: "polar",
        data: seriesData,
        ...(barSize != null ? { barWidth: barSize } : {}),
        roundCap: true,
        showBackground,
        backgroundStyle: showBackground
          ? {
              color: trackColor,
              opacity: 0.35,
              borderRadius: cornerRadius,
            }
          : undefined,
        emphasis: {
          focus: "self",
          itemStyle: {
            shadowBlur: 16,
          },
        },
      },
    ],
  };

  return applyChartUiToOption(ctx, base);
}
