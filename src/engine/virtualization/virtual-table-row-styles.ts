import type { CSSProperties } from "react";

export interface VirtualTableRowStyleOptions {
  /** Height of non-virtual top bands (frozen prefix + top-pinned rows) below thead. */
  bandOffsetPx?: number;
}

/**
 * Position a virtualized `<tr>` inside a `display:block` tbody.
 *
 * Uses `top` — **not** `transform: translateY` — so `position: sticky` on pinned
 * `<td>` cells keeps working (transform on an ancestor breaks horizontal stickiness).
 */
export function getVirtualTableRowStyle(
  startPx: number,
  rowWidthPx?: number,
  options?: VirtualTableRowStyleOptions,
): CSSProperties {
  const bandOffsetPx = options?.bandOffsetPx ?? 0;
  return {
    display: "flex",
    position: "absolute",
    top: bandOffsetPx + startPx,
    left: 0,
    ...(rowWidthPx != null
      ? { width: rowWidthPx, minWidth: rowWidthPx }
      : { width: "100%" }),
  };
}

/**
 * Absolute `top` for bottom-pinned rows after the virtual center band.
 */
export function getBottomPinnedRowStyle(
  bandTopPx: number,
  rowHeightPx: number,
): CSSProperties {
  return {
    display: "flex",
    position: "absolute",
    top: bandTopPx,
    left: 0,
    width: "100%",
    height: rowHeightPx,
    minHeight: rowHeightPx,
  };
}
