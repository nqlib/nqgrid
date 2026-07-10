import { useMemo } from "react";
import type { Table } from "@tanstack/react-table";

import {
  computePinnedLayout,
  resolvePinnedLeftPrefix,
  resolvePinnedLeftWithLeadingGutter,
  type PinnedLayoutResult,
} from "./pinned-layout";

export interface UsePinnedTableColumnsOptions<TData> {
  table: Table<TData>;
  /**
   * Column ids to pin on the left, in display order (prefix of visible leaves).
   * Omit when `fromColumnPinning` is true.
   */
  pinnedLeftIds?: readonly string[];
  /** Read `table.getState().columnPinning.left` instead of `pinnedLeftIds`. */
  fromColumnPinning?: boolean;
  /**
   * When set and this id is the first visible leaf, it is always pinned at inline-start.
   * `pinnedLeftIds` / `columnPinning.left` then refer to **data columns** only (after the gutter).
   */
  leadingGutterColumnId?: string | null;
  /** Pixel width overrides keyed by column id (falls back to `column.getSize()` then `defaultWidth`). */
  widthOverrides?: Readonly<Record<string, number>>;
  defaultWidth?: number;
}

/**
 * Derives pinned layout from TanStack Table visible leaf order and column sizes.
 */
export function usePinnedTableColumns<TData>({
  table,
  pinnedLeftIds = [],
  fromColumnPinning = false,
  leadingGutterColumnId = null,
  widthOverrides,
  defaultWidth = 150,
}: UsePinnedTableColumnsOptions<TData>): PinnedLayoutResult {
  return useMemo(() => {
    const visible = table.getVisibleLeafColumns();
    const visibleColumnIds = visible.map((c) => c.id);

    const getWidthPx = (columnId: string) => {
      const fromOverride = widthOverrides?.[columnId];
      if (fromOverride != null) return fromOverride;
      const col = visible.find((c) => c.id === columnId);
      if (!col) return defaultWidth;
      const w = col.getSize();
      return Number.isFinite(w) && w > 0 ? w : defaultWidth;
    };

    const dataPinIds = fromColumnPinning
      ? (table.getState().columnPinning?.left ?? [])
      : pinnedLeftIds;

    const resolved =
      leadingGutterColumnId && visibleColumnIds[0] === leadingGutterColumnId
        ? resolvePinnedLeftWithLeadingGutter(visibleColumnIds, dataPinIds, leadingGutterColumnId)
        : resolvePinnedLeftPrefix(visibleColumnIds, dataPinIds);

    return computePinnedLayout(visibleColumnIds, resolved, getWidthPx);
  }, [table, pinnedLeftIds, fromColumnPinning, leadingGutterColumnId, widthOverrides, defaultWidth]);
}
