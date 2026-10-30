import type { PivotBodyRow, PivotModel } from "./types";

export type PivotSheetCellRole = "corner" | "header" | "group" | "leaf" | "grandTotal";

export interface PivotSheetCell {
  /** Numbers stay numeric (percent values are ratios) so spreadsheets can recalculate. */
  readonly v: string | number | null;
  /** Excel number format for numeric cells. */
  readonly numFmt?: string;
  readonly role: PivotSheetCellRole;
  readonly depth?: number;
  readonly heat?: number;
  readonly bold?: boolean;
}

export interface PivotSheetMerge {
  readonly row: number;
  readonly col: number;
  readonly rowSpan: number;
  readonly colSpan: number;
}

/**
 * Rectangular, spreadsheet-shaped view of a `PivotModel`: what an XLSX writer
 * (exceljs in Node, openpyxl in Python) or CSV/TSV export needs, with no layout logic left.
 */
export interface PivotSheet {
  readonly title?: string;
  readonly cells: readonly (readonly PivotSheetCell[])[];
  readonly merges: readonly PivotSheetMerge[];
  readonly frozenRows: number;
  readonly frozenCols: number;
  readonly rowHeaderColumnCount: number;
  readonly columnCount: number;
}

export interface PivotModelToSheetOptions {
  /** Default: `model.layout`. */
  readonly layout?: "tabular" | "compact";
  /** Compact layout indent per depth (default two spaces). */
  readonly indent?: string;
}

const roleOf = (row: PivotBodyRow): PivotSheetCellRole =>
  row.kind === "grandTotal" ? "grandTotal" : row.kind === "group" ? "group" : "leaf";

export function pivotModelToSheet(model: PivotModel, options: PivotModelToSheetOptions = {}): PivotSheet {
  const layout = options.layout ?? model.layout;
  const indent = options.indent ?? "  ";
  const dimCols = layout === "tabular" ? model.rowDimensions.length : 1;
  const headerCount = model.headerRows.length;
  const cells: PivotSheetCell[][] = [];
  const merges: PivotSheetMerge[] = [];

  // Header rows: row-dimension labels sit in the last header row (merged upward).
  model.headerRows.forEach((headerRow, r) => {
    const out: PivotSheetCell[] = [];
    const last = r === headerCount - 1;
    if (layout === "tabular") {
      for (const d of model.rowDimensions) out.push({ v: last ? d.label : null, role: "corner", bold: true });
    } else {
      out.push({ v: last ? model.rowDimensions.map((d) => d.label).join(" / ") : null, role: "corner", bold: true });
    }
    for (const h of headerRow) {
      if (h.colSpan > 1) merges.push({ row: r, col: out.length, rowSpan: 1, colSpan: h.colSpan });
      out.push({ v: h.label, role: "header", bold: true });
      for (let i = 1; i < h.colSpan; i++) out.push({ v: null, role: "header" });
    }
    cells.push(out);
  });
  if (headerCount > 1) {
    for (let c = 0; c < dimCols; c++) merges.push({ row: 0, col: c, rowSpan: headerCount, colSpan: 1 });
  }

  // Body rows.
  model.rows.forEach((row, rowIndex) => {
    const role = roleOf(row);
    const bold = row.kind !== "leaf";
    const out: PivotSheetCell[] = [];
    if (layout === "tabular") {
      for (let i = 0; i < dimCols; i++) {
        const show = row.kind === "grandTotal" ? i === 0 : row.depth === i;
        out.push({ v: show ? row.label : null, role, depth: row.depth, bold });
      }
      if (row.kind === "grandTotal" && dimCols > 1) {
        merges.push({ row: headerCount + rowIndex, col: 0, rowSpan: 1, colSpan: dimCols });
      }
    } else {
      out.push({ v: indent.repeat(Math.max(0, row.depth)) + row.label, role, depth: row.depth, bold });
    }
    row.cells.forEach((cell, i) => {
      const col = model.columns[i]!;
      out.push({
        v: cell.value,
        numFmt: cell.showAs ? col.excelPercentNumFmt : col.excelNumFmt,
        role,
        bold,
        ...(cell.heat !== undefined ? { heat: cell.heat } : {}),
      });
    });
    cells.push(out);
  });

  // Tabular row-dimension spans (a group label covers its visible descendants).
  if (layout === "tabular") {
    model.spans.forEach((levelSpans, level) => {
      for (const s of levelSpans) {
        if (s.span > 1) merges.push({ row: headerCount + s.rowIndex, col: level, rowSpan: s.span, colSpan: 1 });
      }
    });
  }

  return {
    ...(model.title !== undefined ? { title: model.title } : {}),
    cells,
    merges,
    frozenRows: headerCount,
    frozenCols: dimCols,
    rowHeaderColumnCount: dimCols,
    columnCount: dimCols + model.columns.length,
  };
}

/** Plain text/number matrix (e.g. for `matrixToTsv` or CSV writers). */
export function pivotSheetToMatrix(sheet: PivotSheet): (string | number | null)[][] {
  return sheet.cells.map((row) => row.map((c) => c.v));
}
