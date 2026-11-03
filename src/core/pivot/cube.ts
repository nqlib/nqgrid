import { aggregatePivotRows, type PivotAggregatorRegistry } from "./aggregate";
import { createPivotRowEncoding, type PivotRowEncoding } from "./encode";
import { compilePivotFilters, runPivotFilterPass, type PivotFacetCounts } from "./filter";
import { toPivotNumber } from "./format";
import type { PivotDataRow, PivotDimension, PivotFacetSpec, PivotMeasure, PivotSpec } from "./types";

/**
 * Key of the Top-N "Other" row (a control character, so it never collides with real keys).
 * It appears in row paths, e.g. `expanded: [["\u0000other"]]`.
 */
export const PIVOT_OTHER_KEY = "\u0000other";

/**
 * Aggregation kinds, each with a fixed number of accumulator slots per bucket:
 * sum / avg `[sum, n]`, min / max `[value, n]`, first / last `[value, n, recordIndex]`, count with a
 * field `[n]`, weighted average `[Σ v·w, Σ w]`, ratio `[Σ num, n num, Σ den, n den]`.
 */
const enum Kind {
  Sum,
  Avg,
  Min,
  Max,
  First,
  Last,
  CountRows,
  CountField,
  WeightedAvg,
  Ratio,
  Custom,
}

const SLOTS: Readonly<Record<Kind, number>> = {
  [Kind.Sum]: 2,
  [Kind.Avg]: 2,
  [Kind.Min]: 2,
  [Kind.Max]: 2,
  [Kind.First]: 3,
  [Kind.Last]: 3,
  [Kind.CountRows]: 0,
  [Kind.CountField]: 1,
  [Kind.WeightedAvg]: 2,
  [Kind.Ratio]: 4,
  [Kind.Custom]: 0,
};

interface CompiledMeasure {
  readonly measure: PivotMeasure;
  readonly kind: Kind;
  /** Slot offset within a bucket (slot 0 is the record count). */
  readonly off: number;
  readonly a: Float64Array | null;
  readonly b: Float64Array | null;
  readonly p: Uint8Array | null;
  readonly offset: number;
}

/** One group / leaf (or the root) of the aggregated tree. */
export interface PivotCubeNode {
  readonly id: number;
  readonly path: readonly string[];
  readonly key: string;
  /** Row-dimension level; `-1` for the root. */
  readonly depth: number;
  readonly parent: PivotCubeNode | null;
  /** Ordered children (`order` / `sort` / `sortBy`, "Other" last). */
  readonly children: readonly PivotCubeNode[];
  /** Matching source records. */
  readonly rowCount: number;
  /** First non-null value per `attributes` field of this level (same order as the dimension's list). */
  readonly attributes: readonly unknown[] | null;
  /** Keys folded into this Top-N "Other" node. */
  readonly otherCount?: number;
}

interface MutableNode extends PivotCubeNode {
  readonly parent: MutableNode | null;
  children: MutableNode[];
  rowCount: number;
  attributes: unknown[] | null;
  otherCount?: number;
  readonly code: number;
  readonly childByCode: Map<number, MutableNode>;
  readonly acc: Float64Array;
  /** Root → this node (leaves only, for attribute lookups). */
  chain: readonly MutableNode[] | null;
  /** Record indices per bucket (only with custom aggregators). */
  readonly rowIdx: number[][] | null;
  attrPending: number;
}

/**
 * The expensive, view-independent half of a pivot: filtered records aggregated into a tree, with
 * every measure accumulated per node × column key (+ row total). `pivotModelFromCube` turns it into
 * a `PivotModel` for the current view state (expanded groups, heat, labels, formats) cheaply.
 */
export interface PivotCube {
  readonly root: PivotCubeNode;
  /** Every non-root node, pre-order in display order. */
  readonly nodes: readonly PivotCubeNode[];
  /** Ordered column-dimension keys (seen in matching records, plus `order` keys with `keepEmpty`). */
  readonly columnKeys: readonly string[];
  /** Aggregated raw value; `columnKey === null` → across all columns. `null` when there is no value. */
  valueOf(node: PivotCubeNode, measureId: string, columnKey: string | null): number | null;
  /** Records before / after report, label and Top-N filters. */
  readonly recordCount: { readonly total: number; readonly matched: number };
  /** Cross-filtered counts for `spec.facets`, in facet order. */
  readonly facets: readonly PivotCubeFacet[];
}

export interface PivotCubeFacet {
  readonly field: string;
  /** Ordered keys (dimension order, else ascending). */
  readonly keys: readonly string[];
  readonly counts: readonly number[];
  readonly totals: readonly number[];
  /** `null` when the field has no filter (every key selected). */
  readonly selected: readonly boolean[] | null;
}

export interface BuildPivotCubeOptions {
  readonly aggregators?: PivotAggregatorRegistry;
  /** Reuse a column encoding of the same `rows` (see `createPivotRowEncoding`). */
  readonly encoding?: PivotRowEncoding;
}

export function pivotFacetField(f: PivotFacetSpec): string {
  return typeof f === "string" ? f : f.field;
}

/** Natural key comparison: numeric when both keys are numbers, else code-unit order. */
export function comparePivotKeys(a: string, b: string): number {
  const na = toPivotNumber(a);
  const nb = toPivotNumber(b);
  if (na !== null && nb !== null) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `order` keys first (all of them with `keepEmpty`), then the rest by `sort` (default first-seen). */
export function orderPivotKeys(seen: readonly string[], dim: PivotDimension, keepEmpty: boolean): string[] {
  const seenSet = new Set(seen);
  const order = [...new Set(dim.order ?? [])];
  const orderSet = new Set(order);
  const head = order.filter((k) => keepEmpty || seenSet.has(k));
  let rest = seen.filter((k) => !orderSet.has(k));
  if (dim.sort === "asc") rest = [...rest].sort(comparePivotKeys);
  else if (dim.sort === "desc") rest = [...rest].sort((a, b) => comparePivotKeys(b, a));
  return [...head, ...rest];
}

/**
 * The spec slices a cube depends on, as a string: equal keys (and the same rows / aggregators)
 * give the same cube, so view-only changes (expanded, heat, labels, formats, KPIs, totals) can
 * reuse it.
 */
export function pivotSpecDataKey(spec: PivotSpec): string {
  return JSON.stringify([
    spec.rows.map((d) => [d.field, d.order, d.sort, d.sortBy, d.topN && { ...d.topN, otherLabel: undefined }, d.attributes]),
    spec.columns ? [spec.columns.field, spec.columns.order, spec.columns.sort, spec.columns.keepEmpty] : null,
    spec.measures.map((m) => [m.id, m.field, m.aggregate]),
    (spec.filters ?? []).map((f) => [f.field, f.include, f.exclude, f.match]),
    (spec.facets ?? []).map(pivotFacetField),
  ]);
}

function compileMeasure(m: PivotMeasure, off: number, enc: PivotRowEncoding): CompiledMeasure {
  const agg = m.aggregate ?? "sum";
  const num = (f: string | undefined) => (f ? enc.numbers(f) : null);
  if (typeof agg === "string") {
    switch (agg) {
      case "count":
        return m.field
          ? { measure: m, kind: Kind.CountField, off, a: null, b: null, p: enc.present(m.field), offset: 0 }
          : { measure: m, kind: Kind.CountRows, off, a: null, b: null, p: null, offset: 0 };
      case "sum":
      case "avg":
      case "min":
      case "max":
      case "first":
      case "last": {
        const kind = { sum: Kind.Sum, avg: Kind.Avg, min: Kind.Min, max: Kind.Max, first: Kind.First, last: Kind.Last }[agg];
        // A missing field aggregates nothing (null), like `aggregatePivotRows`.
        return { measure: m, kind, off, a: num(m.field) ?? new Float64Array(enc.length).fill(NaN), b: null, p: null, offset: 0 };
      }
    }
  }
  switch (agg.type) {
    case "weightedAvg":
      return {
        measure: m,
        kind: Kind.WeightedAvg,
        off,
        a: num(m.field) ?? new Float64Array(enc.length).fill(NaN),
        b: enc.numbers(agg.weightField),
        p: null,
        offset: 0,
      };
    case "ratio":
      return {
        measure: m,
        kind: Kind.Ratio,
        off,
        a: enc.numbers(agg.numeratorField),
        b: enc.numbers(agg.denominatorField),
        p: null,
        offset: agg.offset ?? 0,
      };
    case "custom":
      return { measure: m, kind: Kind.Custom, off, a: null, b: null, p: null, offset: 0 };
  }
}

interface TreeInput {
  readonly n: number;
  readonly mask: Uint8Array | null;
  readonly levelCodes: readonly Int32Array[];
  readonly levelKeys: readonly (readonly string[])[];
  readonly colCodes: Int32Array | null;
  /** Number of column buckets (the total bucket is index `buckets`). */
  readonly buckets: number;
  readonly measures: readonly CompiledMeasure[];
  readonly slots: number;
  readonly maxDepth: number;
  readonly attributeFields: readonly (readonly string[] | undefined)[];
  readonly rows: readonly PivotDataRow[];
  readonly custom: boolean;
  /** When set, receives each record's node id at `maxDepth` (`-1` for filtered-out records). */
  readonly nodeAtMaxDepth?: Int32Array;
}

/** Largest composite leaf key that stays an exact integer. */
const MAX_COMPOSITE = 2 ** 52;

/**
 * Group records into a tree (to `maxDepth`) and accumulate every measure. Each record touches one
 * leaf: a composite integer key of its level codes finds the leaf with a single `Map` lookup, and
 * only the leaf's column + total buckets are updated. Partials are then rolled up level by level
 * (children in first-seen order), so the per-record cost no longer grows with the depth.
 */
function buildTree(t: TreeInput): { root: MutableNode; nodes: MutableNode[] } {
  const { n, mask, levelCodes, levelKeys, colCodes, buckets, measures, slots: S, maxDepth, rows, custom } = t;
  const size = (buckets + 1) * S;
  const totalBase = buckets * S;
  const nodes: MutableNode[] = [];
  const byDepth: MutableNode[][] = Array.from({ length: maxDepth + 1 }, () => []);
  let pendingAttributes = 0;
  const make = (path: string[], key: string, depth: number, parent: MutableNode | null, code: number): MutableNode => {
    const attrs = depth >= 0 ? t.attributeFields[depth] : undefined;
    const node: MutableNode = {
      id: nodes.length,
      path,
      key,
      depth,
      parent,
      children: [],
      rowCount: 0,
      attributes: attrs?.length ? new Array<unknown>(attrs.length).fill(undefined) : null,
      attrPending: attrs?.length ?? 0,
      code,
      childByCode: new Map(),
      acc: new Float64Array(size),
      rowIdx: custom ? Array.from({ length: buckets + 1 }, () => []) : null,
      chain: null,
    };
    pendingAttributes += node.attrPending;
    nodes.push(node);
    if (depth >= 0) byDepth[depth]!.push(node);
    return node;
  };
  const root = make([], "", -1, null, -1);
  const nm = measures.length;

  // Composite key radix per level (+1 leaves room for the Top-N "Other" code).
  const radix = levelCodes.slice(0, maxDepth + 1).map((_, d) => levelKeys[d]!.length + 1);
  const composite = radix.reduce((a, b) => a * b, 1) < MAX_COMPOSITE;
  const leafByKey = new Map<number, MutableNode>();

  const descend = (i: number): MutableNode => {
    let node = root;
    for (let d = 0; d <= maxDepth; d++) {
      const code = levelCodes[d]![i]!;
      let child = node.childByCode.get(code);
      if (child === undefined) {
        child = make([...node.path, levelKeys[d]![code]!], levelKeys[d]![code]!, d, node, code);
        node.childByCode.set(code, child);
      }
      node = child;
    }
    if (node.chain === null) {
      const chain: MutableNode[] = [];
      for (let p: MutableNode | null = node; p !== null; p = p.parent) chain.unshift(p);
      node.chain = chain;
    }
    return node;
  };

  for (let i = 0; i < n; i++) {
    if (mask !== null && mask[i] === 0) {
      if (t.nodeAtMaxDepth) t.nodeAtMaxDepth[i] = -1;
      continue;
    }
    let leaf: MutableNode | undefined;
    if (composite) {
      let key = 0;
      for (let d = 0; d <= maxDepth; d++) key = key * radix[d]! + levelCodes[d]![i]!;
      leaf = leafByKey.get(key);
      if (leaf === undefined) leafByKey.set(key, (leaf = descend(i)));
    } else {
      leaf = descend(i);
    }
    if (t.nodeAtMaxDepth) t.nodeAtMaxDepth[i] = leaf.id;

    if (pendingAttributes > 0) {
      const chain = leaf.chain!;
      for (let p = 1; p < chain.length; p++) {
        const target = chain[p]!;
        if (target.attrPending === 0) continue;
        const fields = t.attributeFields[target.depth]!;
        for (let j = 0; j < fields.length; j++) {
          if (target.attributes![j] !== undefined) continue;
          const v = rows[i]![fields[j]!];
          if (v !== null && v !== undefined) {
            target.attributes![j] = v;
            target.attrPending--;
            pendingAttributes--;
          }
        }
      }
    }

    const acc = leaf.acc;
    const colBase = colCodes === null ? -1 : colCodes[i]! * S;
    if (custom) {
      leaf.rowIdx![buckets]!.push(i);
      if (colBase >= 0) leaf.rowIdx![colBase / S]!.push(i);
    }
    // Two buckets per record: the row total and its column key.
    for (let bi = 0; bi < 2; bi++) {
      const o = bi === 0 ? totalBase : colBase;
      if (o < 0) continue;
      acc[o]!++;
      for (let mi = 0; mi < nm; mi++) {
        const m = measures[mi]!;
        const x = o + m.off;
        switch (m.kind) {
          case Kind.Sum:
          case Kind.Avg: {
            const v = m.a![i]!;
            if (v === v) {
              acc[x] += v;
              acc[x + 1]!++;
            }
            break;
          }
          case Kind.Min: {
            const v = m.a![i]!;
            if (v === v) {
              if (acc[x + 1] === 0 || v < acc[x]!) acc[x] = v;
              acc[x + 1]!++;
            }
            break;
          }
          case Kind.Max: {
            const v = m.a![i]!;
            if (v === v) {
              if (acc[x + 1] === 0 || v > acc[x]!) acc[x] = v;
              acc[x + 1]!++;
            }
            break;
          }
          case Kind.First: {
            const v = m.a![i]!;
            if (v === v) {
              if (acc[x + 1] === 0) {
                acc[x] = v;
                acc[x + 2] = i;
              }
              acc[x + 1]!++;
            }
            break;
          }
          case Kind.Last: {
            const v = m.a![i]!;
            if (v === v) {
              acc[x] = v;
              acc[x + 2] = i;
              acc[x + 1]!++;
            }
            break;
          }
          case Kind.CountField:
            acc[x] += m.p![i]!;
            break;
          case Kind.WeightedAvg: {
            const v = m.a![i]!;
            const w = m.b![i]!;
            if (v === v && w === w) {
              acc[x] += v * w;
              acc[x + 1] += w;
            }
            break;
          }
          case Kind.Ratio: {
            const v = m.a![i]!;
            if (v === v) {
              acc[x] += v;
              acc[x + 1]!++;
            }
            const w = m.b![i]!;
            if (w === w) {
              acc[x + 2] += w;
              acc[x + 3]!++;
            }
            break;
          }
          default:
            break;
        }
      }
    }
  }

  // Roll leaf partials up, deepest level first; siblings merge in first-seen order.
  for (let d = maxDepth; d >= 0; d--) {
    for (const child of byDepth[d]!) {
      const parent = child.parent!;
      mergeInto(parent.acc, child.acc, buckets, S, measures);
      if (custom) {
        for (let b = 0; b <= buckets; b++) parent.rowIdx![b] = mergeSorted(parent.rowIdx![b]!, child.rowIdx![b]!);
      }
    }
  }
  for (const node of nodes) node.rowCount = node.acc[totalBase]!;
  return { root, nodes };
}

/** Merge one node's accumulators into its parent's (per aggregation kind). */
function mergeInto(into: Float64Array, from: Float64Array, buckets: number, S: number, measures: readonly CompiledMeasure[]): void {
  for (let b = 0; b <= buckets; b++) {
    const o = b * S;
    if (from[o] === 0) continue;
    into[o] += from[o]!;
    for (const m of measures) {
      const x = o + m.off;
      switch (m.kind) {
        case Kind.Sum:
        case Kind.Avg:
        case Kind.WeightedAvg:
          into[x] += from[x]!;
          into[x + 1] += from[x + 1]!;
          break;
        case Kind.Ratio:
          into[x] += from[x]!;
          into[x + 1] += from[x + 1]!;
          into[x + 2] += from[x + 2]!;
          into[x + 3] += from[x + 3]!;
          break;
        case Kind.CountField:
          into[x] += from[x]!;
          break;
        case Kind.Min:
        case Kind.Max:
          if (from[x + 1] === 0) break;
          if (into[x + 1] === 0 || (m.kind === Kind.Min ? from[x]! < into[x]! : from[x]! > into[x]!)) into[x] = from[x]!;
          into[x + 1] += from[x + 1]!;
          break;
        case Kind.First:
        case Kind.Last:
          if (from[x + 1] === 0) break;
          if (into[x + 1] === 0 || (m.kind === Kind.First ? from[x + 2]! < into[x + 2]! : from[x + 2]! > into[x + 2]!)) {
            into[x] = from[x]!;
            into[x + 2] = from[x + 2]!;
          }
          into[x + 1] += from[x + 1]!;
          break;
        default:
          break;
      }
    }
  }
}

/** Merge two ascending index lists (custom aggregators see records in data order). */
function mergeSorted(a: number[], b: readonly number[]): number[] {
  if (b.length === 0) return a;
  if (a.length === 0) return [...b];
  const out: number[] = new Array(a.length + b.length);
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < a.length && j < b.length) out[k++] = a[i]! <= b[j]! ? a[i++]! : b[j++]!;
  while (i < a.length) out[k++] = a[i++]!;
  while (j < b.length) out[k++] = b[j++]!;
  return out;
}

function readValue(
  node: MutableNode,
  m: CompiledMeasure,
  bucket: number,
  S: number,
  rows: readonly PivotDataRow[],
  registry: PivotAggregatorRegistry,
): number | null {
  const acc = node.acc;
  const o = bucket * S;
  if (acc[o] === 0) return null;
  const x = o + m.off;
  switch (m.kind) {
    case Kind.Sum:
    case Kind.Min:
    case Kind.Max:
    case Kind.First:
    case Kind.Last:
      return acc[x + 1] === 0 ? null : acc[x]!;
    case Kind.Avg:
      return acc[x + 1] === 0 ? null : acc[x]! / acc[x + 1]!;
    case Kind.CountRows:
      return acc[o]!;
    case Kind.CountField:
      return acc[x]!;
    case Kind.WeightedAvg:
      return acc[x + 1] === 0 ? null : acc[x]! / acc[x + 1]!;
    case Kind.Ratio:
      if (acc[x + 1] === 0 || acc[x + 3] === 0 || acc[x + 2] === 0) return null;
      return acc[x]! / acc[x + 2]! + m.offset;
    case Kind.Custom: {
      const idx = node.rowIdx![bucket]!;
      return aggregatePivotRows(
        idx.map((i) => rows[i]!),
        m.measure.aggregate,
        m.measure.field,
        registry,
      );
    }
  }
}

/** Ordered sibling keys for `dim`: `sortBy` (value) wins; `order`, then `sort`, then first-seen break ties. */
function orderChildren(
  parent: MutableNode,
  dim: PivotDimension,
  value: (node: MutableNode, measureId: string, columnKey: string | null) => number | null,
): MutableNode[] {
  const byKey = new Map<string, MutableNode>();
  let other: MutableNode | null = null;
  for (const c of parent.childByCode.values()) {
    if (c.key === PIVOT_OTHER_KEY) other = c;
    else byKey.set(c.key, c);
  }
  let ordered = orderPivotKeys([...byKey.keys()], dim, false).map((k) => byKey.get(k)!);
  if (dim.sortBy) ordered = rankNodes(ordered, dim.sortBy.measure, dim.sortBy.direction ?? "desc", dim.sortBy.columnKey ?? null, value);
  if (other) ordered.push(other);
  return ordered;
}

/** Stable sort by value; nodes without a value always last. */
function rankNodes(
  nodes: readonly MutableNode[],
  measureId: string,
  direction: "asc" | "desc" | "top" | "bottom",
  columnKey: string | null,
  value: (node: MutableNode, measureId: string, columnKey: string | null) => number | null,
): MutableNode[] {
  const sign = direction === "asc" || direction === "bottom" ? 1 : -1;
  const keyed = nodes.map((node) => ({ node, v: value(node, measureId, columnKey) }));
  keyed.sort((a, b) => {
    if (a.v === null || b.v === null) return a.v === null ? (b.v === null ? 0 : 1) : -1;
    return sign * (a.v - b.v);
  });
  return keyed.map((k) => k.node);
}

/**
 * Filter, rank and aggregate `rows` for `spec` (see `PivotCube`). The spec is not validated here;
 * `buildPivotModel` / `createPivotModelBuilder` validate first.
 *
 * Order of operations: report / label filters (records) → Top N per row level, outermost first,
 * each ranked on what the levels above kept → aggregation → sibling ordering.
 */
export function buildPivotCube(spec: PivotSpec, rows: readonly PivotDataRow[], options: BuildPivotCubeOptions = {}): PivotCube {
  const enc = options.encoding && options.encoding.rows === rows ? options.encoding : createPivotRowEncoding(rows);
  const registry = options.aggregators ?? {};
  const n = enc.length;
  const dims = spec.rows;
  const leafDepth = dims.length - 1;
  const colDim = spec.columns ?? null;

  // ---- Filters + facets (one pass) ----------------------------------------
  const compiled = compilePivotFilters(spec.filters, enc);
  const facetFields = (spec.facets ?? []).map(pivotFacetField);
  const pass = runPivotFilterPass(compiled, facetFields, enc);
  let mask = pass.mask;

  // ---- Encoded levels / columns ----------------------------------------------
  const levelEnc = dims.map((d) => enc.codes(d.field));
  const levelCodes: Int32Array[] = levelEnc.map((e) => e.codes);
  const levelKeys: (readonly string[])[] = levelEnc.map((e) => e.keys);
  const colEnc = colDim ? enc.codes(colDim.field) : null;
  const colCodes = colEnc ? colEnc.codes : null;
  const buckets = colEnc ? colEnc.keys.length : 0;
  const attributeFields = dims.map((d) => d.attributes);

  // ---- Measures ---------------------------------------------------------------
  let off = 1;
  const compiledMeasures = new Map<string, CompiledMeasure>();
  for (const m of spec.measures) {
    const cm = compileMeasure(m, off, enc);
    off += SLOTS[cm.kind];
    compiledMeasures.set(m.id, cm);
  }
  const custom = [...compiledMeasures.values()].some((m) => m.kind === Kind.Custom);
  const bucketOf = (columnKey: string | null): number => {
    if (columnKey === null || !colEnc) return buckets;
    const c = colEnc.index.get(columnKey);
    return c === undefined ? -1 : c;
  };
  const valueFor =
    (S: number, measures: ReadonlyMap<string, CompiledMeasure>) =>
    (node: MutableNode, measureId: string, columnKey: string | null): number | null => {
      const b = bucketOf(columnKey);
      return b < 0 ? null : readValue(node, measures.get(measureId)!, b, S, rows, registry);
    };

  // ---- Top N, outermost level first -------------------------------------------
  const otherCounts = new Map<string, number>();
  for (let d = 0; d <= leafDepth; d++) {
    const top = dims[d]!.topN;
    if (!top) continue;
    const rankMeasure = { ...compiledMeasures.get(top.measure)!, off: 1 };
    const S = 1 + SLOTS[rankMeasure.kind];
    const nodeAt = new Int32Array(n);
    const { root, nodes } = buildTree({
      n,
      mask,
      levelCodes,
      levelKeys,
      colCodes,
      buckets,
      measures: [rankMeasure],
      slots: S,
      maxDepth: d,
      attributeFields: [],
      rows,
      custom: rankMeasure.kind === Kind.Custom,
      nodeAtMaxDepth: nodeAt,
    });
    const value = valueFor(S, new Map([[top.measure, rankMeasure]]));
    const excluded = new Uint8Array(nodes.length);
    let any = false;
    const visit = (parent: MutableNode) => {
      if (parent.depth === d - 1) {
        const natural = orderChildren(parent, { ...dims[d]!, sortBy: undefined }, value);
        if (natural.length > top.count) {
          const ranked = rankNodes(natural, top.measure, top.direction ?? "top", top.columnKey ?? null, value);
          for (let k = top.count; k < ranked.length; k++) excluded[ranked[k]!.id] = 1;
          if (top.other) otherCounts.set(JSON.stringify(parent.path), ranked.length - top.count);
          any = true;
        }
        return;
      }
      for (const c of parent.childByCode.values()) visit(c);
    };
    visit(root);
    if (!any) continue;
    if (top.other) {
      const otherCode = levelKeys[d]!.length;
      const codes = Int32Array.from(levelCodes[d]!);
      for (let i = 0; i < n; i++) if (nodeAt[i]! >= 0 && excluded[nodeAt[i]!]) codes[i] = otherCode;
      levelCodes[d] = codes;
      levelKeys[d] = [...levelKeys[d]!, PIVOT_OTHER_KEY];
    } else {
      const next = mask ? Uint8Array.from(mask) : new Uint8Array(n).fill(1);
      for (let i = 0; i < n; i++) if (nodeAt[i]! >= 0 && excluded[nodeAt[i]!]) next[i] = 0;
      mask = next;
    }
  }

  // ---- Final tree -------------------------------------------------------------
  const S = off;
  const { root } = buildTree({
    n,
    mask,
    levelCodes,
    levelKeys,
    colCodes,
    buckets,
    measures: [...compiledMeasures.values()],
    slots: S,
    maxDepth: leafDepth,
    attributeFields,
    rows,
    custom,
  });
  const value = valueFor(S, compiledMeasures);

  const ordered: MutableNode[] = [];
  const seenColumns = new Uint8Array(buckets);
  const walk = (node: MutableNode) => {
    if (node.depth < leafDepth) node.children = orderChildren(node, dims[node.depth + 1]!, value);
    for (const c of node.children) {
      if (c.key === PIVOT_OTHER_KEY) c.otherCount = otherCounts.get(JSON.stringify(node.path));
      ordered.push(c);
      walk(c);
    }
  };
  walk(root);

  // Column keys in first-seen order among matching records.
  let columnKeys: string[] = [];
  if (colDim && colCodes) {
    const firstSeen: number[] = [];
    for (let i = 0; i < n; i++) {
      if (mask !== null && mask[i] === 0) continue;
      const c = colCodes[i]!;
      if (seenColumns[c] === 0) {
        seenColumns[c] = 1;
        firstSeen.push(c);
        if (firstSeen.length === buckets) break;
      }
    }
    columnKeys = orderPivotKeys(
      firstSeen.map((c) => colEnc!.keys[c]!),
      colDim,
      colDim.keepEmpty === true,
    );
  }

  // ---- Facets -------------------------------------------------------------------
  const facets = facetFields.map((field) => facetOf(field, pass.facets.get(field)!, spec));

  return {
    root,
    nodes: ordered,
    columnKeys,
    valueOf: (node, measureId, columnKey) => value(node as MutableNode, measureId, columnKey),
    recordCount: { total: n, matched: root.rowCount },
    facets,
  };
}

function facetOf(field: string, counts: PivotFacetCounts, spec: PivotSpec): PivotCubeFacet {
  const dim = spec.rows.find((d) => d.field === field) ?? (spec.columns?.field === field ? spec.columns : undefined);
  const keys = counts.codes.keys;
  const ordered = dim ? orderPivotKeys(keys, dim, false) : [...keys].sort(comparePivotKeys);
  const codeOf = counts.codes.index;
  return {
    field,
    keys: ordered,
    counts: ordered.map((k) => counts.counts[codeOf.get(k)!]!),
    totals: ordered.map((k) => counts.codes.counts[codeOf.get(k)!]!),
    selected: counts.allowed ? ordered.map((k) => counts.allowed![codeOf.get(k)!] === 1) : null,
  };
}
