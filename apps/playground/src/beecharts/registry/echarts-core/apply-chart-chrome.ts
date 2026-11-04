import type { EChartsOption } from "echarts";
import type { ChartChromeColors } from "./resolve-chart-chrome";
import { resolveCanvasChartChrome } from "./resolve-chart-chrome";

type AxisLike = Record<string, unknown>;

function mergeLineStyle(
  existing: Record<string, unknown> | undefined,
  color: string,
  defaults?: Record<string, unknown>,
): Record<string, unknown> {
  return { ...defaults, color, ...existing };
}

function themeCartesianAxis(axis: AxisLike, chrome: ChartChromeColors): AxisLike {
  const splitLine = (axis.splitLine as AxisLike | undefined) ?? {};
  const splitLineStyle = (splitLine.lineStyle as Record<string, unknown> | undefined) ?? {};
  const axisLine = (axis.axisLine as AxisLike | undefined) ?? {};
  const axisLineStyle = (axisLine.lineStyle as Record<string, unknown> | undefined) ?? {};
  const axisLabel = (axis.axisLabel as AxisLike | undefined) ?? {};
  const axisTick = (axis.axisTick as AxisLike | undefined) ?? {};
  const axisTickLineStyle = (axisTick.lineStyle as Record<string, unknown> | undefined) ?? {};
  const nameTextStyle = (axis.nameTextStyle as Record<string, unknown> | undefined) ?? {};
  const splitArea = (axis.splitArea as AxisLike | undefined) ?? {};
  const splitAreaStyle = (splitArea.areaStyle as Record<string, unknown> | undefined) ?? {};

  return {
    ...axis,
    axisLine: {
      ...axisLine,
      lineStyle: mergeLineStyle(axisLineStyle, chrome.border),
    },
    axisLabel: {
      color: chrome.muted,
      ...axisLabel,
    },
    axisTick: {
      ...axisTick,
      lineStyle: mergeLineStyle(axisTickLineStyle, chrome.border),
    },
    nameTextStyle: {
      color: chrome.muted,
      ...nameTextStyle,
    },
    splitLine: {
      ...splitLine,
      lineStyle: mergeLineStyle(splitLineStyle, chrome.splitLine, {
        type: "dashed",
        opacity: 0.45,
      }),
    },
    splitArea: splitArea.show
      ? {
          ...splitArea,
          areaStyle: {
            color: [chrome.splitLine, "transparent"],
            opacity: 0.06,
            ...splitAreaStyle,
          },
        }
      : splitArea,
  };
}

function themeAxes(value: unknown, chrome: ChartChromeColors): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((axis) => themeCartesianAxis(axis as AxisLike, chrome));
  }
  if (typeof value === "object") {
    return themeCartesianAxis(value as AxisLike, chrome);
  }
  return value;
}

function themeRadar(radar: EChartsOption["radar"], chrome: ChartChromeColors): EChartsOption["radar"] {
  if (!radar || Array.isArray(radar)) return radar;
  const r = radar as AxisLike;
  const splitLine = (r.splitLine as AxisLike | undefined) ?? {};
  const splitLineStyle = (splitLine.lineStyle as Record<string, unknown> | undefined) ?? {};
  const axisLine = (r.axisLine as AxisLike | undefined) ?? {};
  const axisLineStyle = (axisLine.lineStyle as Record<string, unknown> | undefined) ?? {};
  const axisName = (r.axisName as AxisLike | undefined) ?? {};

  return {
    ...r,
    axisName: { color: chrome.muted, ...axisName },
    axisLine: {
      ...axisLine,
      lineStyle: mergeLineStyle(axisLineStyle, chrome.border),
    },
    splitLine: {
      ...splitLine,
      lineStyle: mergeLineStyle(splitLineStyle, chrome.splitLine, {
        type: "dashed",
        opacity: 0.45,
      }),
    },
    splitArea: {
      areaStyle: { color: [chrome.splitLine, "transparent"], opacity: 0.05 },
      ...(r.splitArea as AxisLike | undefined),
    },
  };
}

function themeLegend(legend: EChartsOption["legend"], chrome: ChartChromeColors): EChartsOption["legend"] {
  if (!legend) return legend;
  const apply = (entry: AxisLike) => ({
    ...entry,
    textStyle: { color: chrome.muted, ...(entry.textStyle as Record<string, unknown> | undefined) },
    pageTextStyle: { color: chrome.muted, ...(entry.pageTextStyle as Record<string, unknown> | undefined) },
  });
  if (Array.isArray(legend)) return legend.map((l) => apply(l as AxisLike));
  return apply(legend as AxisLike);
}

/** Canvas-safe slider tints — ECharts cannot parse oklch() filler colors. */
function sliderTrackColors() {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  return isDark
    ? {
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        fillerColor: "rgba(255, 255, 255, 0.12)",
        borderColor: "rgba(255, 255, 255, 0.14)",
        handleColor: "#a1a1aa",
        handleBorder: "rgba(255, 255, 255, 0.22)",
      }
    : {
        backgroundColor: "rgba(0, 0, 0, 0.04)",
        fillerColor: "rgba(0, 0, 0, 0.08)",
        borderColor: "rgba(0, 0, 0, 0.1)",
        handleColor: "#71717a",
        handleBorder: "rgba(0, 0, 0, 0.16)",
      };
}

function themeDataZoom(dataZoom: EChartsOption["dataZoom"], chrome: ChartChromeColors) {
  if (!dataZoom) return dataZoom;
  const items = Array.isArray(dataZoom) ? dataZoom : [dataZoom];
  const sliderColors = sliderTrackColors();

  return items.map((entry) => {
    const e = entry as AxisLike;
    const isSlider = e.type === "slider";
    const handleStyle = {
      color: sliderColors.handleColor,
      borderColor: sliderColors.handleBorder,
      borderWidth: 1,
      shadowBlur: 2,
      shadowColor: sliderColors.fillerColor,
      ...(e.handleStyle as Record<string, unknown> | undefined),
    };

    if (!isSlider) {
      return {
        ...e,
        textStyle: { color: chrome.muted, ...(e.textStyle as Record<string, unknown> | undefined) },
      };
    }

    // Series-colored mini preview via showDataShadow — track uses canvas-safe rgba only.
    return {
      ...e,
      textStyle: { color: chrome.muted, ...(e.textStyle as Record<string, unknown> | undefined) },
      borderColor: sliderColors.borderColor,
      backgroundColor: sliderColors.backgroundColor,
      fillerColor: sliderColors.fillerColor,
      handleStyle,
      moveHandleStyle: handleStyle,
      emphasis: {
        handleStyle: {
          ...handleStyle,
          color: sliderColors.handleColor,
          borderColor: sliderColors.handleBorder,
        },
        ...(e.emphasis as Record<string, unknown> | undefined),
      },
    };
  });
}

function themeCalendar(calendar: EChartsOption["calendar"], chrome: ChartChromeColors) {
  if (!calendar) return calendar;
  const isArray = Array.isArray(calendar);
  const items = isArray ? calendar : [calendar];
  const themed = items.map((entry) => {
    const c = entry as AxisLike;
    const dayLabel = (c.dayLabel as AxisLike | undefined) ?? {};
    const monthLabel = (c.monthLabel as AxisLike | undefined) ?? {};
    const yearLabel = (c.yearLabel as AxisLike | undefined) ?? {};
    return {
      ...c,
      dayLabel: { color: chrome.muted, ...dayLabel },
      monthLabel: { color: chrome.muted, ...monthLabel },
      yearLabel: { color: chrome.muted, ...yearLabel },
    };
  });
  return (isArray ? themed : themed[0]) as EChartsOption["calendar"];
}

function themeVisualMap(visualMap: EChartsOption["visualMap"], chrome: ChartChromeColors) {
  if (!visualMap) return visualMap;
  const items = Array.isArray(visualMap) ? visualMap : [visualMap];
  return items.map((entry) => {
    const e = entry as AxisLike;
    return {
      ...e,
      textStyle: { color: chrome.muted, ...(e.textStyle as Record<string, unknown> | undefined) },
      borderColor: chrome.border,
    };
  });
}

function themeSpecialSeries(series: EChartsOption["series"], chrome: ChartChromeColors) {
  if (!series) return series;
  const items = Array.isArray(series) ? series : [series];
  return items.map((entry) => {
    const s = entry as AxisLike;
    if (s.type === "pie") {
      const label = (s.label as AxisLike | undefined) ?? {};
      const labelLine = (s.labelLine as AxisLike | undefined) ?? {};
      const labelLineStyle = (labelLine.lineStyle as Record<string, unknown> | undefined) ?? {};
      return {
        ...s,
        label: { color: chrome.muted, ...label },
        labelLine: {
          ...labelLine,
          lineStyle: mergeLineStyle(labelLineStyle, chrome.border),
        },
      };
    }
    if (s.type === "funnel") {
      const label = (s.label as AxisLike | undefined) ?? {};
      const labelLine = (s.labelLine as AxisLike | undefined) ?? {};
      const labelLineStyle = (labelLine.lineStyle as Record<string, unknown> | undefined) ?? {};
      const itemStyle = (s.itemStyle as Record<string, unknown> | undefined) ?? {};
      const position = label.position ?? "inside";
      const labelColor =
        position === "inside" ? (label.color ?? "#fafafa") : (label.color ?? chrome.muted);
      const data = Array.isArray(s.data)
        ? (s.data as AxisLike[]).map((row) => {
            const rowStyle = (row.itemStyle as Record<string, unknown> | undefined) ?? {};
            return {
              ...row,
              itemStyle: { borderColor: chrome.background, ...rowStyle },
            };
          })
        : s.data;
      return {
        ...s,
        data,
        itemStyle: { borderColor: chrome.background, ...itemStyle },
        label: { color: labelColor, ...label },
        labelLine: labelLine.show
          ? {
              ...labelLine,
              lineStyle: mergeLineStyle(labelLineStyle, chrome.border),
            }
          : labelLine,
      };
    }
    if (s.type === "treemap") {
      const itemStyle = (s.itemStyle as Record<string, unknown> | undefined) ?? {};
      return {
        ...s,
        itemStyle: { borderColor: chrome.background, ...itemStyle },
      };
    }
    if (s.type !== "gauge") return entry;
    const detail = (s.detail as AxisLike | undefined) ?? {};
    const title = (s.title as AxisLike | undefined) ?? {};
    const axisLine = (s.axisLine as AxisLike | undefined) ?? {};
    const axisLineStyle = (axisLine.lineStyle as Record<string, unknown> | undefined) ?? {};
    return {
      ...s,
      detail: { color: chrome.foreground, ...detail },
      title: { color: chrome.muted, ...title },
      axisLabel: {
        color: chrome.muted,
        ...(s.axisLabel as AxisLike | undefined),
      },
      axisTick: {
        lineStyle: { color: chrome.border },
        ...(s.axisTick as AxisLike | undefined),
      },
      splitLine: {
        lineStyle: { color: chrome.splitLine, opacity: 0.45 },
        ...(s.splitLine as AxisLike | undefined),
      },
      axisLine: {
        ...axisLine,
        lineStyle: {
          ...axisLineStyle,
          color: axisLineStyle.color ?? chrome.border,
        },
      },
    };
  });
}

function themeNativeTooltip(
  tooltip: EChartsOption["tooltip"],
  chrome: ChartChromeColors,
  hasHtmlTooltip: boolean,
): EChartsOption["tooltip"] {
  if (hasHtmlTooltip || !tooltip || Array.isArray(tooltip)) return tooltip;
  const t = tooltip as AxisLike;
  const backgroundColor =
    typeof t.backgroundColor === "string" ? t.backgroundColor : chrome.popover;
  const borderColor = typeof t.borderColor === "string" ? t.borderColor : chrome.border;

  return {
    ...t,
    backgroundColor,
    borderColor,
    textStyle: {
      color: chrome.popoverForeground,
      ...(t.textStyle as Record<string, unknown> | undefined),
    },
  };
}

export function applyChartChromeToOption(
  chartId: string,
  option: EChartsOption,
  options?: { hasHtmlTooltip?: boolean },
): EChartsOption {
  const chrome = resolveCanvasChartChrome(chartId);
  const hasHtmlTooltip = options?.hasHtmlTooltip ?? false;

  return {
    ...option,
    backgroundColor: "transparent",
    textStyle: { color: chrome.foreground, ...(option.textStyle as Record<string, unknown> | undefined) },
    xAxis: themeAxes(option.xAxis, chrome) as EChartsOption["xAxis"],
    yAxis: themeAxes(option.yAxis, chrome) as EChartsOption["yAxis"],
    angleAxis: themeAxes(option.angleAxis, chrome) as EChartsOption["angleAxis"],
    radiusAxis: themeAxes(option.radiusAxis, chrome) as EChartsOption["radiusAxis"],
    radar: themeRadar(option.radar, chrome),
    calendar: themeCalendar(option.calendar, chrome) as EChartsOption["calendar"],
    legend: themeLegend(option.legend, chrome),
    tooltip: themeNativeTooltip(option.tooltip, chrome, hasHtmlTooltip),
    dataZoom: themeDataZoom(option.dataZoom, chrome) as EChartsOption["dataZoom"],
    visualMap: themeVisualMap(option.visualMap, chrome) as EChartsOption["visualMap"],
    series: themeSpecialSeries(option.series, chrome) as EChartsOption["series"],
  };
}
