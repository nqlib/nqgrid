import { useMemo } from "react";
import type { Table } from "@tanstack/react-table";

import {
  computePinnedLayout,
  resolvePinnedLeftPrefix,
  type PinnedLayoutResult,
} from "../core/pinned-layout";

export interface UsePinnedTableColumnsOptions<TData> {
  table: Table<TData>;
  /** Column ids to pin on the left, in display order (must be prefix of visible leaves). */
  pinnedLeftIds: readonly string[];
  /** Pixel width overrides keyed by column id (falls back to `column.getSize()` then `defaultWidth`). */
  widthOverrides?: Readonly<Record<string, number>>;
  defaultWidth?: number;
}

/**
 * Derives pinned layout from TanStack Table visible leaf order and column sizes.
 */
export function usePinnedTableColumns<TData>({
  table,
  pinnedLeftIds,
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

    const resolved = resolvePinnedLeftPrefix(visibleColumnIds, pinnedLeftIds);
    return computePinnedLayout(visibleColumnIds, resolved, getWidthPx);
  }, [table, pinnedLeftIds, widthOverrides, defaultWidth]);
}
