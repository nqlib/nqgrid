import { useCallback, useImperativeHandle, useRef, type Ref } from "react";

export interface GridScrollToCellOptions {
  rowIndex: number;
  columnIndex: number;
}

export interface NqgridTableHandle {
  scrollToCell: (opts: GridScrollToCellOptions) => void;
}

/**
 * Imperative handle for table/sheet hosts that own a scroll viewport ref.
 * Caller must implement `scrollToCell` body to scroll the viewport.
 */
export function useGridImperativeHandle(
  ref: Ref<NqgridTableHandle | null> | undefined,
  implementation: (opts: GridScrollToCellOptions) => void,
): void {
  useImperativeHandle(
    ref,
    () => ({
      scrollToCell: (opts) => implementation(opts),
    }),
    [implementation],
  );
}

/** Store viewport + cell metrics; consumer calls measure in layout effect. */
export function useScrollToCellScroller() {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const scrollToCell = useCallback((opts: GridScrollToCellOptions & {
    getRowTop: (rowIndex: number) => number;
    getRowHeight: (rowIndex: number) => number;
    getColumnLeft: (columnIndex: number) => number;
    getColumnWidth: (columnIndex: number) => number;
  }) => {
    const el = viewportRef.current;
    if (!el) return;
    const rowTop = opts.getRowTop(opts.rowIndex);
    const rowH = opts.getRowHeight(opts.rowIndex);
    const colLeft = opts.getColumnLeft(opts.columnIndex);
    const colW = opts.getColumnWidth(opts.columnIndex);

    const targetTop = rowTop - el.clientHeight / 2 + rowH / 2;
    const targetLeft = colLeft - el.clientWidth / 2 + colW / 2;

    el.scrollTo({
      top: Math.max(0, targetTop),
      left: Math.max(0, targetLeft),
      behavior: "smooth",
    });
  }, []);

  return { viewportRef, scrollToCell };
}
