/**
 * Headless pivot / cross-tab engine.
 *
 * Turns a flat row list into a spreadsheet-style PivotTable: rows are nested by
 * the **row** dimensions, columns are GENERATED from the distinct values of the
 * **column** dimensions (the cross-tab), and each cell is a **measure**
 * aggregated over the rows at that row×column intersection. Subtotal rows per
 * row-group and a grand-total row are emitted from the raw rows (so `avg`/`min`/
 * `max` are correct, not re-derived from child cells).
 *
 * Pure data in → data out. No React, no styling, no DOM — the consumer renders
 * `columnHeaderRows` + `rows` however it likes.
 */

/** Field separator for composite keys — a control char unlikely to appear in data. */
const SEP = "␟";

export type PivotAggregator = "sum" | "avg" | "count" | "min" | "max";

/** A dimension placed on the row or column axis. */
export interface PivotField<TRow> {
  readonly key: string;
  readonly get: (row: TRow) => string | number;
  readonly label?: string;
}

/** A numeric value aggregated into each cell. */
export interface PivotMeasure<TRow> {
  readonly key: string;
  readonly get: (row: TRow) => number;
  readonly agg: PivotAggregator;
  readonly label?: string;
}

export interface PivotConfig<TRow> {
  /** Row dimensions, outer → inner nesting. Empty = a single grand-total row. */
  readonly rows?: readonly PivotField<TRow>[];
  /** Column dimensions, outer → inner. Empty = one column group per measure. */
  readonly columns?: readonly PivotField<TRow>[];
  readonly measures: readonly PivotMeasure<TRow>[];
  /** Emit a subtotal row for each non-leaf row group (default `true`). */
  readonly subtotals?: boolean;
  /** Emit a grand-total row (default `true`). */
  readonly grandTotal?: boolean;
}

/** One leaf data column = a column-dimension path × a measure. */
export interface PivotColumnLeaf {
  readonly key: string;
  readonly path: readonly string[];
  readonly measureKey: string;
  readonly label: string;
}

/** A header cell for the multi-row column header; `span` is in leaf-column units. */
export interface PivotHeaderCell {
  readonly key: string;
  readonly label: string;
  readonly span: number;
  readonly isLeaf: boolean;
  readonly measureKey?: string;
}

export type PivotRowKind = "leaf" | "subtotal" | "grandTotal";

export interface PivotRow {
  readonly key: string;
  /** Row-dimension values; length = depth. Empty for the grand total. */
  readonly path: readonly string[];
  readonly depth: number;
  readonly kind: PivotRowKind;
  readonly label: string;
  /** Aggregated measure values keyed by `PivotColumnLeaf.key` (null = no data). */
  readonly cells: Readonly<Record<string, number | null>>;
}

export interface PivotResult {
  readonly columnLeaves: readonly PivotColumnLeaf[];
  /** Top → bottom header rows (column-dimension levels, then the measures row). */
  readonly columnHeaderRows: readonly (readonly PivotHeaderCell[])[];
  /** Flattened, render-ready: leaf rows, subtotal rows, then the grand total. */
  readonly rows: readonly PivotRow[];
  readonly grandTotal: Readonly<Record<string, number | null>> | null;
}

/** Aggregate a list of numeric values. `count` ignores the values and counts entries. */
export function aggregate(values: readonly number[], agg: PivotAggregator): number | null {
  if (agg === "count") return values.length;
  if (values.length === 0) return null;
  switch (agg) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return values.reduce((a, b) => (b < a ? b : a));
    case "max":
      return values.reduce((a, b) => (b > a ? b : a));
  }
}

interface PreRow<TRow> {
  readonly rowPath: readonly string[];
  readonly colKey: string;
  readonly row: TRow;
}

export function computePivot<TRow>(data: readonly TRow[], config: PivotConfig<TRow>): PivotResult {
  const rowFields = config.rows ?? [];
  const colFields = config.columns ?? [];
  const measures = config.measures;
  const withSubtotals = config.subtotals ?? true;
  const withGrandTotal = config.grandTotal ?? true;

  const pre: PreRow<TRow>[] = data.map((row) => ({
    rowPath: rowFields.map((f) => String(f.get(row))),
    colKey: colFields.map((f) => String(f.get(row))).join(SEP),
    row,
  }));

  // Distinct column-dimension paths, stable-sorted for deterministic column order.
  const colPathByKey = new Map<string, string[]>();
  for (const row of data) {
    const path = colFields.map((f) => String(f.get(row)));
    colPathByKey.set(path.join(SEP), path);
  }
  const colPaths =
    colFields.length === 0
      ? [[] as string[]]
      : [...colPathByKey.values()].sort((a, b) =>
          a.join(SEP).localeCompare(b.join(SEP), undefined, { numeric: true }),
        );

  const columnLeaves: PivotColumnLeaf[] = [];
  for (const path of colPaths) {
    for (const m of measures) {
      columnLeaves.push({
        key: path.join(SEP) + SEP + m.key,
        path,
        measureKey: m.key,
        label: m.label ?? m.key,
      });
    }
  }

  const measureByKey = new Map(measures.map((m) => [m.key, m]));

  const cellsFor = (subset: readonly PreRow<TRow>[]): Record<string, number | null> => {
    const byCol = new Map<string, TRow[]>();
    for (const p of subset) {
      const arr = byCol.get(p.colKey);
      if (arr) arr.push(p.row);
      else byCol.set(p.colKey, [p.row]);
    }
    const cells: Record<string, number | null> = {};
    for (const leaf of columnLeaves) {
      const measure = measureByKey.get(leaf.measureKey)!;
      const rows = colFields.length === 0 ? subset.map((p) => p.row) : byCol.get(leaf.path.join(SEP)) ?? [];
      if (measure.agg === "count") {
        cells[leaf.key] = aggregate(rows.map(() => 1), "count");
      } else {
        const values = rows
          .map((r) => measure.get(r))
          .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
        cells[leaf.key] = aggregate(values, measure.agg);
      }
    }
    return cells;
  };

  const outRows: PivotRow[] = [];

  const walk = (subset: readonly PreRow<TRow>[], path: readonly string[], depth: number): void => {
    if (depth === rowFields.length) {
      outRows.push({
        key: path.join(SEP),
        path,
        depth,
        kind: "leaf",
        label: path[path.length - 1] ?? "",
        cells: cellsFor(subset),
      });
      return;
    }
    const buckets = new Map<string, PreRow<TRow>[]>();
    for (const p of subset) {
      const value = p.rowPath[depth]!;
      const arr = buckets.get(value);
      if (arr) arr.push(p);
      else buckets.set(value, [p]);
    }
    const values = [...buckets.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const value of values) {
      const childSubset = buckets.get(value)!;
      const childPath = [...path, value];
      walk(childSubset, childPath, depth + 1);
      if (withSubtotals && depth < rowFields.length - 1) {
        outRows.push({
          key: childPath.join(SEP) + SEP + "∑",
          path: childPath,
          depth: depth + 1,
          kind: "subtotal",
          label: `${value} total`,
          cells: cellsFor(childSubset),
        });
      }
    }
  };

  if (rowFields.length > 0) walk(pre, [], 0);

  const grandTotal = cellsFor(pre);
  if (withGrandTotal || rowFields.length === 0) {
    outRows.push({
      key: "∑grand",
      path: [],
      depth: 0,
      kind: "grandTotal",
      label: "Grand total",
      cells: grandTotal,
    });
  }

  return {
    columnLeaves,
    columnHeaderRows: buildColumnHeaderRows(colPaths, colFields.length, measures),
    rows: outRows,
    grandTotal: withGrandTotal || rowFields.length === 0 ? grandTotal : null,
  };
}

function buildColumnHeaderRows<TRow>(
  colPaths: readonly string[][],
  colFieldCount: number,
  measures: readonly PivotMeasure<TRow>[],
): PivotHeaderCell[][] {
  const out: PivotHeaderCell[][] = [];
  const measureSpan = measures.length;

  for (let level = 0; level < colFieldCount; level++) {
    const row: PivotHeaderCell[] = [];
    let i = 0;
    while (i < colPaths.length) {
      const groupKey = colPaths[i]!.slice(0, level + 1).join(SEP);
      const label = colPaths[i]![level]!;
      let count = 0;
      while (i < colPaths.length && colPaths[i]!.slice(0, level + 1).join(SEP) === groupKey) {
        count++;
        i++;
      }
      row.push({ key: `lvl${level}${SEP}${groupKey}`, label, span: count * measureSpan, isLeaf: false });
    }
    out.push(row);
  }

  // Measures row: shown when there are multiple measures or any column grouping.
  if (measureSpan > 1 || colFieldCount > 0) {
    const row: PivotHeaderCell[] = [];
    for (const path of colPaths) {
      for (const m of measures) {
        row.push({
          key: path.join(SEP) + SEP + m.key,
          label: m.label ?? m.key,
          span: 1,
          isLeaf: true,
          measureKey: m.key,
        });
      }
    }
    out.push(row);
  }

  return out;
}
