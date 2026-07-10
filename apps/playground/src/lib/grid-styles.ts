/**
 * Spreadsheet table styling — derived from `@nqlib/nqgrid/tokens` via playground config.
 * SSOT: `virtual-data-demo.tsx` — use `playgroundVirtualDataGridBundle` / `grid-*` exports.
 * Pinned geometry from `@nqlib/nqgrid/engine` — no color-mix or inline shadows.
 */
import {
  playgroundSpreadsheetBodyClass,
  playgroundVirtualDataGridBundle,
} from "./playground-table-tokens";

export const gridShellClass = playgroundVirtualDataGridBundle.gridShell;
export const gridScrollClass = playgroundVirtualDataGridBundle.gridScroll;
export const gridTableClass = playgroundVirtualDataGridBundle.gridTable;
export const gridHeaderClass = playgroundVirtualDataGridBundle.header;
export const gridHeadCellClass = playgroundVirtualDataGridBundle.gridHeadCell;
export const gridRowClass = "transition-colors";
export const gridCellClass = playgroundVirtualDataGridBundle.gridCell;
export const gridNumericClass = playgroundVirtualDataGridBundle.gridNumeric;
export const gridStickyHeadFillClass = playgroundVirtualDataGridBundle.pinnedHeadFill;
export const gridStickyCellFillClass = playgroundVirtualDataGridBundle.pinnedBodyFill;
export const gridBodyHoverClass = playgroundSpreadsheetBodyClass;
export const gridRowHeaderHeadClass = playgroundVirtualDataGridBundle.gridRowHeaderHeadCell;
export const gridRowHeaderCellClass = playgroundVirtualDataGridBundle.gridRowHeaderCell;
export const gridRowHeaderCellShellClass = playgroundVirtualDataGridBundle.gridRowHeaderCellShell;
export const gridRowHeaderNumberClass = playgroundVirtualDataGridBundle.gridRowHeaderNumber;
/** Opaque fills for pinned row-index gutter — from `rowHeader.pinned*Fill` tokens. */
export const gridRowHeaderPinnedHeadFillClass = playgroundVirtualDataGridBundle.gridRowHeaderPinnedHeadFill;
export const gridRowHeaderPinnedBodyFillClass = playgroundVirtualDataGridBundle.gridRowHeaderPinnedBodyFill;
