"use client";

import { useEffect, useRef } from "react";
import type { EChartsType } from "echarts/core";
import {
  BEE_HOVER_TRACE_GRAPHIC_ID,
  buildHoverTraceGraphic,
  hoverTraceValueAt,
} from "./hover-trace-bar";

function isChartLive(chart: EChartsType | null): chart is EChartsType {
  return Boolean(chart && !(typeof chart.isDisposed === "function" && chart.isDisposed()));
}

function removeHoverTraceGraphic(chart: EChartsType, traceShown: { current: boolean }) {
  if (!traceShown.current) return;

  try {
    chart.setOption(
      { graphic: [{ id: BEE_HOVER_TRACE_GRAPHIC_ID, $action: "remove" }] },
      { notMerge: false, lazyUpdate: false },
    );
  } catch {
    // Graphic may already be gone if the chart replaced options.
  } finally {
    traceShown.current = false;
  }
}

function chartHasPlotGrid(chart: EChartsType): boolean {
  type GridModel = {
    coordinateSystem?: { getRect?: () => { width: number } };
  };
  try {
    const inst = chart as unknown as {
      getModel(): { getComponent(name: string, idx: number): GridModel };
    };
    const rect = inst.getModel().getComponent("grid", 0)?.coordinateSystem?.getRect?.();
    return Boolean(rect && rect.width > 0);
  } catch {
    return false;
  }
}

function patchHoverTraceGraphic(
  chart: EChartsType,
  chartId: string,
  categoryIndex: number,
  traceY: number,
  traceShown: { current: boolean },
) {
  if (!chartHasPlotGrid(chart)) return;

  const graphic = buildHoverTraceGraphic(chart, categoryIndex, traceY, chartId);
  if (!graphic || (Array.isArray(graphic) && graphic.length === 0)) return;

  try {
    chart.setOption({ graphic }, { notMerge: false, lazyUpdate: false });
    traceShown.current = true;
  } catch {
    traceShown.current = false;
  }
}

export function useHoverTraceMarkLine({
  chartRef,
  chartId,
  enabled,
  dataKey,
  rows,
  hoveredIndex,
  chartReadyEpoch,
  chartInstanceEpoch,
  colorEpoch,
}: {
  chartRef: React.RefObject<EChartsType | null>;
  chartId: string;
  enabled: boolean;
  dataKey: string;
  rows: Record<string, unknown>[];
  hoveredIndex: number | null;
  chartReadyEpoch: number;
  chartInstanceEpoch: number;
  colorEpoch: number;
}) {
  // Latest-value mirrors read inside the rAF callback below. Written in an
  // effect (not during render) so the async closure always sees fresh props.
  const hoveredIndexRef = useRef(hoveredIndex);
  const rowsRef = useRef(rows);
  const chartIdRef = useRef(chartId);
  const dataKeyRef = useRef(dataKey);
  useEffect(() => {
    hoveredIndexRef.current = hoveredIndex;
    rowsRef.current = rows;
    chartIdRef.current = chartId;
    dataKeyRef.current = dataKey;
  });
  const traceShownRef = useRef(false);

  const rafRef = useRef(0);
  const applyTraceRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled || !chartReadyEpoch || !chartInstanceEpoch || !dataKey) return;

    const chart = chartRef.current;
    if (!chart) return;

    traceShownRef.current = false;

    const applyTrace = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const instance = chartRef.current;
        if (!isChartLive(instance)) return;

        const hovered = hoveredIndexRef.current;
        if (hovered == null) {
          removeHoverTraceGraphic(instance, traceShownRef);
          return;
        }

        const traceY = hoverTraceValueAt(rowsRef.current, dataKeyRef.current, hovered);
        patchHoverTraceGraphic(
          instance,
          chartIdRef.current,
          hovered,
          traceY,
          traceShownRef,
        );
      });
    };

    applyTraceRef.current = applyTrace;
    chart.on("finished", applyTrace);

    return () => {
      cancelAnimationFrame(rafRef.current);
      chart.off("finished", applyTrace);
      applyTraceRef.current = () => {};
      requestAnimationFrame(() => {
        if (isChartLive(chart)) removeHoverTraceGraphic(chart, traceShownRef);
      });
    };
  }, [chartRef, chartId, enabled, dataKey, chartReadyEpoch, chartInstanceEpoch]);

  useEffect(() => {
    if (!enabled || !chartReadyEpoch || !chartInstanceEpoch) return;
    applyTraceRef.current();
  }, [enabled, chartReadyEpoch, chartInstanceEpoch, hoveredIndex, rows, colorEpoch]);
}
