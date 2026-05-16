/**
 * Left-pinned column layout (nqdg-style cumulative `left` + width metrics).
 * Invariant: pinned ids must match the first N visible leaf column ids in order.
 */

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
  const out: string[] = [];
  const n = Math.min(visibleColumnIds.length, pinnedLeftIds.length);
  for (let i = 0; i < n; i++) {
    if (visibleColumnIds[i] !== pinnedLeftIds[i]) break;
    out.push(pinnedLeftIds[i]!);
  }
  return out;
}

export function computePinnedLayout(
  visibleColumnIds: readonly string[],
  pinnedLeftIds: readonly string[],
  getWidthPx: (columnId: string) => number,
): PinnedLayoutResult {
  if (pinnedLeftIds.length === 0) {
    return {
      pinned: [],
      pinnedById: new Map(),
      lastPinnedId: null,
      totalPinnedWidthPx: 0,
    };
  }

  for (let i = 0; i < pinnedLeftIds.length; i++) {
    if (visibleColumnIds[i] !== pinnedLeftIds[i]) {
      throw new Error(
        "computePinnedLayout: pinnedLeftIds must be a prefix of visibleColumnIds. Use resolvePinnedLeftPrefix first.",
      );
    }
  }

  const pinned: PinnedColumnMetric[] = [];
  let leftPx = 0;
  for (let i = 0; i < pinnedLeftIds.length; i++) {
    const id = pinnedLeftIds[i]!;
    const widthPx = getWidthPx(id);
    pinned.push({ id, leftPx, widthPx, pinIndex: i });
    leftPx += widthPx;
  }

  const pinnedById = new Map(pinned.map((m) => [m.id, m] as const));
  const lastPinnedId = pinned.length ? pinned[pinned.length - 1]!.id : null;

  return {
    pinned,
    pinnedById,
    lastPinnedId,
    totalPinnedWidthPx: leftPx,
  };
}

export function isPinnedColumn(layout: PinnedLayoutResult, columnId: string): boolean {
  return layout.pinnedById.has(columnId);
}

export function isLastPinnedColumn(layout: PinnedLayoutResult, columnId: string): boolean {
  return layout.lastPinnedId === columnId;
}
