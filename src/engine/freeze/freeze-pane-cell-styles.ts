import type { CSSProperties } from "react";

import type { FrozenTopLayoutResult } from "./frozen-rows-layout";
import { isFrozenTopRow } from "./frozen-rows-layout";
import type { PinnedLayoutResult } from "../pinning/pinned-layout";
import { isPinnedColumn } from "../pinning/pinned-layout";
import {
  DEFAULT_PINNED_Z,
  getPinnedCellZIndex,
  getPinnedTableCellStickyStyle,
} from "../pinning/pinned-cell-styles";

export interface FreezePaneCellStyleOptions {
  columnLayout: PinnedLayoutResult;
  rowLayout?: FrozenTopLayoutResult;
  columnId: string;
  rowId?: string;
  variant: "head" | "body";
  /** px offset of thead block above tbody frozen rows (sum of header row heights). */
  headerOffsetPx?: number;
  headZBase?: number;
  bodyZBase?: number;
  /** Extra z-index when both column and row are frozen (corner). */
  cornerZBoost?: number;
}

/**
 * Merges column pin sticky (`left`) with top-frozen row sticky (`top`).
 * Header cells use `top: 0` from column pin; body frozen rows add cumulative `top`.
 */
export function getFreezePaneCellStickyStyle(
  opts: FreezePaneCellStyleOptions,
): CSSProperties | undefined {
  const {
    columnLayout,
    rowLayout,
    columnId,
    rowId,
    variant,
    headerOffsetPx = 0,
    headZBase = 48,
    bodyZBase = 10,
  } = opts;

  const colPinned = isPinnedColumn(columnLayout, columnId);
  const rowFrozen =
    variant === "body" && rowLayout != null && rowId != null && isFrozenTopRow(rowLayout, rowId);

  if (!colPinned && !rowFrozen) return undefined;

  const colStyle = colPinned
    ? getPinnedTableCellStickyStyle(columnLayout, columnId, {
        variant,
        headZBase,
        bodyZBase,
      })
    : undefined;

  if (!rowFrozen) return colStyle;

  const rowMetric = rowLayout!.frozenById.get(rowId!)!;
  const rowTopPx = headerOffsetPx + rowMetric.topPx;

  if (!colPinned) {
    return {
      position: "sticky",
      top: rowTopPx,
      height: rowMetric.heightPx,
      minHeight: rowMetric.heightPx,
      zIndex: getPinnedCellZIndex("top", DEFAULT_PINNED_Z) - rowMetric.freezeIndex,
    };
  }

  const merged: CSSProperties = { ...colStyle };
  if (variant === "body") {
    merged.top = rowTopPx;
    merged.height = rowMetric.heightPx;
    merged.minHeight = rowMetric.heightPx;
    merged.zIndex =
      getPinnedCellZIndex("corner", DEFAULT_PINNED_Z) -
      rowMetric.freezeIndex -
      (columnLayout.pinnedById.get(columnId)?.pinIndex ?? 0);
  }

  return merged;
}

export function getFrozenRowStickyStyle(
  rowLayout: FrozenTopLayoutResult,
  rowId: string,
  options?: { headerOffsetPx?: number; zIndex?: number },
): CSSProperties | undefined {
  if (!isFrozenTopRow(rowLayout, rowId)) return undefined;
  const m = rowLayout.frozenById.get(rowId)!;
  const headerOffsetPx = options?.headerOffsetPx ?? 0;
  return {
    position: "sticky",
    top: headerOffsetPx + m.topPx,
    height: m.heightPx,
    minHeight: m.heightPx,
    zIndex: options?.zIndex ?? getPinnedCellZIndex("top", DEFAULT_PINNED_Z) - m.freezeIndex,
  };
}
