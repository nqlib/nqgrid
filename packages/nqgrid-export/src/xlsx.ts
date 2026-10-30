import ExcelJS from "exceljs";
import {
  DEFAULT_PIVOT_DELTA_FORMAT,
  pivotModelToSheet,
  toExcelNumFmt,
  type PivotKpiValue,
  type PivotModel,
  type PivotNumberFormat,
  type PivotSheetCell,
  type PivotSpec,
} from "@nqlib/nqgrid/core";
import { PIVOT_STATIC_PALETTE, pivotHeatLevelFillHex } from "@nqlib/nqgrid/render-static";

export interface PivotXlsxOptions {
  /** Spec used to build the model: KPI number formats + a hidden `Spec` sheet for traceability. */
  readonly spec?: PivotSpec;
  /** Printed on the `Spec` sheet; a parseable date also sets the workbook dates. */
  readonly generatedAt?: string | null;
  /** First sheet name (default: model title, else `Pivot`). */
  readonly sheetName?: string;
}

const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;
const solid = (hex: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } });
const palette = PIVOT_STATIC_PALETTE.light;
const thin = (hex: string): Partial<ExcelJS.Border> => ({ style: "thin", color: { argb: argb(hex) } });

/** Excel sheet names: ≤ 31 chars, no `[]:*?/\`. */
export function xlsxSheetName(name: string, fallback = "Pivot"): string {
  const clean = name.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31);
  return clean || fallback;
}

function styleCell(cell: ExcelJS.Cell, src: PivotSheetCell, levels: number, isDimension: boolean) {
  if (src.numFmt && typeof src.v === "number") cell.numFmt = src.numFmt;
  const font: Partial<ExcelJS.Font> = { name: "Calibri", size: 11, color: { argb: argb(palette.foreground) } };
  if (src.bold) font.bold = true;
  if (src.role === "header" || src.role === "corner") {
    font.color = { argb: argb(palette.mutedForeground) };
    cell.border = { bottom: thin(palette.border) };
    cell.alignment = { vertical: "middle", horizontal: src.role === "header" ? "right" : "left" };
  } else {
    cell.alignment = { vertical: isDimension && src.role === "group" ? "top" : "middle", horizontal: isDimension ? "left" : "right" };
    cell.border = { bottom: thin(palette.hairline), ...(src.role === "grandTotal" ? { top: thin(palette.border) } : {}) };
  }
  if (src.heat !== undefined) cell.fill = solid(pivotHeatLevelFillHex(src.heat, levels));
  else if (src.role === "group" || src.role === "grandTotal") cell.fill = solid(palette.muted);
  cell.font = font;
}

const kpiFormats = (spec: PivotSpec | undefined) => {
  const byId = new Map<string, { value?: string; delta: string }>();
  for (const k of spec?.kpis ?? []) {
    const measure = spec?.measures.find((m) => m.id === k.measure);
    const fmt: PivotNumberFormat | undefined = k.format ?? measure?.format;
    byId.set(k.id, { ...(fmt ? { value: toExcelNumFmt(fmt) } : {}), delta: toExcelNumFmt(k.deltaFormat ?? DEFAULT_PIVOT_DELTA_FORMAT) });
  }
  return byId;
};

/**
 * Workbook from `pivotModelToSheet`: the pivot sheet (numeric values + numFmt, merges, frozen panes,
 * bold subtotals, heat fills, column widths), a `KPIs` sheet and a hidden `Spec` sheet.
 */
export async function writePivotXlsx(model: PivotModel, options: PivotXlsxOptions = {}): Promise<Uint8Array> {
  const sheet = pivotModelToSheet(model);
  const wb = new ExcelJS.Workbook();
  wb.creator = "nqgrid-export";
  if (model.title) wb.title = model.title;
  const stamp = options.generatedAt ? new Date(options.generatedAt.replace(/ UTC$/, "Z").replace(" ", "T")) : null;
  if (stamp && !Number.isNaN(stamp.getTime())) {
    wb.created = stamp;
    wb.modified = stamp;
  }

  // --- Pivot sheet ---------------------------------------------------------------------------
  const ws = wb.addWorksheet(xlsxSheetName(options.sheetName ?? model.title ?? "Pivot"), {
    views: [{ state: "frozen", xSplit: sheet.frozenCols, ySplit: sheet.frozenRows }],
  });
  const levels = model.heat?.levels ?? 9;
  sheet.cells.forEach((row, r) => {
    row.forEach((src, c) => {
      const cell = ws.getCell(r + 1, c + 1);
      if (src.v !== null) cell.value = src.v;
      styleCell(cell, src, levels, c < sheet.rowHeaderColumnCount);
    });
    ws.getRow(r + 1).height = r < sheet.frozenRows ? 20 : 18;
  });
  for (const m of sheet.merges) ws.mergeCells(m.row + 1, m.col + 1, m.row + m.rowSpan, m.col + m.colSpan);
  for (let c = 0; c < sheet.columnCount; c++) {
    const texts =
      c < sheet.rowHeaderColumnCount
        ? sheet.cells.map((row) => String(row[c]?.v ?? ""))
        : [String(sheet.cells[sheet.frozenRows - 1]?.[c]?.v ?? ""), ...model.rows.map((row) => row.cells[c - sheet.rowHeaderColumnCount]?.text ?? "")];
    const longest = Math.max(0, ...texts.map((t) => t.length));
    ws.getColumn(c + 1).width = c < sheet.rowHeaderColumnCount ? Math.min(40, Math.max(12, longest + 4)) : Math.min(24, Math.max(10, longest + 3));
  }

  // --- KPIs sheet ----------------------------------------------------------------------------
  const kpiRows: { scope: string; caption: string; kpi: PivotKpiValue }[] = [];
  for (const k of model.kpis) kpiRows.push({ scope: model.grandTotal.label, caption: "", kpi: k });
  const seen = new Set<string>();
  for (const row of model.rows) {
    if (row.kind !== "group" || !row.kpis?.length || seen.has(row.id)) continue;
    seen.add(row.id);
    const caption = Object.values(row.attributes ?? {}).find((v) => v !== null && v !== undefined && v !== "");
    for (const k of row.kpis) kpiRows.push({ scope: row.path.join(" / "), caption: caption === undefined ? "" : String(caption), kpi: k });
  }
  if (kpiRows.length) {
    const formats = kpiFormats(options.spec);
    const ks = wb.addWorksheet("KPIs", { views: [{ state: "frozen", ySplit: 1 }] });
    const header = [model.rowDimensions[0]?.label ?? "Group", "Owner", "KPI", "Value", "Compared to", "Delta"];
    ks.addRow(header);
    ks.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: argb(palette.mutedForeground) } };
      cell.border = { bottom: thin(palette.border) };
    });
    for (const { scope, caption, kpi } of kpiRows) {
      const row = ks.addRow([scope, caption, kpi.label, kpi.value, kpi.compareLabel ?? null, kpi.delta ?? null]);
      const fmt = formats.get(kpi.id);
      if (fmt?.value) row.getCell(4).numFmt = fmt.value;
      if (fmt) row.getCell(6).numFmt = fmt.delta;
      if (scope === model.grandTotal.label) row.font = { bold: true };
    }
    [22, 18, 20, 14, 14, 10].forEach((w, i) => (ks.getColumn(i + 1).width = w));
  }

  // --- Spec sheet (hidden, traceability) -----------------------------------------------------
  if (options.spec) {
    const ss = wb.addWorksheet("Spec", { state: "hidden" });
    ss.addRow(["nqgrid-export · PivotSpec v1 (rebuild this workbook from the spec and the same rows)"]);
    ss.addRow(["generatedAt", options.generatedAt ?? null]);
    ss.addRow([]);
    for (const line of JSON.stringify(options.spec, null, 2).split("\n")) ss.addRow([line]);
    ss.getColumn(1).width = 100;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
