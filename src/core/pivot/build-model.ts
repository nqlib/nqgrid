import { aggregatePivotRows, type PivotAggregatorRegistry } from "./aggregate";
import {
  DEFAULT_PIVOT_DELTA_FORMAT,
  DEFAULT_PIVOT_PERCENT_FORMAT,
  formatPivotNumber,
  toExcelNumFmt,
  toPivotNumber,
} from "./format";
import { pivotHeatDomain, pivotHeatLevel, type PivotHeatDomain } from "./heat";
import { computePivotRowSpans } from "./row-spans";
import {
  PIVOT_SPEC_VERSION,
  type PivotBodyRow,
  type PivotCell,
  type PivotDataRow,
  type PivotDimension,
  type PivotHeaderCell,
  type PivotHeaderSeries,
  type PivotKey,
  type PivotKpiValue,
  type PivotMeasure,
  type PivotModel,
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

interface PivotNode {
  readonly path: string[];
  readonly label: string;
  /** Row-dimension level; `-1` for the root (grand total). */
  readonly depth: number;
  readonly parent: PivotNode | null;
  readonly rows: PivotDataRow[];
  readonly buckets: Map<string, PivotDataRow[]>;
  readonly childByKey: Map<string, PivotNode>;
  children: PivotNode[];
  cells: (PivotCell & { heat?: number })[];
}

const keyOf = (row: PivotDataRow, field: string): string => {
  const v = row[field];
  return v === null || v === undefined ? "" : String(v);
};

const labelOf = (key: string, dim: PivotDimension): string => (key === "" ? (dim.blankLabel ?? "(blank)") : key);

function compareKeys(a: string, b: string): number {
  const na = toPivotNumber(a);
  const nb = toPivotNumber(b);
  if (na !== null && nb !== null) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}

function orderKeys(seen: readonly string[], dim: PivotDimension, keepEmpty: boolean): string[] {
  const seenSet = new Set(seen);
  const order = [...new Set(dim.order ?? [])];
  const orderSet = new Set(order);
  const head = order.filter((k) => keepEmpty || seenSet.has(k));
  let rest = seen.filter((k) => !orderSet.has(k));
  if (dim.sort === "asc") rest = [...rest].sort(compareKeys);
  else if (dim.sort === "desc") rest = [...rest].sort((a, b) => compareKeys(b, a));
  return [...head, ...rest];
}

function newNode(path: string[], label: string, depth: number, parent: PivotNode | null): PivotNode {
  return { path, label, depth, parent, rows: [], buckets: new Map(), childByKey: new Map(), children: [], cells: [] };
}

function divide(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return a / b;
}

/**
 * Compute the full pivot — groups, subtotals, "show values as", heat levels, header series,
 * KPIs, row spans and formatted text — as plain JSON. Pure and deterministic: the same
 * `(spec, rows)` gives the same model in a browser, Tauri webview or Node export process.
 */
export function buildPivotModel(
  specInput: PivotSpec,
  data: readonly PivotDataRow[],
  options: BuildPivotModelOptions = {},
): PivotModel {
  const spec = options.validate === false ? specInput : assertPivotSpec(specInput);
  const registry = options.aggregators ?? {};
  const dims = spec.rows;
  const colDim = spec.columns ?? null;
  const leafDepth = dims.length - 1;
  const totals = spec.totals ?? {};
  const grandLabel = totals.grandTotalLabel ?? "Grand Total";
  const rowTotalLabel = totals.rowTotalLabel ?? "Total";

  const measureById = new Map(spec.measures.map((m) => [m.id, m] as const));
  const measureOf = (id: string): PivotMeasure => measureById.get(id)!;
  const measureLabel = (m: PivotMeasure) => m.label ?? m.id;
  const valueMeasures = (spec.values ?? spec.measures.map((m) => m.id)).map(measureOf);

  // ---- Tree -------------------------------------------------------------
  const root = newNode([], grandLabel, -1, null);
  const seenChildKeys = new Map<PivotNode, string[]>();
  const seenColumnKeys: string[] = [];
  const seenColumnSet = new Set<string>();

  const addToNode = (node: PivotNode, row: PivotDataRow, colKey: string) => {
    node.rows.push(row);
    let bucket = node.buckets.get(colKey);
    if (!bucket) node.buckets.set(colKey, (bucket = []));
    bucket.push(row);
  };

  for (const row of data) {
    const colKey = colDim ? keyOf(row, colDim.field) : "";
    if (colDim && !seenColumnSet.has(colKey)) {
      seenColumnSet.add(colKey);
      seenColumnKeys.push(colKey);
    }
    addToNode(root, row, colKey);
    let node = root;
    for (let d = 0; d < dims.length; d++) {
      const dim = dims[d]!;
      const key = keyOf(row, dim.field);
      let child = node.childByKey.get(key);
      if (!child) {
        child = newNode([...node.path, key], labelOf(key, dim), d, node);
        node.childByKey.set(key, child);
        let seen = seenChildKeys.get(node);
        if (!seen) seenChildKeys.set(node, (seen = []));
        seen.push(key);
      }
      addToNode(child, row, colKey);
      node = child;
    }
  }

  const allNodes: PivotNode[] = [];
  const orderChildren = (node: PivotNode) => {
    if (node.depth < leafDepth) {
      const dim = dims[node.depth + 1]!;
      node.children = orderKeys(seenChildKeys.get(node) ?? [], dim, false).map((k) => node.childByKey.get(k)!);
    }
    for (const c of node.children) {
      allNodes.push(c);
      orderChildren(c);
    }
  };
  orderChildren(root);

  const columnKeys: PivotKey[] = colDim
    ? orderKeys(seenColumnKeys, colDim, colDim.keepEmpty === true).map((key) => ({ key, label: labelOf(key, colDim) }))
    : [];

  // ---- Aggregation (memoized per node × measure × column key) -------------
  const TOTAL = "\u0000total";
  const cache = new Map<PivotNode, Map<string, number | null>>();
  const valueOf = (node: PivotNode, m: PivotMeasure, colKey: string | null): number | null => {
    let byKey = cache.get(node);
    if (!byKey) cache.set(node, (byKey = new Map()));
    const k = `${m.id}\u0000${colKey ?? TOTAL}`;
    if (byKey.has(k)) return byKey.get(k)!;
    const rows = colKey === null || !colDim ? node.rows : (node.buckets.get(colKey) ?? []);
    const v = rows.length === 0 ? null : aggregatePivotRows(rows, m.aggregate, m.field, registry);
    byKey.set(k, v);
    return v;
  };

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

  const headerRows: PivotHeaderCell[][] = [];
  if (colDim && multi) {
    const top: PivotHeaderCell[] = columnKeys.map((ck) => ({ label: ck.label, colSpan: valueMeasures.length, columnKey: ck.key }));
    if (totals.rowTotal) top.push({ label: rowTotalLabel, colSpan: valueMeasures.length, columnKey: null });
    headerRows.push(top);
    headerRows.push(columns.map((c) => ({ label: c.measureLabel, colSpan: 1, columnKey: c.columnKey, measureId: c.measureId })));
  } else {
    headerRows.push(columns.map((c) => ({ label: c.headerPath[0]!, colSpan: 1, columnKey: c.columnKey, measureId: c.measureId })));
  }

  // ---- Cells ---------------------------------------------------------------
  const isLeaf = (n: PivotNode) => n.depth === leafDepth;
  const showAsFor = (n: PivotNode, m: PivotMeasure): PivotShowAs =>
    isLeaf(n) ? (m.showAs ?? "value") : (m.groupShowAs ?? m.showAs ?? "value");

  const computeCells = (node: PivotNode) => {
    node.cells = columns.map((col) => {
      const m = measureOf(col.measureId);
      const raw = valueOf(node, m, col.columnKey);
      const showAs = showAsFor(node, m);
      if (showAs === "value") return { value: raw, raw, text: formatPivotNumber(raw, col.format) };
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
      return { value, raw, text: formatPivotNumber(value, col.percentFormat), showAs };
    });
  };
  computeCells(root);
  for (const n of allNodes) computeCells(n);

  // ---- Heat ----------------------------------------------------------------
  let heatInfo: PivotModel["heat"] = null;
  if (spec.heat) {
    const measureId = spec.heat.measure ?? valueMeasures[0]!.id;
    const scope = spec.heat.scope ?? "all";
    const levels = spec.heat.levels ?? 9;
    const applyTo = spec.heat.applyTo ?? "leaf";
    heatInfo = { measureId, scope, levels, applyTo };

    const eligibleNodes = allNodes.filter((n) => applyTo === "all" || (applyTo === "leaf") === isLeaf(n));
    const eligibleCols = columns.flatMap((c, i) => (c.measureId === measureId && !isRowTotalColumn(c) ? [i] : []));
    const scopeKey = (n: PivotNode, colIndex: number): string =>
      scope === "column"
        ? columns[colIndex]!.id
        : scope === "row"
          ? pivotPathId(n.path)
          : scope === "group"
            ? pivotPathId(n.parent?.path ?? [])
            : "";

    const fixed: PivotHeatDomain | null = spec.heat.domain
      ? { min: spec.heat.domain[0], max: spec.heat.domain[1] }
      : null;
    const valuesByScope = new Map<string, (number | null)[]>();
    if (!fixed) {
      for (const n of eligibleNodes) {
        for (const i of eligibleCols) {
          const k = scopeKey(n, i);
          let arr = valuesByScope.get(k);
          if (!arr) valuesByScope.set(k, (arr = []));
          arr.push(n.cells[i]!.raw);
        }
      }
    }
    const domains = new Map<string, PivotHeatDomain | null>();
    for (const [k, vals] of valuesByScope) domains.set(k, pivotHeatDomain(vals));

    for (const n of eligibleNodes) {
      for (const i of eligibleCols) {
        const domain = fixed ?? domains.get(scopeKey(n, i)) ?? null;
        if (!domain) continue;
        const level = pivotHeatLevel(n.cells[i]!.raw, domain.min, domain.max, levels);
        if (level !== undefined) n.cells[i] = { ...n.cells[i]!, heat: level };
      }
    }
  }

  // ---- KPIs ----------------------------------------------------------------
  const kpiSpecs = spec.kpis ?? [];
  const kpiLevels = new Set(spec.kpiLevels ?? [0]);
  const kpisFor = (node: PivotNode): PivotKpiValue[] =>
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
      const delta = divide(value, valueOf(node, measureOf(k.compareTo), null));
      const d = delta === null ? null : delta - 1;
      return { ...kpi, delta: d, deltaText: formatPivotNumber(d, k.deltaFormat ?? DEFAULT_PIVOT_DELTA_FORMAT) };
    });

  // ---- Rows ----------------------------------------------------------------
  const expandedSpec = spec.expanded ?? "all";
  const expandedIds =
    expandedSpec === "all" || expandedSpec === "none" ? null : new Set(expandedSpec.map((p) => pivotPathId(p)));
  const isExpanded = (n: PivotNode) =>
    !isLeaf(n) && (expandedSpec === "all" || (expandedIds !== null && expandedIds.has(pivotPathId(n.path))));

  const toRow = (n: PivotNode): PivotBodyRow => {
    const leaf = isLeaf(n);
    const dim = dims[n.depth]!;
    let attributes: Record<string, unknown> | undefined;
    if (dim.attributes?.length) {
      attributes = {};
      for (const field of dim.attributes) {
        const hit = n.rows.find((r) => r[field] !== null && r[field] !== undefined);
        attributes[field] = hit ? hit[field] : null;
      }
    }
    return {
      id: pivotPathId(n.path),
      kind: leaf ? "leaf" : "group",
      depth: n.depth,
      path: n.path,
      label: n.label,
      expandable: !leaf,
      expanded: isExpanded(n),
      childCount: n.children.length,
      sourceRowCount: n.rows.length,
      cells: n.cells,
      ...(attributes ? { attributes } : {}),
      ...(!leaf && kpiSpecs.length && kpiLevels.has(n.depth) ? { kpis: kpisFor(n) } : {}),
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
    sourceRowCount: root.rows.length,
    cells: root.cells,
    ...(kpiSpecs.length ? { kpis: kpisFor(root) } : {}),
  };

  const body: PivotBodyRow[] = [];
  const walk = (n: PivotNode) => {
    body.push(toRow(n));
    if (isExpanded(n)) for (const c of n.children) walk(c);
  };
  for (const c of root.children) walk(c);

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
              key: c.path[c.path.length - 1]!,
              label: c.label,
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

  return {
    version: PIVOT_SPEC_VERSION,
    ...(spec.id !== undefined ? { id: spec.id } : {}),
    ...(spec.title !== undefined ? { title: spec.title } : {}),
    ...(spec.subtitle !== undefined ? { subtitle: spec.subtitle } : {}),
    layout: spec.layout ?? "tabular",
    rowDimensions: dims.map((d) => ({ field: d.field, label: d.label ?? d.field })),
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
  };
}
