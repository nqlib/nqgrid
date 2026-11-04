"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBeeEcharts, type BeeChartEventHandlers } from "./use-bee-echarts";
import { subscribeThemeChange } from "./resolve-chart-colors";

type EChartsHostProps = {
  option: EChartsOption;
  className?: string;
  /** Bump when colors need re-resolve after theme toggle */
  colorEpoch?: number;
  onPlotRect?: (insets: { left: number; right: number }) => void;
  eventHandlers?: BeeChartEventHandlers;
  onChartInstance?: (instance: import("echarts/core").EChartsType | null) => void;
};

export function EChartsHost({
  option,
  className,
  colorEpoch = 0,
  onPlotRect,
  eventHandlers,
  onChartInstance,
}: EChartsHostProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => subscribeThemeChange(() => setThemeTick((t) => t + 1)), []);

  const mergedOption = useMemo(() => option, [option, colorEpoch, themeTick]);

  useBeeEcharts(containerRef, mergedOption, [mergedOption], onPlotRect, eventHandlers, onChartInstance);

  return <div ref={containerRef} className={className ?? "min-h-0 h-full w-full min-w-0 flex-1"} />;
}
