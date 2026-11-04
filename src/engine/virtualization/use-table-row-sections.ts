import { useMemo } from "react";
import type { Row, Table } from "@tanstack/react-table";

import { sumBandHeightsPx } from "../freeze/freeze-panes";
import type { FreezePanesState } from "../freeze/freeze-panes";
import type { FrozenTopLayoutResult } from "../freeze/frozen-rows-layout";
import { useFrozenTopRows, type FrozenTopRowsResult } from "../freeze/use-frozen-top-rows";
import { tableSupportsRowPinning } from "../pinning/row-pinning";

export interface TableRowSections<TData> {
  /** All rows from the active row model (reference). */
  readonly allRows: readonly Row<TData>[];
  /** Excel prefix-frozen body rows (first N). */
  readonly frozenTopRows: readonly Row<TData>[];
  /** TanStack top-pinned rows not already in `frozenTopRows`. */
  readonly topPinnedRows: readonly Row<TData>[];
  /** Rows to pass to the row virtualizer. */
  readonly centerRows: readonly Row<TData>[];
  /** TanStack bottom-pinned rows. */
  readonly bottomPinnedRows: readonly Row<TData>[];
  readonly frozenTop: FrozenTopRowsResult<TData>;
  /** Sum of frozen top + top-pinned row heights (px). */
  readonly topBandHeightPx: number;
  /** Header offset for sticky top on body cells (px). */
  readonly headerOffsetPx: number;
}

export interface UseTableRowSectionsOptions<TData> {
  table: Table<TData>;
  freezePanes?: Pick<FreezePanesState, "frozenTopBodyRowCount" | "headerRowCount">;
  frozenTopBodyRowCount?: number;
  /** Height of each thead row (default: single row at `headerRowHeightPx`). */
  headerRowCount?: number;
  headerRowHeightPx?: number;
  rowHeightPx?: number;
  getRowHeightPx?: (rowId: string) => number;
}

function dedupeTopPinned<TData>(
  frozenTopRows: readonly Row<TData>[],
  topPinned: readonly Row<TData>[],
): readonly Row<TData>[] {
  const frozenIds = new Set(frozenTopRows.map((r) => r.id));
  return topPinned.filter((r) => !frozenIds.has(r.id));
}

/**
 * Splits the row model into render bands: frozen prefix, TanStack top pin, center (virtual), bottom pin.
 */
export function useTableRowSections<TData>({
  table,
  freezePanes,
  frozenTopBodyRowCount = 0,
  headerRowCount: headerCountProp,
  headerRowHeightPx = 33,
  rowHeightPx = 33,
  getRowHeightPx,
}: UseTableRowSectionsOptions<TData>): TableRowSections<TData> {
  const headerRowCount = freezePanes?.headerRowCount ?? headerCountProp ?? 1;
  const frozenCount = freezePanes?.frozenTopBodyRowCount ?? frozenTopBodyRowCount;
  const headerOffsetPx = headerRowCount * headerRowHeightPx;

  const getHeight =
    getRowHeightPx ?? ((_id: string) => rowHeightPx);

  const allRows = table.getRowModel().rows;
  const frozenTop = useFrozenTopRows({
    table,
    freezePanes: { frozenTopBodyRowCount: frozenCount },
    rows: allRows,
    getHeightPx: getHeight,
    defaultHeight: rowHeightPx,
  });

  const pinningEnabled = tableSupportsRowPinning(table);

  const topPinnedRows = useMemo(() => {
    if (!pinningEnabled) return [] as const;
    const top = table.getTopRows();
    return dedupeTopPinned(frozenTop.frozenTopRows, top);
  }, [table, pinningEnabled, frozenTop.frozenTopRows]);

  const bottomPinnedRows = useMemo(() => {
    if (!pinningEnabled) return [] as const;
    return table.getBottomRows();
  }, [table, pinningEnabled, allRows, table.getState().rowPinning]);

  const centerRows = useMemo(() => {
    const frozenIds = new Set(frozenTop.frozenTopRowIds);
    const base = pinningEnabled ? table.getCenterRows() : allRows;
    return base.filter((r) => !frozenIds.has(r.id));
  }, [table, pinningEnabled, allRows, frozenTop.frozenTopRowIds, table.getState().rowPinning]);

  const topBandHeightPx = useMemo(() => {
    const frozenHeights = frozenTop.frozenTopRows.map((r) => getHeight(r.id));
    const pinnedHeights = topPinnedRows.map((r) => getHeight(r.id));
    return sumBandHeightsPx([...frozenHeights, ...pinnedHeights]);
  }, [frozenTop.frozenTopRows, topPinnedRows, getHeight]);

  return {
    allRows,
    frozenTopRows: frozenTop.frozenTopRows,
    topPinnedRows,
    centerRows,
    bottomPinnedRows,
    frozenTop,
    topBandHeightPx,
    headerOffsetPx,
  };
}

/** Map center-band virtual index back to a TanStack row. */
export function getCenterRowAtVirtualIndex<TData>(
  sections: Pick<TableRowSections<TData>, "centerRows">,
  virtualIndex: number,
): Row<TData> | undefined {
  return sections.centerRows[virtualIndex];
}

export function computeFrozenTopLayoutFromSections<TData>(
  sections: TableRowSections<TData>,
): FrozenTopLayoutResult {
  return sections.frozenTop.layout;
}
