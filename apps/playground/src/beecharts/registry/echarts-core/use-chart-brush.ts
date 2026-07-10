"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

export type ChartBrushRange = {
  startIndex: number;
  endIndex: number;
};

export function useChartBrush<TData extends Record<string, unknown>>({
  data,
  defaultStartIndex = 0,
  defaultEndIndex,
  minSpan = 2,
}: {
  data: TData[];
  defaultStartIndex?: number;
  defaultEndIndex?: number;
  minSpan?: number;
}) {
  const [range, setRange] = useState<ChartBrushRange>(() => ({
    startIndex: defaultStartIndex,
    endIndex: defaultEndIndex ?? Math.max(0, data.length - 1),
  }));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRange({
      startIndex: 0,
      endIndex: Math.max(0, data.length - 1),
    });
  }, [data.length]);

  const deferredRange = useDeferredValue(range);

  const visibleData = useMemo(
    () => data.slice(deferredRange.startIndex, deferredRange.endIndex + 1),
    [data, deferredRange.startIndex, deferredRange.endIndex],
  );

  const clampRange = (next: ChartBrushRange): ChartBrushRange => {
    const maxIndex = Math.max(0, data.length - 1);
    let startIndex = Math.max(0, Math.min(next.startIndex, maxIndex));
    let endIndex = Math.max(0, Math.min(next.endIndex, maxIndex));
    if (endIndex - startIndex < minSpan) {
      endIndex = Math.min(maxIndex, startIndex + minSpan);
      if (endIndex - startIndex < minSpan) {
        startIndex = Math.max(0, endIndex - minSpan);
      }
    }
    return { startIndex, endIndex };
  };

  return {
    range,
    visibleData,
    brushProps: {
      startIndex: range.startIndex,
      endIndex: range.endIndex,
      onChange: (next: ChartBrushRange) => setRange(clampRange(next)),
      minSpan,
    },
  };
}
