import type { EChartsOption } from "echarts";
import { extractGridInsets } from "./chart-grid";

type SeriesLike = Record<string, unknown> & { type?: string };

function normalizeSeries(series: EChartsOption["series"]): SeriesLike[] {
  if (!series) return [];
  return (Array.isArray(series) ? series : [series]) as SeriesLike[];
}

function hideSingleAxis(
  axis: Record<string, unknown> | undefined,
  preserveLabelSpace = false,
) {
  if (!axis) return axis;

  if (preserveLabelSpace) {
    const axisLabel = (axis.axisLabel as Record<string, unknown> | undefined) ?? {};
    return {
      ...axis,
      show: true,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      name: "",
      axisLabel: {
        ...axisLabel,
        show: true,
        color: "transparent",
      },
    };
  }

  return {
    ...axis,
    show: false,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { show: false },
    splitLine: { show: false },
    name: "",
  };
}

function hideAxisPair(
  axis: unknown,
  preserveLabelSpace = false,
): unknown {
  if (axis == null) return axis;
  if (Array.isArray(axis)) {
    return axis.map((entry) =>
      hideSingleAxis(entry as Record<string, unknown>, preserveLabelSpace),
    );
  }
  return hideSingleAxis(axis as Record<string, unknown>, preserveLabelSpace);
}

/** Strip chrome from a compiled option — keeps grid insets so the mini plot aligns with the main chart. */
export function toMiniPreviewOption(
  option: EChartsOption,
  opts?: { edgeToEdge?: boolean },
): EChartsOption {
  const insets = extractGridInsets(option);
  const edgeToEdge = opts?.edgeToEdge ?? false;
  const series = normalizeSeries(option.series)
    .filter((entry) => String(entry.name ?? "") !== "__wf_placeholder__")
    .map((entry) => ({
      ...entry,
      animation: false,
      animationDuration: 0,
      showSymbol: false,
      label: { show: false, ...(entry.label as Record<string, unknown> | undefined) },
      emphasis: entry.type === "bar" ? { disabled: true } : { scale: false },
    }));

  return {
    ...option,
    backgroundColor: "transparent",
    animation: false,
    animationDuration: 0,
    dataZoom: undefined,
    tooltip: { show: false },
    legend: { show: false },
    grid: edgeToEdge
      ? { left: 0, right: 0, top: 0, bottom: 0, containLabel: false }
      : {
          left: insets.left,
          right: insets.right,
          top: 0,
          bottom: 0,
          containLabel: insets.containLabel,
        },
    xAxis: hideAxisPair(option.xAxis) as EChartsOption["xAxis"],
    yAxis: hideAxisPair(option.yAxis, !edgeToEdge) as EChartsOption["yAxis"],
    series: series as EChartsOption["series"],
  };
}
