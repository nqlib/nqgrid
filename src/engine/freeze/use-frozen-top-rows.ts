import { useMemo } from "react";
import type { Row, Table } from "@tanstack/react-table";

import type { FreezePanesState } from "./freeze-panes";
import {
  computeFrozenTopLayout,
  resolveFrozenTopPrefix,
  type FrozenTopLayoutResult,
} from "./frozen-rows-layout";

export interface UseFrozenTopRowsOptions<TData> {
  table: Table<TData>;
  /** Body rows to freeze at top (Excel prefix count). */
  frozenTopBodyRowCount?: number;
  /** Full freeze state — overrides `frozenTopBodyRowCount` when set. */
  freezePanes?: Pick<FreezePanesState, "frozenTopBodyRowCount">;
  /** Rows to compute layout from (default: `table.getRowModel().rows`). */
  rows?: readonly Row<TData>[];
  getHeightPx?: (rowId: string) => number;
  defaultHeight?: number;
}

export interface FrozenTopRowsResult<TData> {
  readonly frozenTopRows: readonly Row<TData>[];
  readonly frozenTopRowIds: readonly string[];
  readonly layout: FrozenTopLayoutResult;
}

/**
 * Resolves Excel-style prefix-frozen body rows and sticky row geometry.
 */
export function useFrozenTopRows<TData>({
  table,
  frozenTopBodyRowCount: countProp = 0,
  freezePanes,
  rows: rowsProp,
  getHeightPx: getHeightPxProp,
  defaultHeight = 33,
}: UseFrozenTopRowsOptions<TData>): FrozenTopRowsResult<TData> {
  const frozenTopBodyRowCount =
    freezePanes?.frozenTopBodyRowCount ?? countProp;

  const rows = rowsProp ?? table.getRowModel().rows;
  const visibleRowIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const frozenTopRowIds = useMemo(() => {
    if (frozenTopBodyRowCount <= 0) return [] as const;
    const requested = visibleRowIds.slice(0, frozenTopBodyRowCount);
    return resolveFrozenTopPrefix(visibleRowIds, requested);
  }, [visibleRowIds, frozenTopBodyRowCount]);

  const frozenTopRows = useMemo(
    () => rows.filter((r) => frozenTopRowIds.includes(r.id)),
    [rows, frozenTopRowIds],
  );

  const layout = useMemo(() => {
    const getHeightPx =
      getHeightPxProp ??
      ((_id: string) => defaultHeight);
    return computeFrozenTopLayout(visibleRowIds, frozenTopRowIds, getHeightPx);
  }, [visibleRowIds, frozenTopRowIds, getHeightPxProp, defaultHeight]);

  return { frozenTopRows, frozenTopRowIds, layout };
}
