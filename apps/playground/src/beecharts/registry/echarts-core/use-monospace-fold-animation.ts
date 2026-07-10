"use client";

import { useEffect, useRef } from "react";
import type { EChartsType } from "echarts/core";
import {
  BEE_MONOSPACE_SERIES_ID,
  CHART_ANIMATION,
  monospaceFoldPatchFields,
  monospaceTargetScale,
  stepMonospaceFold,
} from "./chart-animation-tokens";
import { buildMonospaceFoldRow, type MonospaceDataRow } from "./compile-monospace-bar";

function buildFoldData(
  rows: Record<string, unknown>[],
  dataKey: string,
  scales: number[],
  hoveredIndex: number | null,
): MonospaceDataRow[] {
  const { collapsedScale } = CHART_ANIMATION.monospace;
  return rows.map((row, index) =>
    buildMonospaceFoldRow(
      index,
      Number(row[dataKey] ?? 0),
      scales[index] ?? collapsedScale,
      hoveredIndex === index,
    ),
  );
}

function patchMonospaceSeries(chart: EChartsType, data: MonospaceDataRow[]) {
  chart.setOption(
    {
      series: [
        {
          id: BEE_MONOSPACE_SERIES_ID,
          ...monospaceFoldPatchFields(),
          dimensions: ["x", "value", "foldScale", "showLabel"],
          encode: { x: 0, y: 1 },
          data,
        },
      ],
    },
    { notMerge: false, lazyUpdate: false },
  );
}

export function useMonospaceFoldAnimation({
  chartRef,
  enabled,
  dataKey,
  rows,
  collapsed,
  hoveredIndex,
  chartReadyEpoch,
  chartInstanceEpoch,
}: {
  chartRef: React.RefObject<EChartsType | null>;
  enabled: boolean;
  dataKey: string;
  rows: Record<string, unknown>[];
  collapsed: boolean;
  hoveredIndex: number | null;
  chartReadyEpoch: number;
  chartInstanceEpoch: number;
}) {
  const scalesRef = useRef<number[]>([]);
  const targetsRef = useRef<number[]>([]);
  const hoveredRef = useRef<number | null>(null);
  // Latest rows, read inside the rAF loop; written post-render.
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  });
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);

  useEffect(() => {
    if (!enabled || !chartReadyEpoch || !chartInstanceEpoch || !dataKey) return;

    const currentRows = rowsRef.current;
    const barCount = currentRows.length;
    if (barCount === 0) return;

    if (scalesRef.current.length !== barCount) {
      scalesRef.current = Array.from({ length: barCount }, () => 1);
    }

    hoveredRef.current = hoveredIndex;

    const targets = Array.from({ length: barCount }, (_, i) =>
      monospaceTargetScale(collapsed, hoveredIndex, i),
    );
    targetsRef.current = targets;

    const chart = chartRef.current;
    if (!chart) return;

    cancelAnimationFrame(rafRef.current);
    lastFrameRef.current = performance.now();

    const maxDt = CHART_ANIMATION.monospace.maxFrameDeltaMs;

    const tick = (now: number) => {
      const chartInstance = chartRef.current;
      if (!chartInstance) return;

      const dt = Math.min(maxDt, now - lastFrameRef.current);
      lastFrameRef.current = now;

      let settled = true;
      const { collapsedScale } = CHART_ANIMATION.monospace;
      const nextScales = scalesRef.current.map((current, i) => {
        const target = targetsRef.current[i] ?? collapsedScale;
        const next = stepMonospaceFold(current, target, dt);
        if (next !== target) settled = false;
        return next;
      });
      scalesRef.current = nextScales;

      patchMonospaceSeries(
        chartInstance,
        buildFoldData(rowsRef.current, dataKey, nextScales, hoveredRef.current),
      );

      if (!settled) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [chartRef, enabled, dataKey, rows.length, collapsed, hoveredIndex, chartReadyEpoch, chartInstanceEpoch]);
}
