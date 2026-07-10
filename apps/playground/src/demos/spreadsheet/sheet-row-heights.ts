import { useCallback, useState } from "react";
import { clampRowHeight } from "./sheet-resize-preferences";

/** Per-row height overrides keyed by stable row id (Excel-style individual row resize). */
export function useRowHeightOverrides(defaultHeightPx: number) {
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const getRowHeightPx = useCallback(
    (rowKey: string) => overrides[rowKey] ?? defaultHeightPx,
    [overrides, defaultHeightPx],
  );

  const setRowHeightPx = useCallback((rowKey: string, heightPx: number) => {
    setOverrides((prev) => ({ ...prev, [rowKey]: clampRowHeight(heightPx) }));
  }, []);

  return { getRowHeightPx, setRowHeightPx };
}
