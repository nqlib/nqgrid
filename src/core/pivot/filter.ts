import type { PivotFieldCodes, PivotRowEncoding } from "./encode";
import type { PivotFilter, PivotLabelMatch, PivotLabelMatchOp } from "./types";

/** Does `key` pass a label filter? Case-insensitive unless `match.caseSensitive`. */
export function pivotMatchesLabel(key: string, match: PivotLabelMatch): boolean {
  const cs = match.caseSensitive === true;
  const k = cs ? key : key.toLowerCase();
  const v = cs ? match.value : match.value.toLowerCase();
  switch (match.op) {
    case "contains":
      return k.includes(v);
    case "notContains":
      return !k.includes(v);
    case "beginsWith":
      return k.startsWith(v);
    case "endsWith":
      return k.endsWith(v);
    case "equals":
      return k === v;
    case "notEquals":
      return k !== v;
  }
}

/** Does one key pass every part of `filter` (include, exclude, match)? */
export function pivotFilterAccepts(filter: PivotFilter, key: string): boolean {
  if (filter.include && !filter.include.includes(key)) return false;
  if (filter.exclude && filter.exclude.includes(key)) return false;
  if (filter.match && !pivotMatchesLabel(key, filter.match)) return false;
  return true;
}

/** A filter with no include / exclude / match keeps everything (and is dropped by the helpers). */
export function isPivotFilterActive(filter: PivotFilter): boolean {
  return filter.include !== undefined || (filter.exclude?.length ?? 0) > 0 || filter.match !== undefined;
}

/** Filters on one field, ANDed and evaluated once per distinct key. */
export interface PivotCompiledFieldFilter {
  readonly field: string;
  readonly codes: PivotFieldCodes;
  /** `allowed[code]` is 1 when that key passes every filter on this field. */
  readonly allowed: Uint8Array;
}

export function compilePivotFilters(
  filters: readonly PivotFilter[] | undefined,
  encoding: PivotRowEncoding,
): PivotCompiledFieldFilter[] {
  const byField = new Map<string, PivotFilter[]>();
  for (const f of filters ?? []) {
    if (!isPivotFilterActive(f)) continue;
    let list = byField.get(f.field);
    if (!list) byField.set(f.field, (list = []));
    list.push(f);
  }
  const out: PivotCompiledFieldFilter[] = [];
  for (const [field, list] of byField) {
    const codes = encoding.codes(field);
    const sets = list.map((f) => ({
      include: f.include ? new Set(f.include) : null,
      exclude: f.exclude?.length ? new Set(f.exclude) : null,
      match: f.match ?? null,
    }));
    const allowed = new Uint8Array(codes.keys.length);
    codes.keys.forEach((key, c) => {
      let ok = true;
      for (const s of sets) {
        if ((s.include && !s.include.has(key)) || (s.exclude && s.exclude.has(key)) || (s.match && !pivotMatchesLabel(key, s.match))) {
          ok = false;
          break;
        }
      }
      allowed[c] = ok ? 1 : 0;
    });
    out.push({ field, codes, allowed });
  }
  return out;
}

export interface PivotFacetCounts {
  readonly codes: PivotFieldCodes;
  /** Records per key that pass every filter on other fields. */
  readonly counts: Int32Array;
  /** This field's own filter (`null` when unfiltered). */
  readonly allowed: Uint8Array | null;
}

export interface PivotFilterPass {
  /** `1` for records that pass every filter; `null` when there are no filters (everything passes). */
  readonly mask: Uint8Array | null;
  readonly matched: number;
  readonly facets: ReadonlyMap<string, PivotFacetCounts>;
}

/**
 * One pass over the records: the filter mask plus cross-filtered facet counts.
 * A record counts toward facet F when it fails no filter, or fails only F's own filter, so each
 * facet "ignores itself" like an Excel slicer — O(records × (filtered fields + facets)), not one
 * pass per facet.
 */
export function runPivotFilterPass(
  compiled: readonly PivotCompiledFieldFilter[],
  facetFields: readonly string[],
  encoding: PivotRowEncoding,
): PivotFilterPass {
  const n = encoding.length;
  const facets = new Map<string, PivotFacetCounts>();
  const facetList: { codes: Int32Array; counts: Int32Array; all: Int32Array }[] = [];
  /** Facet slot for each filtered field (`-1` when that field is not a facet). */
  const filterFacet = new Int32Array(compiled.length).fill(-1);
  for (const field of facetFields) {
    if (facets.has(field)) continue;
    const codes = encoding.codes(field);
    const own = compiled.findIndex((c) => c.field === field);
    const counts = new Int32Array(codes.keys.length);
    facets.set(field, { codes, counts, allowed: own >= 0 ? compiled[own]!.allowed : null });
    if (own >= 0) filterFacet[own] = facetList.length;
    facetList.push({ codes: codes.codes, counts, all: codes.counts });
  }

  if (compiled.length === 0) {
    for (const f of facetList) f.counts.set(f.all);
    return { mask: null, matched: n, facets };
  }

  const mask = new Uint8Array(n);
  const fc = compiled.map((c) => c.codes.codes);
  const fa = compiled.map((c) => c.allowed);
  const k = compiled.length;
  const nf = facetList.length;
  let matched = 0;
  for (let i = 0; i < n; i++) {
    let failed = -1;
    let fails = 0;
    for (let j = 0; j < k; j++) {
      if (fa[j]![fc[j]![i]!] === 0) {
        failed = j;
        if (++fails > 1) break;
      }
    }
    if (fails === 0) {
      mask[i] = 1;
      matched++;
      for (let j = 0; j < nf; j++) facetList[j]!.counts[facetList[j]!.codes[i]!]!++;
    } else if (fails === 1) {
      const slot = filterFacet[failed]!;
      if (slot >= 0) facetList[slot]!.counts[facetList[slot]!.codes[i]!]!++;
    }
  }
  return { mask, matched, facets };
}

const MATCH_TEXT: Readonly<Record<PivotLabelMatchOp, string>> = {
  contains: "contains",
  notContains: "does not contain",
  beginsWith: "begins with",
  endsWith: "ends with",
  equals: "=",
  notEquals: "≠",
};

/** Values printed before "+N more" in filter summaries. */
const MAX_LISTED = 6;

function listKeys(keys: readonly string[], labelOfKey: (key: string) => string): string {
  const shown = keys.slice(0, MAX_LISTED).map(labelOfKey).join(", ");
  return keys.length > MAX_LISTED ? `${shown} +${keys.length - MAX_LISTED} more` : shown;
}

/** Printable parts of one filter: `Department = Camp, Packs`, `Line contains "pack"`. */
export function describePivotFilter(
  filter: PivotFilter,
  label: string,
  labelOfKey: (key: string) => string = (k) => k,
): { readonly kind: "items" | "label"; readonly text: string }[] {
  const out: { kind: "items" | "label"; text: string }[] = [];
  if (filter.include) out.push({ kind: "items", text: filter.include.length ? `${label} = ${listKeys(filter.include, labelOfKey)}` : `${label} = (none)` });
  if (filter.exclude?.length) out.push({ kind: "items", text: `${label} ≠ ${listKeys(filter.exclude, labelOfKey)}` });
  if (filter.match) out.push({ kind: "label", text: `${label} ${MATCH_TEXT[filter.match.op]} "${filter.match.value}"` });
  return out;
}
