/**
 * Axis-generic prefix layout core shared by left-pinned columns and top-frozen
 * rows. Both axes resolve a leading prefix of ids, validate it against the
 * visible ordering, then accumulate per-id offsets. The only difference is the
 * spelling of the geometry fields (left/width vs top/height), which the
 * pinned-layout / frozen-rows-layout adapters apply on top of these records.
 */

export interface PrefixMetric {
  readonly id: string;
  /** Cumulative distance from the start edge of the axis (px). */
  readonly offset: number;
  readonly size: number;
  /** 0-based index among prefix members. */
  readonly index: number;
}

export interface PrefixLayoutResult {
  readonly members: readonly PrefixMetric[];
  readonly byId: ReadonlyMap<string, PrefixMetric>;
  readonly lastId: string | null;
  readonly totalSize: number;
}

/** Longest prefix of `prefixIds` that still matches the start of `ids`. */
export function resolvePrefix(
  ids: readonly string[],
  prefixIds: readonly string[],
): readonly string[] {
  const out: string[] = [];
  const n = Math.min(ids.length, prefixIds.length);
  for (let i = 0; i < n; i++) {
    if (ids[i] !== prefixIds[i]) break;
    out.push(prefixIds[i]!);
  }
  return out;
}

/**
 * Accumulate per-member offsets for a leading prefix.
 *
 * `prefixIds` must be a prefix of `ids`; otherwise throws with `errorMessage`
 * (the adapters pass their original messages so error text stays identical).
 */
export function computePrefixLayout(
  ids: readonly string[],
  prefixIds: readonly string[],
  getSize: (id: string) => number,
  errorMessage: string,
): PrefixLayoutResult {
  if (prefixIds.length === 0) {
    return {
      members: [],
      byId: new Map(),
      lastId: null,
      totalSize: 0,
    };
  }

  for (let i = 0; i < prefixIds.length; i++) {
    if (ids[i] !== prefixIds[i]) {
      throw new Error(errorMessage);
    }
  }

  const members: PrefixMetric[] = [];
  let offset = 0;
  for (let i = 0; i < prefixIds.length; i++) {
    const id = prefixIds[i]!;
    const size = getSize(id);
    members.push({ id, offset, size, index: i });
    offset += size;
  }

  const byId = new Map(members.map((m) => [m.id, m] as const));
  const lastId = members.length ? members[members.length - 1]!.id : null;

  return { members, byId, lastId, totalSize: offset };
}

export function isPrefixMember(layout: PrefixLayoutResult, id: string): boolean {
  return layout.byId.has(id);
}

export function isLastPrefixMember(layout: PrefixLayoutResult, id: string): boolean {
  return layout.lastId === id;
}
