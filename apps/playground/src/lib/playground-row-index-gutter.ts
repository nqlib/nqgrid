import type { CSSProperties } from "react";
import type { Table } from "@tanstack/react-table";
import {
  getFreezePaneCellStickyStyle,
  getPinnedTableCellStickyStyle,
  isLastPinnedColumn,
  usePinnedTableColumns,
  type FreezePaneCellStyleOptions,
  type PinnedLayoutResult,
} from "@nqlib/nqgrid";
import { cn } from "@nqlib/nqui";
import {
  buildPinnedBodyCellFill,
  type TableColorTokens,
} from "./nqgrid-styling";
import {
  gridRowHeaderCellShellClass,
  gridRowHeaderPinnedBodyFillClass,
  gridStickyCellFillClass,
  gridStickyHeadFillClass,
  gridRowHeaderPinnedHeadFillClass,
} from "./grid-styles";
import { mergePinnedCellStyle } from "./pinned-cell-helpers";
import {
  type SelectColumnMode,
  selectColumnUsesRowHeader,
} from "./playground-canonical-select-column";

/**
 * Playground pinning SSOT — the only place demos wire engine sticky geometry to tokens.
 *
 * - Column pin: `usePlaygroundPinnedLayout` + `pinPlaygroundCell`
 * - Excel freeze (column + top row): `pinPlaygroundFreezeCell`
 *
 * Do not call `getPinnedTableCellStickyStyle` / `mergePinnedCellStyle` in demos.
 *
 * Playground terminology
 * ----------------------
 * - **row-index gutter** — left `#` column (TanStack id {@link ROW_INDEX_GUTTER_ID}). Not a data column.
 * - **data column** — any other visible leaf column. Unqualified "column" in skills/docs means this.
 * - **select column** — implementation id for the first TanStack column; may be gutter, checkbox, or full chrome.
 *
 * Pinned gutter fills: `rowHeader.pinnedHeadFill` / `pinnedBodyFill` tokens →
 * `gridRowHeaderPinned*FillClass` in grid-styles.ts (opaque — never reuse translucent gutter fills on sticky cells).
 *
 * Virtual rows + pins: `getVirtualTableRowStyle(startPx)` on `<tr>` — never `transform: translateY`.
 */

/** TanStack column id for the first column (`createSelectColumn`). */
export const ROW_INDEX_GUTTER_ID = "select" as const;

/** True when the row-index gutter should stay sticky at inline-start (index 0). */
export function shouldPinRowIndexGutter(mode?: SelectColumnMode): boolean {
  return selectColumnUsesRowHeader(mode);
}

/** Visible leaf column ids excluding the row-index gutter. */
export function getDataLeafColumnIds<TData>(table: Table<TData>): readonly string[] {
  return table
    .getVisibleLeafColumns()
    .map((c) => c.id)
    .filter((id) => id !== ROW_INDEX_GUTTER_ID);
}

export function usePlaygroundPinnedLayout<TData>(options: {
  table: Table<TData>;
  /** Data column ids to pin left (never includes the row-index gutter). */
  dataPinnedLeftIds?: readonly string[];
  selectColumnMode?: SelectColumnMode;
  /** Read `table.getState().columnPinning.left` instead of `dataPinnedLeftIds`. */
  fromColumnPinning?: boolean;
  widthOverrides?: Readonly<Record<string, number>>;
  defaultWidth?: number;
}): PinnedLayoutResult {
  const {
    table,
    dataPinnedLeftIds = [],
    selectColumnMode,
    fromColumnPinning = false,
    widthOverrides,
    defaultWidth,
  } = options;
  const leadingGutterColumnId = shouldPinRowIndexGutter(selectColumnMode)
    ? ROW_INDEX_GUTTER_ID
    : null;

  return usePinnedTableColumns({
    table,
    ...(fromColumnPinning ? { fromColumnPinning: true } : { pinnedLeftIds: dataPinnedLeftIds }),
    leadingGutterColumnId,
    widthOverrides,
    defaultWidth,
  });
}

/** Excel freeze panes — column + optional top-frozen row sticky with playground opaque fills. */
export function pinPlaygroundFreezeCell(
  options: FreezePaneCellStyleOptions & {
    scrolledX: boolean;
    rowFillTokens?: TableColorTokens;
    rowIndex?: number;
  },
): { style?: CSSProperties; className?: string; "data-pinned"?: true } {
  const { scrolledX, rowFillTokens, rowIndex, ...freezeOpts } = options;
  const pinStyle = getFreezePaneCellStickyStyle(freezeOpts);
  if (!pinStyle) return {};

  const { columnLayout, columnId, variant } = freezeOpts;
  const lastPinned = isLastPinnedColumn(columnLayout, columnId);
  const stickyFill =
    variant === "head"
      ? gridStickyHeadFillClass
      : rowFillTokens != null && rowIndex != null
        ? buildPinnedBodyCellFill(rowFillTokens, rowIndex)
        : gridStickyCellFillClass;

  return {
    style: mergePinnedCellStyle(pinStyle, lastPinned, scrolledX),
    className: cn(stickyFill, lastPinned && scrolledX && "border-r border-border"),
    "data-pinned": true,
  };
}

export function pinPlaygroundCell(options: {
  pinnedLayout: PinnedLayoutResult;
  columnId: string;
  variant: "head" | "body";
  scrolledX: boolean;
  /** Skip generic sticky fills — row-header gutter uses opaque pinned fills instead. */
  rowIndexGutter?: boolean;
  /** Card preset row-fill tokens — pass with `rowIndex` so pinned cells match stripe/solid rows. */
  rowFillTokens?: TableColorTokens;
  rowIndex?: number;
}): { style?: CSSProperties; className?: string; "data-pinned"?: true } {
  const { pinnedLayout, columnId, variant, scrolledX, rowIndexGutter, rowFillTokens, rowIndex } =
    options;
  const pinStyle = getPinnedTableCellStickyStyle(pinnedLayout, columnId, {
    variant,
    headZBase: 48,
    bodyZBase: 10,
  });
  if (!pinStyle) return {};

  const lastPinned = isLastPinnedColumn(pinnedLayout, columnId);
  const stickyFill =
    variant === "head"
      ? rowIndexGutter
        ? gridRowHeaderPinnedHeadFillClass
        : gridStickyHeadFillClass
      : rowIndexGutter
        ? // Row-index gutter: always its own SOLID, uniform fill — never the
          // per-row stripe fill (that's what made the # column appear striped).
          gridRowHeaderPinnedBodyFillClass
        : rowFillTokens != null && rowIndex != null
          ? buildPinnedBodyCellFill(rowFillTokens, rowIndex)
          : gridStickyCellFillClass;

  return {
    style: mergePinnedCellStyle(pinStyle, lastPinned, scrolledX),
    className: cn(
      stickyFill,
      lastPinned && scrolledX && "border-r border-border",
    ),
    "data-pinned": true,
  };
}
