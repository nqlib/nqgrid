import type { CSSProperties } from "react";

import type { PinnedLayoutResult } from "./pinned-layout";
import { isPinnedColumn } from "./pinned-layout";

export interface PinnedStickyStyleOptions {
  variant: "head" | "body";
  /** Highest z-index for the leftmost pinned column (header). */
  headZBase?: number;
  /** Highest z-index for the leftmost pinned column (body). Keep below a typical sticky thead (`z-20`). */
  bodyZBase?: number;
}

/**
 * Inline styles for `<th>` / `<td>` sticky pinning. Compose with your own
 * `className` for background, borders, and edge shadow on the last pinned column.
 */
export function getPinnedTableCellStickyStyle(
  layout: PinnedLayoutResult,
  columnId: string,
  opts: PinnedStickyStyleOptions,
): CSSProperties | undefined {
  if (!isPinnedColumn(layout, columnId)) return undefined;
  const m = layout.pinnedById.get(columnId)!;
  const headZBase = opts.headZBase ?? 40;
  /** Default leaves room under a sticky thead at `z-20` (three pins → 10,9,8). */
  const bodyZBase = opts.bodyZBase ?? 10;
  const z = opts.variant === "head" ? headZBase - m.pinIndex : bodyZBase - m.pinIndex;

  const base: CSSProperties = {
    position: "sticky",
    left: m.leftPx,
    width: m.widthPx,
    minWidth: m.widthPx,
    zIndex: z,
  };

  if (opts.variant === "head") {
    return { ...base, top: 0, maxWidth: m.widthPx };
  }

  return base;
}

/* ── Row pinning groundwork ───────────────────────────────────────────────────
   A grid that pins both columns and rows has four regions. Mark each cell with
   `data-pinned` so the consumer's background CSS (opaque base + color-mix
   overlays) treats every sticky cell identically:

     data-pinned="left"   → column-pinned body cell   (sticky x)
     data-pinned="top"    → row-pinned cell            (sticky y, top)
     data-pinned="bottom" → row-pinned cell            (sticky y, bottom)
     data-pinned="corner" → intersection              (sticky x AND y)

   z-index ladder keeps the corner above pinned rows above pinned columns above
   the scrolling body — and all below a sticky header at z-20 unless you raise it. */

export type PinnedRegion = "body" | "left" | "top" | "bottom" | "corner";

export interface PinnedZLayers {
  body: number;
  /** Column-pinned cells. */
  col: number;
  /** Row-pinned cells. */
  row: number;
  /** Row+column intersection. */
  corner: number;
}

export const DEFAULT_PINNED_Z: PinnedZLayers = { body: 0, col: 10, row: 21, corner: 31 };

/** Classify a cell from independent column/row pin flags. */
export function resolvePinnedRegion(opts: {
  columnPinned: boolean;
  rowPinned: "top" | "bottom" | false;
}): PinnedRegion {
  if (opts.columnPinned && opts.rowPinned) return "corner";
  if (opts.rowPinned) return opts.rowPinned;
  if (opts.columnPinned) return "left";
  return "body";
}

/** z-index for a region (corner > row > column > body). */
export function getPinnedCellZIndex(region: PinnedRegion, layers: PinnedZLayers = DEFAULT_PINNED_Z): number {
  switch (region) {
    case "corner":
      return layers.corner;
    case "top":
    case "bottom":
      return layers.row;
    case "left":
      return layers.col;
    case "body":
    default:
      return layers.body;
  }
}

/** `data-pinned` attribute value for a region (undefined when not pinned). */
export function getPinnedDataAttr(region: PinnedRegion): "left" | "top" | "bottom" | "corner" | undefined {
  return region === "body" ? undefined : region;
}

export interface PinnedRowStickyStyleOptions {
  /** "top" pins below the header; "bottom" pins to the footer edge. */
  edge: "top" | "bottom";
  /** Cumulative offset from that edge (px) — header height + earlier pinned rows. */
  offsetPx: number;
  /** Override z-index (defaults to the row layer). */
  zIndex?: number;
}

/**
 * Sticky `CSSProperties` for a row-pinned `<td>` (geometry only — compose your
 * own background via `data-pinned`). Mirror of the column pin helper for the y axis.
 */
export function getPinnedRowStickyStyle(opts: PinnedRowStickyStyleOptions): CSSProperties {
  return {
    position: "sticky",
    [opts.edge]: opts.offsetPx,
    zIndex: opts.zIndex ?? DEFAULT_PINNED_Z.row,
  };
}
