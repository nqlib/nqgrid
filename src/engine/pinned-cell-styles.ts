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
  /** Default leaves room under a sticky thead at `z-20` (three pins → 6,5,4). */
  const bodyZBase = opts.bodyZBase ?? 6;
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
