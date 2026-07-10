/**
 * Left-pinned column layout (nqdg-style cumulative `left` + width metrics).
 * Invariant: pinned ids must match the first N visible leaf column ids in order.
 *
 * Thin adapter over the axis-generic {@link ./prefix-layout} core
 * (offset→leftPx, size→widthPx).
 */

import {
  computePrefixLayout,
  resolvePrefix,
  type PrefixLayoutResult,
} from "./prefix-layout";

export interface PinnedColumnMetric {
  readonly id: string;
  /** Cumulative distance from the inline-start edge of the scroll container (px). */
  readonly leftPx: number;
  readonly widthPx: number;
  /** 0-based index among pinned columns (left to right). */
  readonly pinIndex: number;
}

export interface PinnedLayoutResult {
  readonly pinned: readonly PinnedColumnMetric[];
  readonly pinnedById: ReadonlyMap<string, PinnedColumnMetric>;
  readonly lastPinnedId: string | null;
  readonly totalPinnedWidthPx: number;
}

/** Longest prefix of `pinnedLeftIds` that still matches the start of `visibleColumnIds`. */
export function resolvePinnedLeftPrefix(
  visibleColumnIds: readonly string[],
  pinnedLeftIds: readonly string[],
): readonly string[] {
  return resolvePrefix(visibleColumnIds, pinnedLeftIds);
}

/**
 * Resolve left-pinned column ids when a **leading gutter column** (row-index `#` gutter,
 * TanStack id usually `"select"`) must stay frozen at inline-start (index 0).
 *
 * `dataPinnedLeftIds` applies only to visible leaves **after** the gutter — i.e. **data columns**.
 */
export function resolvePinnedLeftWithLeadingGutter(
  visibleColumnIds: readonly string[],
  dataPinnedLeftIds: readonly string[],
  leadingGutterColumnId: string,
): readonly string[] {
  if (visibleColumnIds[0] !== leadingGutterColumnId) {
    return resolvePinnedLeftPrefix(visibleColumnIds, dataPinnedLeftIds);
  }
  const dataVisibleIds = visibleColumnIds.slice(1);
  const dataPinned = resolvePinnedLeftPrefix(dataVisibleIds, dataPinnedLeftIds);
  return dataPinned.length > 0
    ? [leadingGutterColumnId, ...dataPinned]
    : [leadingGutterColumnId];
}

function toPinnedResult(core: PrefixLayoutResult): PinnedLayoutResult {
  const pinned: PinnedColumnMetric[] = core.members.map((m) => ({
    id: m.id,
    leftPx: m.offset,
    widthPx: m.size,
    pinIndex: m.index,
  }));
  return {
    pinned,
    pinnedById: new Map(pinned.map((m) => [m.id, m] as const)),
    lastPinnedId: core.lastId,
    totalPinnedWidthPx: core.totalSize,
  };
}

export function computePinnedLayout(
  visibleColumnIds: readonly string[],
  pinnedLeftIds: readonly string[],
  getWidthPx: (columnId: string) => number,
): PinnedLayoutResult {
  return toPinnedResult(
    computePrefixLayout(
      visibleColumnIds,
      pinnedLeftIds,
      getWidthPx,
      "computePinnedLayout: pinnedLeftIds must be a prefix of visibleColumnIds. Use resolvePinnedLeftPrefix first.",
    ),
  );
}

export function isPinnedColumn(layout: PinnedLayoutResult, columnId: string): boolean {
  return layout.pinnedById.has(columnId);
}

export function isLastPinnedColumn(layout: PinnedLayoutResult, columnId: string): boolean {
  return layout.lastPinnedId === columnId;
}
