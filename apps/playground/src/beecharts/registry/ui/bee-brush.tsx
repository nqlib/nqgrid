"use client";

export type { ChartBrushRange } from "@/registry/echarts-core/use-chart-brush";
export { useChartBrush } from "@/registry/echarts-core/use-chart-brush";
export { BeeChartBrush } from "@/registry/echarts-core/bee-chart-brush";

/** @deprecated Use `showBrush` on chart roots — enables the ECharts mini preview brush. */
export function BeeBrush() {
  return null;
}

/** @deprecated Use `useChartBrush` instead. */
export function useBeeBrush<T>({ data }: { data: T[] }) {
  return {
    visibleData: data,
    brushProps: {},
  };
}
