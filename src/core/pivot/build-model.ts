import type { PivotAggregatorRegistry } from "./aggregate";
import {
  buildPivotCube,
  computePivotFacet,
  PIVOT_OTHER_KEY,
  pivotDrillThrough,
  pivotFacetField,
  pivotSpecDataKey,
  type PivotDrillThroughOptions,
  type PivotDrillThroughResult,
  type PivotDrillThroughTarget,
  type PivotCube,
  type PivotCubeColumn,
  type PivotCubeFacet,
  type PivotCubeNode,
} from "./cube";
import { pivotColumnFields, pivotDimensionOf } from "./columns";
import { pivotDateGroupLabel, pivotDateLabel, resolvePivotDateField, type PivotDateFieldDef } from "./dates";
import { createPivotRowEncoding, type PivotRowEncoding } from "./encode";
import { describePivotFilter, isPivotFilterActive } from "./filter";
import {
  DEFAULT_PIVOT_DELTA_FORMAT,
  DEFAULT_PIVOT_PERCENT_FORMAT,
  formatPivotNumber,
  PIVOT_RANK_FORMAT,
  pivotShowAsFormatKind,
  toExcelNumFmt,
} from "./format";
import { pivotHeatLevel, type PivotHeatDomain } from "./heat";
import { computePivotRowSpans } from "./row-spans";
import {
  PIVOT_SPEC_VERSION,
  type PivotActiveFilter,
  type PivotBodyRow,
  type PivotCell,
  type PivotHeaderSeriesPoint,
  type PivotDataRow,
  type PivotDimension,
  type PivotFacet,
  type PivotFacetSpec,
  type PivotHeaderCell,
  type PivotHeaderSeries,
  type PivotKey,
  type PivotKpiValue,
  type PivotMeasure,
  type PivotModel,
  type PivotModelDimension,
  type PivotShowAs,
  type PivotSpec,
  type PivotValueColumn,
} from "./types";
import { assertPivotSpec, PIVOT_SHOW_AS_WITH_BASE } from "./validate";

export interface BuildPivotModelOptions {
  /** Named aggregators for `{ type: "custom", name }` measures. */
  readonly aggregators?: PivotAggregatorRegistry;
  /** Validate the spec first (default true — specs often arrive as JSON from another runtime). */
  readonly validate?: boolean;
}

export const PIVOT_GRAND_TOTAL_ROW_ID = "__grandTotal__";

/** Stable row id for a key path (also usable as a React key). */
export function pivotPathId(path: readonly string[]): string {
  return `r:${path.map(encodeURIComponent).join("/")}`;
}

/** Row id of a group's `subtotal: "end"` row. */
export function pivotSubtotalRowId(path: readonly string[]): string {
  return `t:${path.map(encodeURIComponent).join("/")}`;
}

/** Stable value-column id. `columnKey === null` → row-total (or measure-only) column. */
export function pivotColumnId(columnKey: string | null, measureId: string, isRowTotal = false): string {
  if (isRowTotal) return `t:${measureId}`;
  return columnKey === null ? `m:${measureId}` : `c:${encodeURIComponent(columnKey)}:${measureId}`;
}

const labelOf = (key: string, dim: PivotDimension, date: PivotDateFieldDef | null = null): string =>
  key === PIVOT_OTHER_KEY
    ? (dim.topN?.otherLabel ?? "Other")
    : key === ""
      ? (dim.blankLabel ?? "(blank)")
      : date
        ? pivotDateLabel(key, date)
        : key;

/** `priorYear` → `Prior Year` (same rule as `humanizePivotField`, duplicated to keep imports acyclic). */
const humanize = (field: string): string =>
  field
    .replace(/[_\-.]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ") || field;

/**
 * Default label of a derived date field: its catalogue label, else `Year (Order Date)` from the
 * group and the source field's label (`fieldLabels` › catalogue label › humanized name).
 */
export function pivotDateFieldLabel(spec: Pick<PivotSpec, "fields" | "fieldLabels">, def: PivotDateFieldDef): string {
  const own = spec.fieldLabels?.[def.field] ?? spec.fields?.find((f) => f.field === def.field)?.label;
  if (own) return own;
  const source = spec.fieldLabels?.[def.source] ?? spec.fields?.find((f) => f.field === def.source)?.label ?? humanize(def.source);
  return `${pivotDateGroupLabel(def.group)} (${source})`;
}

/** Header label of a dimension: its `label`, else the date-field label, else the field. */
function dimensionLabel(spec: PivotSpec, d: PivotDimension, date: PivotDateFieldDef | null): string {
  return d.label ?? (date ? pivotDateFieldLabel(spec, date) : d.field);
}

/** `{label} Total` → `FY26 Total`. */
const subtotalText = (template: string, label: string) => template.split("{label}").join(label);

function divide(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return a / b;
}

const BLANK_CELL: PivotCell = { value: null, raw: null, text: "" };

/**
 * The values of an item's siblings along a base field (`valueOf(j)`: the corresponding value of
 * sibling `j`, `null` without data), shared by every cell that reads the same siblings. Running sums
 * and sorted values are derived once on first use, so a running total is one lookup and a rank one
 * binary search per cell (instead of a scan of every sibling, which made a field with k items O(k²)).
 */
interface AlongSeries {
  readonly count: number;
  readonly valueOf: (j: number) => number | null;
  /** `prefix[j]`: sum of the values of siblings `0…j` (missing values count as 0), summed in order. */
  prefix?: Float64Array;
  /** Values of the siblings with a value, ascending (`NaN` left out: it never compares). */
  sorted?: Float64Array;
}

/** Most siblings that a cell scans directly (as before) instead of sharing a cached series. */
const ALONG_SCAN_MAX = 32;

function alongPrefix(s: AlongSeries): Float64Array {
  if (!s.prefix) {
    const prefix = new Float64Array(s.count);
    let run = 0;
    for (let j = 0; j < s.count; j++) {
      run += s.valueOf(j) ?? 0;
      prefix[j] = run;
    }
    s.prefix = prefix;
  }
  return s.prefix;
}

function alongSorted(s: AlongSeries): Float64Array {
  if (!s.sorted) {
    const values: number[] = [];
    for (let j = 0; j < s.count; j++) {
      const v = s.valueOf(j);
      if (v !== null && v === v) values.push(v);
    }
    s.sorted = Float64Array.from(values).sort();
  }
  return s.sorted;
}

/** Number of entries of ascending `sorted` below `x` (`orEqual`: at most `x`). */
function countBelow(sorted: Float64Array, x: number, orEqual: boolean): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (orEqual ? sorted[mid]! <= x : sorted[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * A difference / running total / rank along a base field, for an item at `index` among its
 * siblings (`series`). `baseIndex`: the difference base (`-1`: none). See "Show values as" in
 * `docs/pivot-headless.md`.
 */
function showAsAlong(kind: string, raw: number | null, index: number, series: AlongSeries, baseIndex: number): number | null {
  if (raw === null) return null;
  switch (kind) {
    case "differenceFrom":
    case "percentDifferenceFrom": {
      if (baseIndex < 0 || baseIndex === index) return null;
      const base = series.valueOf(baseIndex);
      if (base === null) return null;
      return kind === "differenceFrom" ? raw - base : divide(raw - base, base);
    }
    case "runningTotal":
    case "percentRunningTotal": {
      if (series.count <= ALONG_SCAN_MAX) {
        let run = 0;
        for (let j = 0; j <= index; j++) run += series.valueOf(j) ?? 0;
        if (kind === "runningTotal") return run;
        let total = run;
        for (let j = index + 1; j < series.count; j++) total += series.valueOf(j) ?? 0;
        return divide(run, total);
      }
      // Same additions in the same order as the scan above.
      const prefix = alongPrefix(series);
      const run = prefix[index]!;
      if (kind === "runningTotal") return run;
      return divide(run, prefix[series.count - 1]!);
    }
    default: {
      // rankAscending / rankDescending: competition ranking (1, 2, 2, 4) among siblings with a value.
      if (series.count <= ALONG_SCAN_MAX) {
        let rank = 1;
        for (let j = 0; j < series.count; j++) {
          const v = series.valueOf(j);
          if (v !== null && (kind === "rankAscending" ? v < raw : v > raw)) rank++;
        }
        return rank;
      }
      if (raw !== raw) return 1;
      const sorted = alongSorted(series);
      return 1 + (kind === "rankAscending" ? countBelow(sorted, raw, false) : sorted.length - countBelow(sorted, raw, true));
    }
  }
}

/** Cells outside the base field's levels (above it, totals): running totals show the value itself, the rest blank. */
function showAsOutside(kind: string, raw: number | null): number | null {
  if (kind === "runningTotal") return raw;
  if (kind === "percentRunningTotal") return raw === null || raw === 0 ? null : 1;
  return null;
}

/** Difference base among `count` siblings: the previous / next sibling (`-1`: none). */
function baseIndexOf(count: number, index: number, position: "previous" | "next" | undefined): number {
  const j = position === "next" ? index + 1 : index - 1;
  return j >= 0 && j < count ? j : -1;
}

/**
 * Compute the full pivot — filters, Top N, groups, subtotals, "show values as", heat levels,
 * header series, KPIs, facets, row spans and formatted text — as plain JSON. Pure and
 * deterministic: the same `(spec, rows)` gives the same model in a browser, Tauri webview or
 * Node export process.
 *
 * Internally `buildPivotCube` (filter + aggregate, the expensive part) followed by
 * `pivotModelFromCube` (view state). Use `createPivotModelBuilder` to reuse the cube across
 * view-only changes.
 */
export function buildPivotModel(
  specInput: PivotSpec,
  data: readonly PivotDataRow[],
  options: BuildPivotModelOptions = {},
): PivotModel {
  const spec = options.validate === false ? specInput : assertPivotSpec(specInput);
  return pivotModelFromCube(buildPivotCube(spec, data, { aggregators: options.aggregators }), spec);
}

/**
 * Label of a field for summaries / slicers: dimension label, facet label, filter label, the
 * date-field label for derived date fields (`Year (Order Date)`), else the field.
 */
export function pivotFieldLabel(spec: PivotSpec, field: string): string {
  const dim = pivotDimensionOf(spec, field);
  if (dim?.label) return dim.label;
  for (const f of spec.facets ?? []) if (typeof f !== "string" && f.field === field && f.label) return f.label;
  for (const f of spec.filters ?? []) if (f.field === field && f.label) return f.label;
  const date = resolvePivotDateField(spec, field);
  return date ? pivotDateFieldLabel(spec, date) : field;
}

/**
 * Display label of a key of `field`: `""` → the dimension's `blankLabel` (default `(blank)`), date
 * keys → their date label (`2026-01` → `Jan 2026`), other keys unchanged.
 */
export function pivotKeyLabeler(spec: PivotSpec, field: string): (key: string) => string {
  const dim = pivotDimensionOf(spec, field);
  const blank = dim?.blankLabel ?? "(blank)";
  const date = resolvePivotDateField(spec, field);
  return (key) => (key === "" ? blank : date ? pivotDateLabel(key, date) : key);
}
const keyLabeler = pivotKeyLabeler;

/** Printable active filters: report / label filters in spec order, then Top N per row level. */
export function describePivotFilters(spec: PivotSpec): PivotActiveFilter[] {
  const out: PivotActiveFilter[] = [];
  for (const f of spec.filters ?? []) {
    if (!isPivotFilterActive(f)) continue;
    const label = f.label ?? pivotFieldLabel(spec, f.field);
    for (const part of describePivotFilter(f, label, keyLabeler(spec, f.field))) out.push({ field: f.field, label, ...part });
  }
  for (const d of spec.rows) {
    if (!d.topN) continue;
    const label = pivotFieldLabel(spec, d.field);
    const m = spec.measures.find((x) => x.id === d.topN!.measure);
    const by = m?.label ?? d.topN.measure;
    const column = d.topN.columnKey !== undefined ? ` (${d.topN.columnKey})` : "";
    const other = d.topN.other ? `, rest as ${d.topN.otherLabel ?? "Other"}` : "";
    const dir = d.topN.direction === "bottom" ? "Bottom" : "Top";
    out.push({ field: d.field, label, kind: "value", text: `${label}: ${dir} ${d.topN.count} by ${by}${column}${other}` });
  }
  return out;
}

/** One header item of a value column (a column key, measure or total), covering header rows `start…end`. */
interface HeaderItem {
  /** Identity within its parent (merged into one header cell with equal neighbours). */
  readonly id: string;
  readonly label: string;
  readonly kind: "dim" | "measure" | "total";
  readonly start: number;
  readonly end: number;
  readonly columnKey?: string | null;
  readonly measureId?: string;
  readonly column?: PivotCubeColumn;
  readonly expanded?: boolean;
  readonly subtotal?: boolean;
}

/** What a value column shows: a leaf, a group's subtotal / collapsed total, the grand total, or (no columns) the measure. */
interface ColumnSlot {
  readonly kind: "leaf" | "subtotal" | "collapsed" | "total" | "measure";
  readonly column: PivotCubeColumn | null;
  readonly columnKey: string | null;
  /** Label used by `columnKeys` / header series (labels joined by spaces). */
  readonly label: string;
}

/**
 * The view half of `buildPivotModel`: columns, cells (visible rows only), heat, KPIs, header
 * series, spans and facets from an aggregated `cube`. `spec` must be the (validated) spec the cube
 * was built from, apart from view-only fields (see `pivotSpecDataKey`).
 */
export function pivotModelFromCube(cube: PivotCube, spec: PivotSpec): PivotModel {
  const dims = spec.rows;
  const colDims = pivotColumnFields(spec);
  const levels = colDims.length;
  const leafDepth = dims.length - 1;
  const totals = spec.totals ?? {};
  const grandLabel = totals.grandTotalLabel ?? "Grand Total";
  const rowTotalLabel = totals.rowTotalLabel ?? "Total";
  const subtotalTemplate = totals.subtotalLabel ?? "{label} Total";
  const root = cube.root;
  const colRoot = cube.columnRoot;
  const totalBucket = colRoot.bucket;

  const measureById = new Map(spec.measures.map((m) => [m.id, m] as const));
  const measureOf = (id: string): PivotMeasure => measureById.get(id)!;
  const measureLabel = (m: PivotMeasure) => m.label ?? m.id;
  const valueMeasures = (spec.values ?? spec.measures.map((m) => m.id)).map(measureOf);
  const valueAt = (node: PivotCubeNode, m: PivotMeasure, bucket: number) => cube.valueAt(node, m.id, bucket);
  const rowDates = dims.map((d) => resolvePivotDateField(spec, d.field));
  const colDates = colDims.map((d) => resolvePivotDateField(spec, d.field));
  const nodeLabel = (n: PivotCubeNode) => (n.depth < 0 ? grandLabel : labelOf(n.key, dims[n.depth]!, rowDates[n.depth]));
  const colLabel = (c: PivotCubeColumn) => labelOf(c.key, colDims[c.depth]!, colDates[c.depth]);

  // ---- Column layout ---------------------------------------------------------
  const multi = valueMeasures.length > 1;
  /** Header row of the Σ Values level (`valuesIndex`), `-1` with one value measure or no column field. */
  const sigma = multi && levels > 0 ? Math.max(0, Math.min(levels, spec.valuesIndex ?? levels)) : -1;
  const headerCount = levels === 0 ? 1 : levels + (sigma >= 0 ? 1 : 0);
  const rowOf = (level: number) => level + (sigma >= 0 && sigma <= level ? 1 : 0);
  const expandedSpec = spec.columnsExpanded ?? "all";
  const expandedColumnIds = Array.isArray(expandedSpec) ? new Set(expandedSpec.map((p) => pivotPathId(p))) : null;
  const columnExpanded = (c: PivotCubeColumn) =>
    expandedSpec === "all" || (expandedColumnIds !== null && expandedColumnIds.has(pivotPathId(c.path)));
  const pathLabel = (c: PivotCubeColumn): string => {
    const parts: string[] = [];
    for (let p: PivotCubeColumn | null = c; p !== null && p.depth >= 0; p = p.parent) parts.unshift(colLabel(p));
    return parts.join(" ");
  };

  const descs: { readonly slot: ColumnSlot; readonly measure: PivotMeasure; readonly items: readonly HeaderItem[] }[] = [];
  const measureItem = (m: PivotMeasure, row: number): HeaderItem => ({ id: `m:${m.id}`, label: measureLabel(m), kind: "measure", start: row, end: row, measureId: m.id });
  /** Emit one column per value measure (when the Σ level is still open) or for the fixed measure. */
  const emit = (slot: ColumnSlot, items: readonly HeaderItem[], m: PivotMeasure | null, measureRow: number) => {
    if (sigma >= 0 && m === null) for (const v of valueMeasures) descs.push({ slot, measure: v, items: [...items, measureItem(v, measureRow)] });
    else descs.push({ slot, measure: m ?? valueMeasures[0]!, items });
  };
  const groupTotal = (c: PivotCubeColumn, prefix: readonly HeaderItem[], m: PivotMeasure | null, collapsed: boolean) => {
    const label = collapsed ? colLabel(c) : subtotalText(subtotalTemplate, colLabel(c));
    const open = sigma >= 0 && m === null;
    const item: HeaderItem = {
      id: `${collapsed ? "c" : "s"}:${c.columnKey}`,
      label,
      kind: "total",
      start: rowOf(c.depth),
      end: open ? headerCount - 2 : headerCount - 1,
      columnKey: c.columnKey,
      column: c,
      ...(collapsed ? { expanded: false } : { subtotal: true }),
    };
    const slot: ColumnSlot = { kind: collapsed ? "collapsed" : "subtotal", column: c, columnKey: c.columnKey, label: collapsed ? pathLabel(c) : label };
    emit(slot, [...prefix, item], m, headerCount - 1);
  };
  const walk = (children: readonly PivotCubeColumn[], level: number, m: PivotMeasure | null, prefix: readonly HeaderItem[]) => {
    if (sigma >= 0 && m === null && level === sigma && level < levels) {
      for (const v of valueMeasures) walk(children, level, v, [...prefix, measureItem(v, rowOf(level) - 1)]);
      return;
    }
    for (const c of children) {
      const item: HeaderItem = { id: `d:${c.columnKey}`, label: colLabel(c), kind: "dim", start: rowOf(level), end: rowOf(level), columnKey: c.columnKey, column: c };
      if (level === levels - 1) {
        emit({ kind: "leaf", column: c, columnKey: c.columnKey, label: levels === 1 ? colLabel(c) : pathLabel(c) }, [...prefix, item], m, headerCount - 1);
      } else if (!columnExpanded(c) || c.children.length === 0) {
        groupTotal(c, prefix, m, true);
      } else {
        const placement = colDims[level]!.subtotal ?? "end";
        if (placement === "start") groupTotal(c, prefix, m, false);
        walk(c.children, level + 1, m, [...prefix, { ...item, expanded: true }]);
        if (placement === "end") groupTotal(c, prefix, m, false);
      }
    }
  };
  if (levels === 0) {
    for (const v of valueMeasures) descs.push({ slot: { kind: "measure", column: null, columnKey: null, label: measureLabel(v) }, measure: v, items: [measureItem(v, 0)] });
  } else {
    walk(colRoot.children, 0, null, []);
    if (totals.rowTotal) {
      const item: HeaderItem = { id: "t", label: rowTotalLabel, kind: "total", start: 0, end: multi ? headerCount - 2 : headerCount - 1, columnKey: null };
      emit({ kind: "total", column: null, columnKey: null, label: rowTotalLabel }, [item], null, headerCount - 1);
    }
  }

  const nested = levels > 1;
  const columns: PivotValueColumn[] = descs.map(({ slot, measure: m, items }) => {
    const format = m.format ?? {};
    const percentFormat = m.percentFormat ?? DEFAULT_PIVOT_PERCENT_FORMAT;
    const id =
      slot.kind === "leaf"
        ? pivotColumnId(slot.columnKey, m.id)
        : slot.kind === "total"
          ? pivotColumnId(null, m.id, true)
          : slot.kind === "measure"
            ? pivotColumnId(null, m.id)
            : `s:${encodeURIComponent(slot.columnKey!)}:${m.id}`;
    const columnLabel = slot.kind === "measure" ? null : slot.kind === "leaf" ? [...items].reverse().find((it) => it.kind === "dim")!.label : items.find((it) => it.kind === "total")!.label;
    return {
      id,
      columnKey: slot.columnKey,
      columnLabel,
      measureId: m.id,
      measureLabel: measureLabel(m),
      headerPath: items.map((it) => it.label),
      format,
      percentFormat,
      excelNumFmt: toExcelNumFmt(format),
      excelPercentNumFmt: toExcelNumFmt(percentFormat),
      ...(nested && slot.column ? { columnPath: slot.column.path } : {}),
      ...(slot.kind === "subtotal" || slot.kind === "collapsed" ? { subtotal: true as const } : {}),
      ...(slot.kind === "collapsed" ? { collapsed: true as const } : {}),
    };
  });
  const columnMeasures = descs.map((d) => d.measure);
  const columnBuckets = descs.map((d) => (d.slot.column ? d.slot.column.bucket : totalBucket));
  /** `percentOfParentColumn` denominator: the enclosing column group, else the row total. */
  const parentBuckets = descs.map((d) => {
    const parent = d.slot.column?.parent ?? null;
    return parent !== null && parent.depth >= 0 ? parent.bucket : totalBucket;
  });

  // "Show values as" along a field (differences, running totals, ranks): the base field's level on
  // rows or columns, per measure; along a column field, each value column's sibling buckets.
  const rowLevelOf = new Map(dims.map((d, i) => [d.field, i] as const));
  const colLevelOf = new Map(colDims.map((d, i) => [d.field, i] as const));
  const colChildCache = new Map<PivotCubeColumn, Map<string, PivotCubeColumn>>();
  const colChild = (c: PivotCubeColumn, key: string): PivotCubeColumn | undefined => {
    let map = colChildCache.get(c);
    if (!map) colChildCache.set(c, (map = new Map(c.children.map((x) => [x.key, x] as const))));
    return map.get(key);
  };
  const columnAlongGroups = new Map<string, number>();
  /** Per value column with a column-field base: the corresponding bucket of every sibling, own index, base, series group. */
  const columnAlong = descs.map((d) => {
    const m = d.measure;
    const base = m.showAsBase;
    if (!base || !(PIVOT_SHOW_AS_WITH_BASE.has(m.showAs ?? "") || PIVOT_SHOW_AS_WITH_BASE.has(m.groupShowAs ?? ""))) return null;
    const level = colLevelOf.get(base.field);
    const c = d.slot.column;
    if (level === undefined || c === null || c.depth < level) return null;
    let a: PivotCubeColumn = c;
    while (a.depth > level) a = a.parent!;
    const siblings = a.parent!.children;
    const rel = c.path.slice(level + 1);
    const buckets = siblings.map((s) => {
      let x: PivotCubeColumn | undefined = s;
      for (const key of rel) {
        x = colChild(x, key);
        if (!x) return -1;
      }
      return x.bucket;
    });
    const keys = siblings.map((s) => s.key);
    const index = siblings.indexOf(a);
    // Columns reading the same measure over the same sibling buckets share one series per row.
    const groupKey = `${m.id}\u0000${buckets.join(",")}`;
    let group = columnAlongGroups.get(groupKey);
    if (group === undefined) columnAlongGroups.set(groupKey, (group = columnAlongGroups.size));
    return { buckets, index, baseIndex: base.item !== undefined ? keys.indexOf(base.item) : baseIndexOf(keys.length, index, base.position), group };
  });
  const childCache = new Map<PivotCubeNode, Map<string, PivotCubeNode>>();
  const childOf = (n: PivotCubeNode, key: string): PivotCubeNode | undefined => {
    let map = childCache.get(n);
    if (!map) childCache.set(n, (map = new Map(n.children.map((x) => [x.key, x] as const))));
    return map.get(key);
  };
  const siblingIndex = new Map<PivotCubeNode, number>();
  const indexInParent = (n: PivotCubeNode): number => {
    if (!siblingIndex.has(n)) n.parent!.children.forEach((c, j) => siblingIndex.set(c, j));
    return siblingIndex.get(n)!;
  };
  /** Column-field series of the row being formatted (`cellsOf` formats one row at a time), by series group. */
  let columnSeriesNode: PivotCubeNode | null = null;
  let columnSeries: (AlongSeries | undefined)[] = [];
  /**
   * Row-field series per value column, for the current parent at the base level only: nodes under
   * one parent are contiguous in display order, so this keeps memory to one sibling group's series.
   */
  const rowSeries: ({ readonly parent: PivotCubeNode; readonly byRel: Map<string, AlongSeries> } | undefined)[] = [];
  /**
   * Show-as value of `node` in column `i` along its measure's base field: along a column field via
   * `columnAlong`, along a row field via the node's ancestor at that level and its siblings (the
   * corresponding descendant of each sibling, same column). Cells above the base level, and columns
   * outside a column base's levels, get `showAsOutside`.
   */
  const alongValue = (kind: string, node: PivotCubeNode, m: PivotMeasure, i: number, raw: number | null): number | null => {
    const base = m.showAsBase;
    if (!base) return null;
    const colAlong = columnAlong[i];
    if (colAlong) {
      const { buckets, index, baseIndex, group } = colAlong;
      if (raw === null) return null;
      if (buckets.length <= ALONG_SCAN_MAX) return showAsAlong(kind, raw, index, { count: buckets.length, valueOf: (j) => valueAt(node, m, buckets[j]!) }, baseIndex);
      if (columnSeriesNode !== node) {
        columnSeriesNode = node;
        columnSeries = [];
      }
      let series = columnSeries[group];
      if (!series) columnSeries[group] = series = { count: buckets.length, valueOf: (j) => valueAt(node, m, buckets[j]!) };
      return showAsAlong(kind, raw, index, series, baseIndex);
    }
    const level = rowLevelOf.get(base.field);
    if (level === undefined || node.depth < level) return showAsOutside(kind, raw);
    if (raw === null) return null;
    let a = node;
    while (a.depth > level) a = a.parent!;
    const parent = a.parent!;
    const siblings = parent.children;
    const rel = node.path.slice(level + 1);
    const index = indexInParent(a);
    const bucket = columnBuckets[i]!;
    const valueOf = (j: number): number | null => {
      let x: PivotCubeNode | undefined = siblings[j];
      for (const key of rel) {
        x = childOf(x!, key);
        if (!x) return null;
      }
      return valueAt(x!, m, bucket);
    };
    if (kind === "differenceFrom" || kind === "percentDifferenceFrom") {
      let baseIndex: number;
      if (base.item !== undefined) {
        const item = childOf(parent, base.item);
        baseIndex = item ? indexInParent(item) : -1;
      } else {
        baseIndex = baseIndexOf(siblings.length, index, base.position);
      }
      return showAsAlong(kind, raw, index, { count: siblings.length, valueOf }, baseIndex);
    }
    // A few siblings: scanning them per cell is cheaper than keying a shared series.
    if (siblings.length <= ALONG_SCAN_MAX) return showAsAlong(kind, raw, index, { count: siblings.length, valueOf }, -1);
    let state = rowSeries[i];
    if (!state || state.parent !== parent) rowSeries[i] = state = { parent, byRel: new Map() };
    const relKey = rel.length === 0 ? "" : JSON.stringify(rel);
    let series = state.byRel.get(relKey);
    if (!series) state.byRel.set(relKey, (series = { count: siblings.length, valueOf }));
    return showAsAlong(kind, raw, index, series, -1);
  };

  // Header rows: one cell per run of adjacent columns sharing the same items down to that row.
  const headerRows: PivotHeaderCell[][] = [];
  for (let r = 0; r < headerCount; r++) {
    const out: PivotHeaderCell[] = [];
    let prev: { ident: string; index: number; cell: { colSpan: number } } | null = null;
    descs.forEach((d, ci) => {
      const at = d.items.findIndex((it) => it.start === r);
      if (at < 0) return; // covered by a cell spanning down from above
      const item = d.items[at]!;
      const ident = d.items
        .slice(0, at + 1)
        .map((it) => it.id)
        .join("\u0001");
      if (prev && prev.ident === ident && prev.index === ci - 1) {
        prev.cell.colSpan++;
        prev.index = ci;
        return;
      }
      const prefix = d.items.slice(0, at + 1);
      const keyItem = [...prefix].reverse().find((it) => it.kind !== "measure");
      const measureIt = prefix.find((it) => it.kind === "measure");
      const columnKey = levels === 0 ? null : keyItem ? keyItem.columnKey : undefined;
      const measureId = measureIt ? measureIt.measureId : item.end === headerCount - 1 ? d.measure.id : undefined;
      const rowSpan = item.end - item.start + 1;
      const c = item.column;
      const cell = {
        label: item.label,
        colSpan: 1,
        ...(rowSpan > 1 ? { rowSpan } : {}),
        ...(columnKey !== undefined ? { columnKey } : {}),
        ...(measureId !== undefined ? { measureId } : {}),
        ...(nested && c && item.kind !== "measure" ? { columnPath: c.path, columnLevel: c.depth } : {}),
        ...(nested && item.expanded !== undefined ? { expanded: item.expanded } : {}),
        ...(item.subtotal ? { subtotal: true as const } : {}),
      };
      out.push(cell);
      prev = { ident, index: ci, cell };
    });
    headerRows.push(out);
  }
  // A header row nothing starts in (e.g. every group collapsed) is dropped; cells spanning it shrink.
  for (let r = headerRows.length - 1; r > 0; r--) {
    if (headerRows[r]!.length || !descs.length) continue;
    headerRows.splice(r, 1);
    for (let above = 0; above < r; above++) {
      headerRows[above] = headerRows[above]!.map((h) => {
        if ((h.rowSpan ?? 1) <= r - above) return h;
        const { rowSpan, ...rest } = h;
        return rowSpan! - 1 > 1 ? { ...rest, rowSpan: rowSpan! - 1 } : (rest as PivotHeaderCell);
      });
    }
  }

  // Leaf / collapsed slots in display order (columnKeys, header bars).
  const slots: ColumnSlot[] = [];
  const slotIds = new Map<string, string>();
  for (let i = 0; i < descs.length; i++) {
    const slot = descs[i]!.slot;
    if ((slot.kind !== "leaf" && slot.kind !== "collapsed") || slotIds.has(slot.columnKey!)) continue;
    slotIds.set(slot.columnKey!, slot.kind);
    slots.push(slot);
  }
  const columnKeys: PivotKey[] =
    levels === 0 ? [] : levels === 1 ? cube.columnKeys.map((key) => ({ key, label: labelOf(key, colDims[0]!, colDates[0]!) })) : slots.map((s) => ({ key: s.columnKey!, label: s.label }));

  // ---- Visibility --------------------------------------------------------------
  const isLeaf = (n: PivotCubeNode) => n.depth === leafDepth;
  const expandedRows = spec.expanded ?? "all";
  const expandedIds =
    expandedRows === "all" || expandedRows === "none" ? null : new Set(expandedRows.map((p) => pivotPathId(p)));
  const isExpanded = (n: PivotCubeNode) =>
    !isLeaf(n) && (expandedRows === "all" || (expandedIds !== null && expandedIds.has(pivotPathId(n.path))));
  const visible: PivotCubeNode[] = [];
  /** Body entries in display order: a node's row, or (`subtotal`) its `subtotal: "end"` row. */
  const entries: { readonly node: PivotCubeNode; readonly subtotal: boolean }[] = [];
  /** Subtotal position of an expanded group (`start` = the group row carries the totals). */
  const placementOf = (n: PivotCubeNode): "start" | "end" | "none" => (isExpanded(n) ? (dims[n.depth]!.subtotal ?? "start") : "start");
  const collect = (n: PivotCubeNode) => {
    visible.push(n);
    entries.push({ node: n, subtotal: false });
    if (!isExpanded(n)) return;
    for (const c of n.children) collect(c);
    if (placementOf(n) === "end") entries.push({ node: n, subtotal: true });
  };
  for (const c of root.children) collect(c);

  // ---- Heat levels (domain over every eligible node, visible or not) ------------
  let heatInfo: PivotModel["heat"] = null;
  /** Visible node → (column index → level). */
  const heatLevels = new Map<PivotCubeNode, Map<number, number>>();
  if (spec.heat) {
    const measureId = spec.heat.measure ?? valueMeasures[0]!.id;
    const scope = spec.heat.scope ?? "all";
    const levelCount = spec.heat.levels ?? 9;
    const applyTo = spec.heat.applyTo ?? "leaf";
    heatInfo = { measureId, scope, levels: levelCount, applyTo };

    const eligible = (n: PivotCubeNode) => applyTo === "all" || (applyTo === "leaf") === isLeaf(n);
    // Leaf columns; group totals only with `column` scope (their own domain); never the grand total.
    const eligibleCols = columns.flatMap((c, i) =>
      c.measureId === measureId && !(levels > 0 && c.columnKey === null) && (scope === "column" || !c.subtotal) ? [i] : [],
    );
    const heatMeasure = measureOf(measureId);
    /** Row part of the scope key, computed once per node (not per cell). */
    const nodeScope = (n: PivotCubeNode): string =>
      scope === "row" ? pivotPathId(n.path) : scope === "group" ? pivotPathId(n.parent?.path ?? []) : "";
    const scopeKey = (rowKey: string, colIndex: number): string => (scope === "column" ? columns[colIndex]!.id : rowKey);

    const fixed: PivotHeatDomain | null = spec.heat.domain
      ? { min: spec.heat.domain[0], max: spec.heat.domain[1] }
      : null;
    const domains = new Map<string, { min: number; max: number }>();
    if (!fixed) {
      for (const n of cube.nodes) {
        if (!eligible(n)) continue;
        const rowKey = nodeScope(n);
        for (const i of eligibleCols) {
          const v = valueAt(n, heatMeasure, columnBuckets[i]!);
          if (v === null || !Number.isFinite(v)) continue;
          const k = scopeKey(rowKey, i);
          const d = domains.get(k);
          if (!d) domains.set(k, { min: v, max: v });
          else if (v < d.min) d.min = v;
          else if (v > d.max) d.max = v;
        }
      }
    }
    for (const n of visible) {
      if (!eligible(n)) continue;
      const rowKey = fixed ? "" : nodeScope(n);
      let byCol: Map<number, number> | undefined;
      for (const i of eligibleCols) {
        const domain = fixed ?? domains.get(scopeKey(rowKey, i)) ?? null;
        if (!domain) continue;
        const level = pivotHeatLevel(valueAt(n, heatMeasure, columnBuckets[i]!), domain.min, domain.max, levelCount);
        if (level === undefined) continue;
        if (!byCol) heatLevels.set(n, (byCol = new Map()));
        byCol.set(i, level);
      }
    }
  }

  // ---- Cells (visible rows + grand total only) ------------------------------------
  const showAsFor = (n: PivotCubeNode, m: PivotMeasure): PivotShowAs =>
    isLeaf(n) ? (m.showAs ?? "value") : (m.groupShowAs ?? m.showAs ?? "value");

  const cellsOf = (node: PivotCubeNode): PivotCell[] => {
    const heat = heatLevels.get(node);
    return columns.map((col, i) => {
      const m = columnMeasures[i]!;
      const bucket = columnBuckets[i]!;
      const raw = valueAt(node, m, bucket);
      const showAs = showAsFor(node, m);
      const level = heat?.get(i);
      if (showAs === "value") {
        const text = formatPivotNumber(raw, col.format);
        return level === undefined ? { value: raw, raw, text } : { value: raw, raw, text, heat: level };
      } else if (PIVOT_SHOW_AS_WITH_BASE.has(showAs)) {
        const value = alongValue(showAs, node, m, i, raw);
        const kind = pivotShowAsFormatKind(showAs);
        const text = formatPivotNumber(value, kind === "percent" ? col.percentFormat : kind === "rank" ? PIVOT_RANK_FORMAT : col.format);
        return level === undefined ? { value, raw, text, showAs } : { value, raw, text, showAs, heat: level };
      } else {
        const parent = node.parent ?? node;
        const denominator =
          showAs === "percentOfColumnTotal"
            ? valueAt(root, m, bucket)
            : showAs === "percentOfParentRow"
              ? valueAt(parent, m, bucket)
              : showAs === "percentOfParentColumn"
                ? valueAt(node, m, parentBuckets[i]!)
                : showAs === "percentOfRowTotal"
                  ? valueAt(node, m, totalBucket)
                  : valueAt(root, m, totalBucket);
        const value = divide(raw, denominator);
        const text = formatPivotNumber(value, col.percentFormat);
        return level === undefined ? { value, raw, text, showAs } : { value, raw, text, showAs, heat: level };
      }
    });
  };

  // ---- KPIs ----------------------------------------------------------------
  const kpiSpecs = spec.kpis ?? [];
  const kpiLevels = new Set(spec.kpiLevels ?? [0]);
  const kpisFor = (node: PivotCubeNode): PivotKpiValue[] =>
    kpiSpecs.map((k) => {
      const m = measureOf(k.measure);
      const value = valueAt(node, m, totalBucket);
      const kpi: PivotKpiValue = {
        id: k.id,
        label: k.label ?? measureLabel(m),
        value,
        text: formatPivotNumber(value, k.format ?? m.format ?? {}),
      };
      if (!k.compareTo) return kpi;
      const compare = measureOf(k.compareTo);
      const delta = divide(value, valueAt(node, compare, totalBucket));
      const d = delta === null ? null : delta - 1;
      return {
        ...kpi,
        delta: d,
        deltaText: formatPivotNumber(d, k.deltaFormat ?? DEFAULT_PIVOT_DELTA_FORMAT),
        compareLabel: measureLabel(compare),
      };
    });

  // ---- Rows ----------------------------------------------------------------
  const toRow = (n: PivotCubeNode): PivotBodyRow => {
    const leaf = isLeaf(n);
    const placement = leaf ? "start" : placementOf(n);
    const dim = dims[n.depth]!;
    let attributes: Record<string, unknown> | undefined;
    if (dim.attributes?.length) {
      attributes = {};
      dim.attributes.forEach((field, j) => {
        const v = n.attributes?.[j];
        attributes![field] = v === undefined ? null : v;
      });
    }
    return {
      id: pivotPathId(n.path),
      kind: leaf ? "leaf" : "group",
      depth: n.depth,
      path: n.path,
      label: nodeLabel(n),
      expandable: !leaf,
      expanded: isExpanded(n),
      childCount: n.children.length,
      sourceRowCount: n.rowCount,
      cells: placement === "start" ? cellsOf(n) : columns.map(() => BLANK_CELL),
      ...(attributes ? { attributes } : {}),
      ...(!leaf && kpiSpecs.length && kpiLevels.has(n.depth) ? { kpis: kpisFor(n) } : {}),
      ...(n.otherCount !== undefined ? { otherCount: n.otherCount } : {}),
      ...(placement !== "start" ? { subtotal: placement } : {}),
    };
  };
  const toSubtotalRow = (n: PivotCubeNode): PivotBodyRow => ({
    id: pivotSubtotalRowId(n.path),
    kind: "subtotal",
    depth: n.depth,
    path: n.path,
    label: subtotalText(subtotalTemplate, nodeLabel(n)),
    expandable: false,
    expanded: false,
    childCount: n.children.length,
    sourceRowCount: n.rowCount,
    cells: cellsOf(n),
    ...(n.otherCount !== undefined ? { otherCount: n.otherCount } : {}),
  });

  const grandTotal: PivotBodyRow = {
    id: PIVOT_GRAND_TOTAL_ROW_ID,
    kind: "grandTotal",
    depth: -1,
    path: [],
    label: grandLabel,
    expandable: false,
    expanded: true,
    childCount: root.children.length,
    sourceRowCount: root.rowCount,
    cells: cellsOf(root),
    ...(kpiSpecs.length ? { kpis: kpisFor(root) } : {}),
  };

  const body = entries.map((e) => (e.subtotal ? toSubtotalRow(e.node) : toRow(e.node)));
  const showGrand = totals.grandTotal ?? true;
  const rows = !showGrand ? body : totals.grandTotalPosition === "top" ? [grandTotal, ...body] : [...body, grandTotal];

  // ---- Header series -------------------------------------------------------
  let headerSeries: PivotHeaderSeries | null = null;
  if (spec.headerCharts && levels > 0) {
    const m = measureOf(spec.headerCharts.measure ?? valueMeasures[0]!.id);
    const point = (columnId: string, columnKey: string, label: string, bucket: number): PivotHeaderSeriesPoint => ({
      columnId,
      columnKey,
      label,
      value: valueAt(root, m, bucket),
      ...(spec.headerCharts?.breakdown
        ? { breakdown: root.children.map((c) => ({ key: c.key, label: nodeLabel(c), value: valueAt(c, m, bucket) })) }
        : {}),
    });
    const max = (ps: readonly PivotHeaderSeriesPoint[]) => {
      const finite = ps.map((p) => p.value).filter((v): v is number => v !== null);
      return finite.length ? finite.reduce((a, b) => (b > a ? b : a)) : null;
    };
    const bucketOfKey = new Map(colRoot.children.map((c) => [c.key, c.bucket] as const));
    const points =
      levels === 1
        ? columnKeys.map((ck) => point(pivotColumnId(ck.key, m.id), ck.key, ck.label, bucketOfKey.get(ck.key) ?? -1))
        : slots.map((s) =>
            point(s.kind === "leaf" ? pivotColumnId(s.columnKey, m.id) : `s:${encodeURIComponent(s.columnKey!)}:${m.id}`, s.columnKey!, s.label, s.column!.bucket),
          );
    const groups = levels > 1 ? colRoot.children.map((c) => point(`s:${encodeURIComponent(c.columnKey)}:${m.id}`, c.columnKey, colLabel(c), c.bucket)) : null;
    headerSeries = {
      measureId: m.id,
      type: spec.headerCharts.type ?? "bar",
      points,
      max: max(points),
      ...(groups ? { groups, groupMax: max(groups) } : {}),
    };
  }

  // ---- Filters / facets ------------------------------------------------------
  const activeFilters = describePivotFilters(spec);
  const filteredFields = new Set((spec.filters ?? []).filter(isPivotFilterActive).map((f) => f.field));
  const rowDimensions: PivotModelDimension[] = dims.map((d, i) => ({
    field: d.field,
    label: dimensionLabel(spec, d, rowDates[i]!),
    ...(d.sort === "asc" || d.sort === "desc" ? { sort: d.sort } : {}),
    ...(d.sortBy ? { sortBy: d.sortBy } : {}),
    ...(d.topN ? { topN: d.topN } : {}),
    ...(filteredFields.has(d.field) ? { filtered: true as const } : {}),
  }));
  const columnDimensions = colDims.map((d, i) => ({ field: d.field, label: dimensionLabel(spec, d, colDates[i]!) }));
  const facets: PivotFacet[] | null = spec.facets?.length ? cube.facets.map((f, i) => toPivotFacet(spec, f, spec.facets![i]!)) : null;
  const anyFilter = filteredFields.size > 0 || dims.some((d) => d.topN);

  return {
    version: PIVOT_SPEC_VERSION,
    ...(spec.id !== undefined ? { id: spec.id } : {}),
    ...(spec.title !== undefined ? { title: spec.title } : {}),
    ...(spec.subtitle !== undefined ? { subtitle: spec.subtitle } : {}),
    layout: spec.layout ?? "tabular",
    rowDimensions,
    columnDimension: columnDimensions[0] ?? null,
    ...(nested ? { columnDimensions } : {}),
    columnKeys,
    columns,
    headerRows,
    rows,
    grandTotal,
    spans: dims.map((_, level) => computePivotRowSpans(rows, level)),
    heat: heatInfo,
    headerSeries,
    kpis: grandTotal.kpis ?? [],
    ...(activeFilters.length ? { filters: activeFilters } : {}),
    ...(anyFilter ? { recordCount: cube.recordCount } : {}),
    ...(facets ? { facets } : {}),
  };
}

function toPivotFacet(spec: PivotSpec, f: PivotCubeFacet, facetSpec: PivotFacetSpec): PivotFacet {
  const label = typeof facetSpec !== "string" && facetSpec.label ? facetSpec.label : pivotFieldLabel(spec, pivotFacetField(facetSpec));
  const keyLabel = keyLabeler(spec, f.field);
  return {
    field: f.field,
    label,
    filtered: f.selected !== null,
    values: f.keys.map((key, j) => ({
      key,
      label: keyLabel(key),
      count: f.counts[j]!,
      total: f.totals[j]!,
      hasData: f.counts[j]! > 0,
      selected: f.selected ? f.selected[j]! : true,
    })),
  };
}

/**
 * The `PivotFacet` of any field (as if it were listed in `spec.facets`), computed on demand with
 * one filter pass and no aggregation. Used by filter menus for fields that are not facets.
 */
export function buildPivotFacet(
  spec: PivotSpec,
  rows: readonly PivotDataRow[],
  field: string,
  options: { readonly encoding?: PivotRowEncoding; readonly label?: string } = {},
): PivotFacet {
  return toPivotFacet(spec, computePivotFacet(spec, rows, field, options), options.label ? { field, label: options.label } : field);
}

/**
 * Drill-through target of a model cell: the row's key path and column `columnIndex`'s column key
 * path (`[]` for row-total columns) and measure. Pass it to `pivotDrillThrough`.
 */
export function pivotCellDrillTarget(model: PivotModel, row: Pick<PivotBodyRow, "path">, columnIndex: number): PivotDrillThroughTarget {
  const col = model.columns[columnIndex];
  if (!col) return { path: row.path, columnPath: [] };
  const columnPath = col.columnPath ?? (col.columnKey !== null ? [col.columnKey] : []);
  return { path: row.path, columnPath, measureId: col.measureId };
}

/** Memoizing `buildPivotModel` (see `createPivotModelBuilder`). */
export interface PivotModelBuilder {
  /** Same result as `buildPivotModel(spec, rows, options)`. */
  build(spec: PivotSpec, rows: readonly PivotDataRow[], options?: BuildPivotModelOptions): PivotModel;
  /**
   * `model.facets` entry for `field` when `spec` lists it, else `buildPivotFacet` on the cached
   * encoding (memoized per spec object and field).
   */
  facet(spec: PivotSpec, rows: readonly PivotDataRow[], field: string): PivotFacet;
  /** `pivotDrillThrough` on the cached encoding (no re-encoding of `rows`). */
  drillThrough(spec: PivotSpec, rows: readonly PivotDataRow[], target: PivotDrillThroughTarget, options?: PivotDrillThroughOptions): PivotDrillThroughResult;
  /** Drop every cached encoding, cube and model. */
  clear(): void;
}

export interface PivotModelBuilderOptions {
  /** Most cubes kept for reuse (default 4; the current one always stays). */
  readonly maxCubes?: number;
  /**
   * Budget for the cached cubes in bytes (`PivotCube.byteSize`, default 256 MiB): older cubes are
   * dropped while the cache is over it, so layouts with very many row nodes keep one or two cubes
   * instead of four. The current cube always stays.
   */
  readonly maxCubeBytes?: number;
}

/** Default `maxCubeBytes` of `createPivotModelBuilder`. */
export const PIVOT_DEFAULT_MAX_CUBE_BYTES = 256 * 1024 * 1024;

/**
 * `buildPivotModel` with caches for interactive use (what `usePivotGrid` uses):
 *
 * - the column encoding of `rows` is kept while `rows` keeps its identity, so filter / sort
 *   changes skip re-reading records;
 * - the aggregated cube is reused while `pivotSpecDataKey(spec)` (and `rows`, `aggregators`)
 *   stay the same, so expanding a group or changing heat scope only re-runs the cheap view stage;
 * - the last few cubes are kept (within `maxCubes` and `maxCubeBytes`), so toggling a filter back
 *   is instant.
 *
 * Treat `rows` as immutable: mutate → pass a new array.
 */
export function createPivotModelBuilder(options: PivotModelBuilderOptions = {}): PivotModelBuilder {
  const maxCubes = Math.max(1, options.maxCubes ?? 4);
  const maxCubeBytes = options.maxCubeBytes ?? PIVOT_DEFAULT_MAX_CUBE_BYTES;
  let encoding: PivotRowEncoding | null = null;
  let cubeAggregators: PivotAggregatorRegistry | undefined;
  const cubes = new Map<string, PivotCube>();
  let last: { spec: PivotSpec; cube: PivotCube; model: PivotModel } | null = null;
  let facetCache: { spec: PivotSpec; byField: Map<string, PivotFacet> } | null = null;
  const encode = (rows: readonly PivotDataRow[]): PivotRowEncoding => {
    if (!encoding || encoding.rows !== rows) {
      encoding = createPivotRowEncoding(rows);
      cubes.clear();
      last = null;
      facetCache = null;
    }
    return encoding;
  };

  return {
    build(specInput, rows, buildOptions = {}) {
      const spec = buildOptions.validate === false ? specInput : assertPivotSpec(specInput);
      const enc = encode(rows);
      if (cubeAggregators !== buildOptions.aggregators) {
        cubeAggregators = buildOptions.aggregators;
        cubes.clear();
        last = null;
      }
      const key = pivotSpecDataKey(spec);
      let cube = cubes.get(key);
      if (cube) {
        cubes.delete(key);
      } else {
        cube = buildPivotCube(spec, rows, { aggregators: buildOptions.aggregators, encoding: enc });
        if (cubes.size >= maxCubes) cubes.delete(cubes.keys().next().value!);
      }
      cubes.set(key, cube);
      let bytes = 0;
      for (const c of cubes.values()) bytes += c.byteSize;
      while (cubes.size > 1 && bytes > maxCubeBytes) {
        const oldest = cubes.keys().next().value!;
        bytes -= cubes.get(oldest)!.byteSize;
        cubes.delete(oldest);
      }
      if (last && last.spec === spec && last.cube === cube) return last.model;
      const model = pivotModelFromCube(cube, spec);
      last = { spec, cube, model };
      return model;
    },
    facet(spec, rows, field) {
      const enc = encode(rows);
      if (last && last.spec === spec) {
        const hit = last.model.facets?.find((f) => f.field === field);
        if (hit) return hit;
      }
      if (!facetCache || facetCache.spec !== spec) facetCache = { spec, byField: new Map() };
      let facet = facetCache.byField.get(field);
      if (!facet) facetCache.byField.set(field, (facet = buildPivotFacet(spec, rows, field, { encoding: enc })));
      return facet;
    },
    drillThrough(spec, rows, target, drillOptions = {}) {
      return pivotDrillThrough(spec, rows, target, { aggregators: cubeAggregators, ...drillOptions, encoding: encode(rows) });
    },
    clear() {
      encoding = null;
      cubes.clear();
      last = null;
      facetCache = null;
    },
  };
}
