import { useMemo, useState, type UIEvent } from "react";

export interface SheetViewportInput {
  rowCount: number;
  columnCount: number;
  rowHeight: number;
  columnWidths: readonly number[];
  viewportWidth: number;
  viewportHeight: number;
  frozenColumnCount: number;
  scrollTop: number;
  scrollLeft: number;
  rowOverscan?: number;
  colOverscan?: number;
}

export interface SheetViewportRange {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  totalContentWidth: number;
  totalContentHeight: number;
  frozenWidth: number;
}

function buildPrefix(widths: readonly number[]): number[] {
  const p: number[] = [0];
  for (let i = 0; i < widths.length; i++) {
    p.push(p[p.length - 1]! + (widths[i] ?? 0));
  }
  return p;
}

/** Horizontal/vertical windowing math (nqdg-style) without a virtualizer dependency. */
export function computeSheetViewport(input: SheetViewportInput): SheetViewportRange {
  const {
    rowCount,
    columnCount,
    rowHeight,
    columnWidths,
    viewportWidth,
    viewportHeight,
    frozenColumnCount,
    scrollTop,
    scrollLeft,
    rowOverscan = 2,
    colOverscan = 1,
  } = input;

  const F = Math.min(frozenColumnCount, columnCount);
  const widths =
    columnWidths.length >= columnCount
      ? columnWidths
      : [...columnWidths, ...Array.from({ length: columnCount - columnWidths.length }, () => 80)];

  const prefix = buildPrefix(widths);
  const totalContentWidth = prefix[prefix.length - 1] ?? 0;
  const totalContentHeight = rowCount * rowHeight;
  const frozenWidth = prefix[F] ?? 0;

  const firstRow = Math.floor(scrollTop / rowHeight);
  const visibleRows = Math.ceil(viewportHeight / rowHeight) + 1;
  const rowStart = Math.max(0, firstRow - rowOverscan);
  const rowEnd = Math.min(rowCount - 1, firstRow + visibleRows + rowOverscan);

  const viewRight = scrollLeft + viewportWidth;

  let colStart = F;
  let found = false;
  for (let j = F; j < columnCount; j++) {
    if (prefix[j]! < viewRight && prefix[j + 1]! > scrollLeft) {
      colStart = j;
      found = true;
      break;
    }
  }
  if (!found) colStart = Math.min(F, columnCount - 1);

  let colEnd = colStart;
  for (let j = colStart; j < columnCount; j++) {
    if (prefix[j]! < viewRight && prefix[j + 1]! > scrollLeft) colEnd = j;
  }

  colStart = Math.max(F, colStart - colOverscan);
  colEnd = Math.min(columnCount - 1, colEnd + colOverscan);

  return {
    rowStart,
    rowEnd,
    colStart,
    colEnd,
    totalContentWidth,
    totalContentHeight,
    frozenWidth,
  };
}

export function useSheetViewport(
  input: Omit<SheetViewportInput, "scrollTop" | "scrollLeft">,
): SheetViewportRange & {
  scrollTop: number;
  scrollLeft: number;
  setScrollTop: (v: number) => void;
  setScrollLeft: (v: number) => void;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
} {
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const range = useMemo(
    () =>
      computeSheetViewport({
        ...input,
        scrollTop,
        scrollLeft,
      }),
    [input, scrollTop, scrollLeft],
  );

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const t = e.currentTarget;
    setScrollTop(t.scrollTop);
    setScrollLeft(t.scrollLeft);
  };

  return {
    ...range,
    scrollTop,
    scrollLeft,
    setScrollTop,
    setScrollLeft,
    onScroll,
  };
}
