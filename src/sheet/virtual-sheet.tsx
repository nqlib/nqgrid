import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { useSheetViewport } from "./use-sheet-viewport";

export interface VirtualSheetProps {
  rowCount: number;
  columnCount: number;
  frozenColumnCount?: number;
  rowHeight?: number;
  defaultColumnWidth?: number;
  columnWidths?: readonly number[];
  getCellValue: (rowIndex: number, columnIndex: number) => string;
  className?: string;
}

/**
 * Div-based sheet with row/column windowing (sheet mode baseline).
 */
export function VirtualSheet({
  rowCount,
  columnCount,
  frozenColumnCount = 0,
  rowHeight = 28,
  defaultColumnWidth = 72,
  columnWidths: columnWidthsProp,
  getCellValue,
  className,
}: VirtualSheetProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 600, height: 400 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewport({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setViewport({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const columnWidths = useMemo(() => {
    if (columnWidthsProp && columnWidthsProp.length >= columnCount) return columnWidthsProp;
    return Array.from({ length: columnCount }, () => defaultColumnWidth);
  }, [columnCount, columnWidthsProp, defaultColumnWidth]);

  const sheetInput = useMemo(
    () => ({
      rowCount,
      columnCount,
      rowHeight,
      columnWidths,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      frozenColumnCount,
    }),
    [
      rowCount,
      columnCount,
      rowHeight,
      columnWidths,
      viewport.width,
      viewport.height,
      frozenColumnCount,
    ],
  );

  const vp = useSheetViewport(sheetInput);

  const prefix = useMemo(() => {
    const p: number[] = [0];
    for (let i = 0; i < columnWidths.length; i++) {
      p.push(p[p.length - 1]! + (columnWidths[i] ?? 0));
    }
    return p;
  }, [columnWidths]);

  const F = Math.min(frozenColumnCount, columnCount);

  return (
    <div ref={wrapRef} className={className} style={{ minHeight: 320, width: "100%" }}>
      <div
        role="grid"
        tabIndex={0}
        onScroll={vp.onScroll}
        style={{
          overflow: "auto",
          width: "100%",
          height: "100%",
          maxHeight: "min(70dvh, 560px)",
          border: "1px solid var(--border, #ccc)",
          borderRadius: 8,
          position: "relative",
        }}
      >
        <div
          style={{
            width: vp.totalContentWidth,
            height: vp.totalContentHeight,
            position: "relative",
          }}
        >
          {Array.from({ length: vp.rowEnd - vp.rowStart + 1 }, (_, k) => {
            const rowIndex = vp.rowStart + k;
            const top = rowIndex * rowHeight;
            return (
              <div
                key={rowIndex}
                style={{
                  position: "absolute",
                  top,
                  left: 0,
                  height: rowHeight,
                  width: vp.totalContentWidth,
                  display: "flex",
                  borderBottom: "1px solid color-mix(in srgb, var(--border, #ccc) 55%, transparent)",
                }}
              >
                {Array.from({ length: F }, (__, c) => {
                  const w = columnWidths[c] ?? defaultColumnWidth;
                  return (
                    <div
                      key={`f-${c}`}
                      style={{
                        width: w,
                        minWidth: w,
                        flex: "none",
                        position: "sticky",
                        left: prefix[c],
                        zIndex: 3,
                        background: "var(--card, #fff)",
                        boxSizing: "border-box",
                        padding: "2px 6px",
                        fontSize: 12,
                        borderRight: "1px solid color-mix(in srgb, var(--border, #ccc) 55%, transparent)",
                      }}
                    >
                      {getCellValue(rowIndex, c)}
                    </div>
                  );
                })}
                {Array.from({ length: vp.colEnd - vp.colStart + 1 }, (__, i) => {
                  const c = vp.colStart + i;
                  if (c < F) return null;
                  const w = columnWidths[c] ?? defaultColumnWidth;
                  const left = prefix[c] ?? 0;
                  return (
                    <div
                      key={c}
                      style={{
                        position: "absolute",
                        left,
                        width: w,
                        height: "100%",
                        boxSizing: "border-box",
                        padding: "2px 6px",
                        fontSize: 12,
                        borderRight: "1px solid color-mix(in srgb, var(--border, #ccc) 40%, transparent)",
                      }}
                    >
                      {getCellValue(rowIndex, c)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
