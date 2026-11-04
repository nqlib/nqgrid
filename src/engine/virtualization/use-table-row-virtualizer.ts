import { useVirtualizer } from "@tanstack/react-virtual";
import type { Row, Table } from "@tanstack/react-table";
import type { RefObject } from "react";

export interface UseTableRowVirtualizerOptions<TData> {
  table: Table<TData>;
  scrollElement: HTMLElement | null;
  /**
   * Rows to virtualize (typically `useTableRowSections().centerRows`).
   * When omitted, uses `table.getRowModel().rows`.
   */
  rows?: readonly Row<TData>[];
  /** Sum of frozen-top + top-pinned band heights — added to each virtual row `top`. */
  bandOffsetPx?: number;
  /** Fixed row height estimate, or per-index callback for variable row heights. */
  estimateSize?: number | ((index: number) => number);
  overscan?: number;
}

/**
 * Windowed row rendering for TanStack Table + TanStack Virtual.
 * With freeze/pin bands, pass `sections.centerRows` and `bandOffsetPx` from `useTableRowSections`.
 */
export function useTableRowVirtualizer<TData>({
  table,
  scrollElement,
  rows: rowsProp,
  bandOffsetPx = 0,
  estimateSize = 33,
  overscan = 5,
}: UseTableRowVirtualizerOptions<TData>) {
  const rows = rowsProp ?? table.getRowModel().rows;
  const sizeFn =
    typeof estimateSize === "function" ? estimateSize : () => estimateSize ?? 33;
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: sizeFn,
    getScrollElement: () => scrollElement,
    overscan,
  });

  return {
    rows,
    rowVirtualizer,
    virtualRows: rowVirtualizer.getVirtualItems(),
    totalSize: rowVirtualizer.getTotalSize(),
    /** Total tbody scroll height including top band offset. */
    totalSizeWithBandOffset: rowVirtualizer.getTotalSize() + bandOffsetPx,
    bandOffsetPx,
    measureElement: rowVirtualizer.measureElement,
  };
}

export type TableScrollRef = RefObject<HTMLElement | null>;
