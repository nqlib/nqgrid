/**
 * Top-frozen row layout (cumulative `top` + height metrics).
 * Invariant: frozen row ids must match the first N visible row ids in order.
 *
 * Thin adapter over the axis-generic prefix-layout core
 * (offset→topPx, size→heightPx).
 */

import {
  computePrefixLayout,
  resolvePrefix,
  type PrefixLayoutResult,
} from "../pinning/prefix-layout";

export interface FrozenRowMetric {
  readonly id: string;
  /** Cumulative distance from the top of the tbody scroll band (px), below thead. */
  readonly topPx: number;
  readonly heightPx: number;
  /** 0-based index among frozen top body rows. */
  readonly freezeIndex: number;
}

export interface FrozenTopLayoutResult {
  readonly frozen: readonly FrozenRowMetric[];
  readonly frozenById: ReadonlyMap<string, FrozenRowMetric>;
  readonly lastFrozenId: string | null;
  readonly totalFrozenHeightPx: number;
}

/** Longest prefix of `frozenTopRowIds` that still matches the start of `visibleRowIds`. */
export function resolveFrozenTopPrefix(
  visibleRowIds: readonly string[],
  frozenTopRowIds: readonly string[],
): readonly string[] {
  return resolvePrefix(visibleRowIds, frozenTopRowIds);
}

function toFrozenResult(core: PrefixLayoutResult): FrozenTopLayoutResult {
  const frozen: FrozenRowMetric[] = core.members.map((m) => ({
    id: m.id,
    topPx: m.offset,
    heightPx: m.size,
    freezeIndex: m.index,
  }));
  return {
    frozen,
    frozenById: new Map(frozen.map((m) => [m.id, m] as const)),
    lastFrozenId: core.lastId,
    totalFrozenHeightPx: core.totalSize,
  };
}

export function computeFrozenTopLayout(
  visibleRowIds: readonly string[],
  frozenTopRowIds: readonly string[],
  getHeightPx: (rowId: string) => number,
): FrozenTopLayoutResult {
  return toFrozenResult(
    computePrefixLayout(
      visibleRowIds,
      frozenTopRowIds,
      getHeightPx,
      "computeFrozenTopLayout: frozenTopRowIds must be a prefix of visibleRowIds. Use resolveFrozenTopPrefix first.",
    ),
  );
}

export function isFrozenTopRow(layout: FrozenTopLayoutResult, rowId: string): boolean {
  return layout.frozenById.has(rowId);
}

export function isLastFrozenTopRow(layout: FrozenTopLayoutResult, rowId: string): boolean {
  return layout.lastFrozenId === rowId;
}
