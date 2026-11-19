import type { PivotBodyRow, PivotHeaderCell, PivotModel } from "../core/pivot/types";
import { pivotColumnHeaderRole, type PivotColumnHeaderRole } from "./layout";

/** A value-column header cell with the columns and header rows it covers. */
export interface PivotHeaderLayoutCell {
  readonly cell: PivotHeaderCell;
  /** Header row of the cell (`0` = outermost). */
  readonly row: number;
  /** Last header row it covers (`row + rowSpan - 1`). */
  readonly lastRow: number;
  /** First value column it covers (index in `model.columns`). */
  readonly start: number;
  /** One past the last value column it covers. */
  readonly end: number;
  readonly role: PivotColumnHeaderRole;
  /** The column whose bottom header this is (one column, reaching the last header row), else `null`. */
  readonly leafColumn: number | null;
  /**
   * Measure cells (`role.kind === "measure"`) that can trade places: the id of the run of adjacent
   * measure siblings under the same parent (`"<row>:<first column>"`), else `null`.
   */
  readonly run: string | null;
}

export interface PivotHeaderLayout {
  /** Same shape as `model.headerRows`. */
  readonly rows: readonly (readonly PivotHeaderLayoutCell[])[];
  /** Runs of reorderable measure cells (two or more), left to right. */
  readonly runs: ReadonlyMap<string, readonly PivotHeaderLayoutCell[]>;
}

/**
 * Column ranges of the value-column header cells (`rowSpan` / `colSpan` resolved), the bottom header
 * of each column, and the runs of measure headers a person can reorder.
 */
export function pivotHeaderLayout(model: PivotModel): PivotHeaderLayout {
  const rowCount = model.headerRows.length;
  const width = model.columns.length;
  const occupied = Array.from({ length: rowCount }, () => new Uint8Array(width));
  const rows: PivotHeaderLayoutCell[][] = [];
  model.headerRows.forEach((cells, r) => {
    let pos = 0;
    const out: PivotHeaderLayoutCell[] = [];
    for (const cell of cells) {
      while (pos < width && occupied[r]![pos]) pos++;
      const start = pos;
      const end = Math.min(width, start + cell.colSpan);
      const lastRow = Math.min(rowCount - 1, r + (cell.rowSpan ?? 1) - 1);
      for (let rr = r; rr <= lastRow; rr++) occupied[rr]!.fill(1, start, end);
      pos = end;
      out.push({
        cell,
        row: r,
        lastRow,
        start,
        end,
        role: pivotColumnHeaderRole(model, r, cell),
        leafColumn: lastRow === rowCount - 1 && end - start === 1 ? start : null,
        run: null,
      });
    }
    rows.push(out);
  });

  // Measure siblings: same row, same parent (the cell above that ends on the previous row), adjacent.
  const runs = new Map<string, PivotHeaderLayoutCell[]>();
  rows.forEach((cells, r) => {
    const parentOf = (c: PivotHeaderLayoutCell): string => {
      if (r === 0) return "";
      for (let pr = r - 1; pr >= 0; pr--) {
        const p = rows[pr]!.find((x) => x.lastRow === r - 1 && x.start <= c.start && c.end <= x.end);
        if (p) return `${pr}:${p.start}`;
      }
      return "";
    };
    let current: PivotHeaderLayoutCell[] | null = null;
    let currentParent = "";
    cells.forEach((c) => {
      const isMeasure = c.role.kind === "measure" && c.cell.measureId !== undefined;
      if (!isMeasure) {
        current = null;
        return;
      }
      const parent = parentOf(c);
      const prev = current?.[current.length - 1];
      if (current && prev && prev.end === c.start && parent === currentParent) {
        current.push(c);
      } else {
        current = [c];
        currentParent = parent;
        runs.set(`${r}:${c.start}`, current);
      }
    });
  });
  for (const [id, cells] of runs) {
    if (cells.length < 2 || new Set(cells.map((c) => c.cell.measureId)).size !== cells.length) {
      runs.delete(id);
      continue;
    }
    for (const c of cells) {
      const at = rows[c.row]!.indexOf(c);
      rows[c.row]![at] = { ...c, run: id };
    }
  }
  const finalRuns = new Map<string, readonly PivotHeaderLayoutCell[]>();
  for (const id of runs.keys()) {
    const [row] = id.split(":");
    finalRuns.set(id, rows[Number(row)]!.filter((c) => c.run === id));
  }
  return { rows, runs: finalRuns };
}

/** Value measure ids in display order (first appearance in `model.columns`). */
export function pivotMeasureOrder(model: PivotModel): readonly string[] {
  const seen = new Set<string>();
  for (const c of model.columns) seen.add(c.measureId);
  return [...seen];
}

/**
 * Move measure `id` by `delta` places in `order` (clamped at both ends). Returns `order` itself when
 * nothing moves.
 */
export function pivotMoveMeasure(order: readonly string[], id: string, delta: number): readonly string[] {
  const from = order.indexOf(id);
  if (from < 0) return order;
  const to = Math.max(0, Math.min(order.length - 1, from + delta));
  if (to === from) return order;
  const next = order.filter((m) => m !== id);
  next.splice(to, 0, id);
  return next;
}

/**
 * The model with its value measures in `order` (`PivotTable` `measureOrder`): within every run of
 * sibling measure headers, the measures (and everything under them) trade places; columns, cells and
 * header rows move together. Ids missing from `order` keep their place after the listed ones; unknown
 * ids are ignored. Column-dimension members never move. Returns `model` itself when nothing changes.
 */
export function pivotOrderMeasures(model: PivotModel, order: readonly string[] | undefined): PivotModel {
  if (!order?.length) return model;
  const current = pivotMeasureOrder(model);
  if (current.length < 2) return model;
  const rank = new Map<string, number>();
  order.forEach((id, i) => {
    if (!rank.has(id)) rank.set(id, i);
  });
  current.forEach((id, i) => {
    if (!rank.has(id)) rank.set(id, order.length + i);
  });
  const layout = pivotHeaderLayout(model);
  const perm = model.columns.map((_, i) => i);
  let changed = false;
  for (const cells of layout.runs.values()) {
    const sorted = [...cells].sort((a, b) => rank.get(a.cell.measureId!)! - rank.get(b.cell.measureId!)!);
    let at = cells[0]!.start;
    for (const c of sorted) {
      for (let col = c.start; col < c.end; col++) {
        if (perm[at] !== col) changed = true;
        perm[at++] = col;
      }
    }
  }
  if (!changed) return model;

  const newIndex = new Int32Array(perm.length);
  perm.forEach((old, i) => (newIndex[old] = i));
  const headerRows = layout.rows.map((cells) =>
    cells
      .map((c) => {
        let first = Infinity;
        for (let col = c.start; col < c.end; col++) first = Math.min(first, newIndex[col]!);
        return { cell: c.cell, first };
      })
      .sort((a, b) => a.first - b.first)
      .map((x) => x.cell),
  );
  const reorder = (row: PivotBodyRow): PivotBodyRow => ({ ...row, cells: perm.map((i) => row.cells[i]!) });
  const grandTotal = reorder(model.grandTotal);
  return {
    ...model,
    columns: perm.map((i) => model.columns[i]!),
    headerRows,
    rows: model.rows.map((row) => (row === model.grandTotal ? grandTotal : reorder(row))),
    grandTotal,
  };
}
