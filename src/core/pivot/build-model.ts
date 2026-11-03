import type { PivotAggregatorRegistry } from "./aggregate";
import { buildPivotCube, PIVOT_OTHER_KEY, pivotFacetField, pivotSpecDataKey, type PivotCube, type PivotCubeNode } from "./cube";
import { createPivotRowEncoding, type PivotRowEncoding } from "./encode";
import { describePivotFilter, isPivotFilterActive } from "./filter";
import {
  DEFAULT_PIVOT_DELTA_FORMAT,
  DEFAULT_PIVOT_PERCENT_FORMAT,
  formatPivotNumber,
  toExcelNumFmt,
} from "./format";
import { pivotHeatLevel, type PivotHeatDomain } from "./heat";
import { computePivotRowSpans } from "./row-spans";
import {
  PIVOT_SPEC_VERSION,
  type PivotActiveFilter,
  type PivotBodyRow,
  type PivotCell,
  type PivotDataRow,
  type PivotDimension,
  type PivotFacet,
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
import { assertPivotSpec } from "./validate";

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

/** Stable value-column id. `columnKey === null` → row-total (or measure-only) column. */
export function pivotColumnId(columnKey: string | null, measureId: string, isRowTotal = false): string {
  if (isRowTotal) return `t:${measureId}`;
  return columnKey === null ? `m:${measureId}` : `c:${encodeURIComponent(columnKey)}:${measureId}`;
}

const labelOf = (key: string, dim: PivotDimension): string =>
  key === PIVOT_OTHER_KEY ? (dim.topN?.otherLabel ?? "Other") : key === "" ? (dim.blankLabel ?? "(blank)") : key;

function divide(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return a / b;
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

/** Label of a field for summaries / slicers: dimension label, facet label, filter label, else the field. */
export function pivotFieldLabel(spec: PivotSpec, field: string): string {
  const dim = spec.rows.find((d) => d.field === field) ?? (spec.columns?.field === field ? spec.columns : undefined);
  if (dim?.label) return dim.label;
  for (const f of spec.facets ?? []) if (typeof f !== "string" && f.field === field && f.label) return f.label;
  for (const f of spec.filters ?? []) if (f.field === field && f.label) return f.label;
  return field;
}

/** Display label of a key of `field` (`""` → the dimension's `blankLabel`, default `(blank)`). */
function keyLabeler(spec: PivotSpec, field: string): (key: string) => string {
  const dim = spec.rows.find((d) => d.field === field) ?? (spec.columns?.field === field ? spec.columns : undefined);
  const blank = dim?.blankLabel ?? "(blank)";
  return (key) => (key === "" ? blank : key);
}

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

/**
 * The view half of `buildPivotModel`: columns, cells (visible rows only), heat, KPIs, header
 * series, spans and facets from an aggregated `cube`. `spec` must be the (validated) spec the cube
 * was built from, apart from view-only fields (see `pivotSpecDataKey`).
 */
export function pivotModelFromCube(cube: PivotCube, spec: PivotSpec): PivotModel {
  const dims = spec.rows;
  const colDim = spec.columns ?? null;
  const leafDepth = dims.length - 1;
  const totals = spec.totals ?? {};
  const grandLabel = totals.grandTotalLabel ?? "Grand Total";
  const rowTotalLabel = totals.rowTotalLabel ?? "Total";
  const root = cube.root;

  const measureById = new Map(spec.measures.map((m) => [m.id, m] as const));
  const measureOf = (id: string): PivotMeasure => measureById.get(id)!;
  const measureLabel = (m: PivotMeasure) => m.label ?? m.id;
  const valueMeasures = (spec.values ?? spec.measures.map((m) => m.id)).map(measureOf);
  const valueOf = (node: PivotCubeNode, m: PivotMeasure, colKey: string | null) => cube.valueOf(node, m.id, colKey);
  const nodeLabel = (n: PivotCubeNode) => (n.depth < 0 ? grandLabel : labelOf(n.key, dims[n.depth]!));

  const columnKeys: PivotKey[] = colDim ? cube.columnKeys.map((key) => ({ key, label: labelOf(key, colDim) })) : [];

  // ---- Columns + header rows ----------------------------------------------
  const multi = valueMeasures.length > 1;
  /** With a column dimension, `columnKey === null` marks a row-total column. */
  const isRowTotalColumn = (c: PivotValueColumn) => colDim !== null && c.columnKey === null;
  const makeColumn = (columnKey: string | null, columnLabel: string | null, m: PivotMeasure, isRowTotal: boolean) => {
    const format = m.format ?? {};
    const percentFormat = m.percentFormat ?? DEFAULT_PIVOT_PERCENT_FORMAT;
    const top = isRowTotal ? rowTotalLabel : columnLabel;
    const col: PivotValueColumn = {
      id: pivotColumnId(columnKey, m.id, isRowTotal),
      columnKey,
      columnLabel: isRowTotal ? rowTotalLabel : columnLabel,
      measureId: m.id,
      measureLabel: measureLabel(m),
      headerPath: top === null ? [measureLabel(m)] : multi ? [top, measureLabel(m)] : [top],
      format,
      percentFormat,
      excelNumFmt: toExcelNumFmt(format),
      excelPercentNumFmt: toExcelNumFmt(percentFormat),
    };
    return col;
  };

  const columns: PivotValueColumn[] = [];
  if (colDim) {
    for (const ck of columnKeys) for (const m of valueMeasures) columns.push(makeColumn(ck.key, ck.label, m, false));
    if (totals.rowTotal) for (const m of valueMeasures) columns.push(makeColumn(null, null, m, true));
  } else {
    for (const m of valueMeasures) columns.push(makeColumn(null, null, m, false));
  }
  const columnMeasures = columns.map((c) => measureOf(c.measureId));

  const headerRows: PivotHeaderCell[][] = [];
  if (colDim && multi) {
    const top: PivotHeaderCell[] = columnKeys.map((ck) => ({ label: ck.label, colSpan: valueMeasures.length, columnKey: ck.key }));
    if (totals.rowTotal) top.push({ label: rowTotalLabel, colSpan: valueMeasures.length, columnKey: null });
    headerRows.push(top);
    headerRows.push(columns.map((c) => ({ label: c.measureLabel, colSpan: 1, columnKey: c.columnKey, measureId: c.measureId })));
  } else {
    headerRows.push(columns.map((c) => ({ label: c.headerPath[0]!, colSpan: 1, columnKey: c.columnKey, measureId: c.measureId })));
  }

  // ---- Visibility --------------------------------------------------------------
  const isLeaf = (n: PivotCubeNode) => n.depth === leafDepth;
  const expandedSpec = spec.expanded ?? "all";
  const expandedIds =
    expandedSpec === "all" || expandedSpec === "none" ? null : new Set(expandedSpec.map((p) => pivotPathId(p)));
  const isExpanded = (n: PivotCubeNode) =>
    !isLeaf(n) && (expandedSpec === "all" || (expandedIds !== null && expandedIds.has(pivotPathId(n.path))));
  const visible: PivotCubeNode[] = [];
  const collect = (n: PivotCubeNode) => {
    visible.push(n);
    if (isExpanded(n)) for (const c of n.children) collect(c);
  };
  for (const c of root.children) collect(c);

  // ---- Heat levels (domain over every eligible node, visible or not) ------------
  let heatInfo: PivotModel["heat"] = null;
  /** Visible node → (column index → level). */
  const heatLevels = new Map<PivotCubeNode, Map<number, number>>();
  if (spec.heat) {
    const measureId = spec.heat.measure ?? valueMeasures[0]!.id;
    const scope = spec.heat.scope ?? "all";
    const levels = spec.heat.levels ?? 9;
    const applyTo = spec.heat.applyTo ?? "leaf";
    heatInfo = { measureId, scope, levels, applyTo };

    const eligible = (n: PivotCubeNode) => applyTo === "all" || (applyTo === "leaf") === isLeaf(n);
    const eligibleCols = columns.flatMap((c, i) => (c.measureId === measureId && !isRowTotalColumn(c) ? [i] : []));
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
          const v = valueOf(n, heatMeasure, columns[i]!.columnKey);
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
        const level = pivotHeatLevel(valueOf(n, heatMeasure, columns[i]!.columnKey), domain.min, domain.max, levels);
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
      const raw = valueOf(node, m, col.columnKey);
      const showAs = showAsFor(node, m);
      const level = heat?.get(i);
      if (showAs === "value") {
        const text = formatPivotNumber(raw, col.format);
        return level === undefined ? { value: raw, raw, text } : { value: raw, raw, text, heat: level };
      } else {
        const parent = node.parent ?? node;
        const denominator =
          showAs === "percentOfColumnTotal"
            ? valueOf(root, m, col.columnKey)
            : showAs === "percentOfParentRow"
              ? valueOf(parent, m, col.columnKey)
              : showAs === "percentOfRowTotal"
                ? valueOf(node, m, null)
                : valueOf(root, m, null);
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
      const value = valueOf(node, m, null);
      const kpi: PivotKpiValue = {
        id: k.id,
        label: k.label ?? measureLabel(m),
        value,
        text: formatPivotNumber(value, k.format ?? m.format ?? {}),
      };
      if (!k.compareTo) return kpi;
      const compare = measureOf(k.compareTo);
      const delta = divide(value, valueOf(node, compare, null));
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
      cells: cellsOf(n),
      ...(attributes ? { attributes } : {}),
      ...(!leaf && kpiSpecs.length && kpiLevels.has(n.depth) ? { kpis: kpisFor(n) } : {}),
      ...(n.otherCount !== undefined ? { otherCount: n.otherCount } : {}),
    };
  };

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

  const body = visible.map(toRow);
  const showGrand = totals.grandTotal ?? true;
  const rows = !showGrand ? body : totals.grandTotalPosition === "top" ? [grandTotal, ...body] : [...body, grandTotal];

  // ---- Header series -------------------------------------------------------
  let headerSeries: PivotHeaderSeries | null = null;
  if (spec.headerCharts && colDim) {
    const m = measureOf(spec.headerCharts.measure ?? valueMeasures[0]!.id);
    const points = columnKeys.map((ck) => ({
      columnId: pivotColumnId(ck.key, m.id),
      columnKey: ck.key,
      label: ck.label,
      value: valueOf(root, m, ck.key),
      ...(spec.headerCharts?.breakdown
        ? {
            breakdown: root.children.map((c) => ({
              key: c.key,
              label: nodeLabel(c),
              value: valueOf(c, m, ck.key),
            })),
          }
        : {}),
    }));
    const finite = points.map((p) => p.value).filter((v): v is number => v !== null);
    headerSeries = {
      measureId: m.id,
      type: spec.headerCharts.type ?? "bar",
      points,
      max: finite.length ? finite.reduce((a, b) => (b > a ? b : a)) : null,
    };
  }

  // ---- Filters / facets ------------------------------------------------------
  const activeFilters = describePivotFilters(spec);
  const filteredFields = new Set((spec.filters ?? []).filter(isPivotFilterActive).map((f) => f.field));
  const rowDimensions: PivotModelDimension[] = dims.map((d) => ({
    field: d.field,
    label: d.label ?? d.field,
    ...(d.sort === "asc" || d.sort === "desc" ? { sort: d.sort } : {}),
    ...(d.sortBy ? { sortBy: d.sortBy } : {}),
    ...(d.topN ? { topN: d.topN } : {}),
    ...(filteredFields.has(d.field) ? { filtered: true as const } : {}),
  }));
  const facets: PivotFacet[] | null = spec.facets?.length
    ? cube.facets.map((f, i) => {
        const facetSpec = spec.facets![i]!;
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
      })
    : null;
  const anyFilter = filteredFields.size > 0 || dims.some((d) => d.topN);

  return {
    version: PIVOT_SPEC_VERSION,
    ...(spec.id !== undefined ? { id: spec.id } : {}),
    ...(spec.title !== undefined ? { title: spec.title } : {}),
    ...(spec.subtitle !== undefined ? { subtitle: spec.subtitle } : {}),
    layout: spec.layout ?? "tabular",
    rowDimensions,
    columnDimension: colDim ? { field: colDim.field, label: colDim.label ?? colDim.field } : null,
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

/** Memoizing `buildPivotModel` (see `createPivotModelBuilder`). */
export interface PivotModelBuilder {
  /** Same result as `buildPivotModel(spec, rows, options)`. */
  build(spec: PivotSpec, rows: readonly PivotDataRow[], options?: BuildPivotModelOptions): PivotModel;
  /** Drop every cached encoding, cube and model. */
  clear(): void;
}

/**
 * `buildPivotModel` with caches for interactive use (what `usePivotGrid` uses):
 *
 * - the column encoding of `rows` is kept while `rows` keeps its identity, so filter / sort
 *   changes skip re-reading records;
 * - the aggregated cube is reused while `pivotSpecDataKey(spec)` (and `rows`, `aggregators`)
 *   stay the same, so expanding a group or changing heat scope only re-runs the cheap view stage;
 * - the last few cubes are kept, so toggling a filter back is instant.
 *
 * Treat `rows` as immutable: mutate → pass a new array.
 */
export function createPivotModelBuilder(options: { readonly maxCubes?: number } = {}): PivotModelBuilder {
  const maxCubes = Math.max(1, options.maxCubes ?? 4);
  let encoding: PivotRowEncoding | null = null;
  let cubeAggregators: PivotAggregatorRegistry | undefined;
  const cubes = new Map<string, PivotCube>();
  let last: { spec: PivotSpec; cube: PivotCube; model: PivotModel } | null = null;

  return {
    build(specInput, rows, buildOptions = {}) {
      const spec = buildOptions.validate === false ? specInput : assertPivotSpec(specInput);
      if (!encoding || encoding.rows !== rows || cubeAggregators !== buildOptions.aggregators) {
        if (!encoding || encoding.rows !== rows) encoding = createPivotRowEncoding(rows);
        cubeAggregators = buildOptions.aggregators;
        cubes.clear();
        last = null;
      }
      const key = pivotSpecDataKey(spec);
      let cube = cubes.get(key);
      if (cube) {
        cubes.delete(key);
      } else {
        cube = buildPivotCube(spec, rows, { aggregators: buildOptions.aggregators, encoding });
        if (cubes.size >= maxCubes) cubes.delete(cubes.keys().next().value!);
      }
      cubes.set(key, cube);
      if (last && last.spec === spec && last.cube === cube) return last.model;
      const model = pivotModelFromCube(cube, spec);
      last = { spec, cube, model };
      return model;
    },
    clear() {
      encoding = null;
      cubes.clear();
      last = null;
    },
  };
}
