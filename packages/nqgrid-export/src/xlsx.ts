import ExcelJS from "exceljs";
import {
  DEFAULT_PIVOT_DELTA_FORMAT,
  isPivotHeatPalette,
  isPivotToneKey,
  pivotHeatPaletteStep,
  pivotModelToSheet,
  toExcelNumFmt,
  type PivotKpiValue,
  type PivotModel,
  type PivotNumberFormat,
  type PivotSheet,
  type PivotSheetCell,
  type PivotSheetLine,
  type PivotSpec,
} from "@nqlib/nqgrid/core";
import type { PivotCellTone } from "@nqlib/nqgrid/pivot";
import {
  isPivotToneHex,
  PIVOT_STATIC_PALETTE,
  pivotHeatLevelFillHex,
  pivotPaletteFillHex,
} from "@nqlib/nqgrid/render-static";

export interface PivotXlsxOptions {
  /** Spec used to build the model: KPI number formats + a hidden `Spec` sheet for traceability. */
  readonly spec?: PivotSpec;
  /** Printed on the `Spec` sheet; a parseable date also sets the workbook dates. */
  readonly generatedAt?: string | null;
  /** First sheet name (default: model title, else `Pivot`). */
  readonly sheetName?: string;
  /**
   * The sheet to write (`buildPivotSheet` / `pivotModelToSheet` of `model`, e.g. with hidden detail
   * rows of collapsed groups, the statement profile or `SUBTOTAL` formulas). Default:
   * `pivotModelToSheet(model, { profile, spec })`.
   */
  readonly sheet?: PivotSheet;
  /** `statement`: bold totals with rules, no grey bands (used when `sheet` is not given). */
  readonly profile?: "report" | "statement";
  /**
   * Same callback as `PivotTable` `cellTone`. Applied when the written sheet's body rows align with
   * `model.rows` (the default sheet). A key with a `#rgb` / `#rrggbb` in `toneColors` paints that
   * fill and skips heat. Not stored in `PivotSpec`.
   */
  readonly cellTone?: PivotCellTone;
  /**
   * Hex colours for tone keys (`#rgb` / `#rrggbb` only). Used for `cellTone` and for
   * `model.heat.palette`. A `color-mix` or `var()` value is ignored. A palette stop with no usable
   * hex paints no fill (no built-in-ramp fallback). Not part of `PivotSpec`.
   */
  readonly toneColors?: Readonly<Record<string, string>>;
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

/** Hex entries only (`#rgb` / `#rrggbb`), keyed by valid tone key. */
function hexToneMap(toneColors: Readonly<Record<string, string>> | undefined): Readonly<Record<string, string>> {
  if (!toneColors) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(toneColors)) {
    if (!isPivotToneKey(key) || !isPivotToneHex(value)) continue;
    out[key] = value.trim();
  }
  return out;
}

/**
 * Fill for one sheet value cell: `cellTone` hex wins, else a `model.heat.palette` blend, else the
 * built-in heat ramp when there is no palette. A palette with a missing hex returns `null` (no fill).
 */
function valueFillHex(
  src: PivotSheetCell,
  levels: number,
  model: PivotModel,
  toneHex: Readonly<Record<string, string>>,
  toneKey: string | undefined,
): string | null | undefined {
  if (toneKey !== undefined && isPivotToneKey(toneKey)) {
    const hex = toneHex[toneKey];
    if (hex !== undefined) return hex;
  }
  if (src.heat === undefined) return undefined;
  const heat = model.heat;
  if (heat && isPivotHeatPalette(heat.palette)) {
    const step = pivotHeatPaletteStep(src.heat, levels, heat.scale ?? "sequential");
    return pivotPaletteFillHex(heat.palette, step, toneHex) ?? null;
  }
  return pivotHeatLevelFillHex(src.heat, levels);
}

function styleCell(
  cell: ExcelJS.Cell,
  src: PivotSheetCell,
  levels: number,
  isDimension: boolean,
  statement: boolean,
  fillHex: string | null | undefined,
) {
  if (src.numFmt && typeof src.v === "number") cell.numFmt = src.numFmt;
  const font: Partial<ExcelJS.Font> = { name: "Calibri", size: 11, color: { argb: argb(palette.foreground) } };
  if (src.bold) font.bold = true;
  if (src.role === "header" || src.role === "corner") {
    font.color = { argb: argb(palette.mutedForeground) };
    cell.border = { bottom: thin(palette.border) };
    cell.alignment = { vertical: "middle", horizontal: src.role === "header" ? "right" : "left" };
  } else {
    cell.alignment = {
      vertical: isDimension && src.role === "group" ? "top" : "middle",
      horizontal: isDimension ? "left" : "right",
      ...(src.indent ? { indent: src.indent } : {}),
    };
    const rule: Partial<ExcelJS.Border> = { style: "thin", color: { argb: argb(palette.foreground) } };
    cell.border = {
      bottom: src.border?.bottom === "double" ? { style: "double", color: { argb: argb(palette.foreground) } } : thin(palette.hairline),
      ...(src.border?.top ? { top: rule } : src.role === "grandTotal" ? { top: thin(palette.border) } : {}),
    };
  }
  if (typeof fillHex === "string") cell.fill = solid(fillHex);
  else if (fillHex === null) {
    /* palette set, no usable hex: leave unfilled */
  } else if (src.heat !== undefined) cell.fill = solid(pivotHeatLevelFillHex(src.heat, levels));
  else if (!statement && (src.role === "group" || src.role === "grandTotal")) cell.fill = solid(palette.muted);
  cell.font = font;
}

/** Excel header / footer text: `&` is the code prefix, so a literal one is `&&`. */
const hfText = (s: string) => s.replace(/&/g, "&&");

/** Preamble line styles: the title large and bold, the rest small and muted. */
function stylePreamble(cell: ExcelJS.Cell, line: PivotSheetLine) {
  cell.font =
    line.role === "title"
      ? { name: "Calibri", size: 14, bold: true, color: { argb: argb(palette.foreground) } }
      : { name: "Calibri", size: 10, color: { argb: argb(palette.mutedForeground) }, ...(line.role === "units" ? { italic: true } : {}) };
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
 * Workbook from a `PivotSheet` (`pivotModelToSheet`): the report sheet (title, subtitle, units and a
 * filters line above the table; numeric values + numFmt; Excel row outline with collapsed groups
 * hidden, not dropped; indented compact labels; frozen panes below the header rows; bold subtotals,
 * statement rules, heat fills, column widths; print setup: landscape, fit to one page wide, header
 * rows repeated on every page, title / units in the page header and "Page N of M" in the footer), a
 * `KPIs` sheet (only when the spec has KPIs) and a hidden `Spec` sheet. Active filters
 * (`model.filters`) are also listed under the KPIs and on the Spec sheet, as are the units and
 * `model.diagnostics`.
 */
export async function writePivotXlsx(model: PivotModel, options: PivotXlsxOptions = {}): Promise<Uint8Array> {
  const sheet = options.sheet ?? pivotModelToSheet(model, { profile: options.profile, ...(options.spec ? { spec: options.spec } : {}) });
  const statement = sheet.profile === "statement";
  const top = sheet.tableRow ?? 0;
  const toneHex = hexToneMap(options.toneColors);
  const cellTone = options.cellTone;
  const toneAligned = cellTone !== undefined && sheet.bodyRows.length === model.rows.length;
  const wb = new ExcelJS.Workbook();
  wb.creator = "nqgrid-export";
  if (model.title) wb.title = model.title;
  const stamp = options.generatedAt ? new Date(options.generatedAt.replace(/ UTC$/, "Z").replace(" ", "T")) : null;
  if (stamp && !Number.isNaN(stamp.getTime())) {
    wb.created = stamp;
    wb.modified = stamp;
  }

  // --- Pivot sheet ---------------------------------------------------------------------------
  const outlined = (sheet.outlineLevels ?? 0) > 0;
  const ws = wb.addWorksheet(xlsxSheetName(options.sheetName ?? sheet.title ?? model.title ?? "Pivot"), {
    views: [{ state: "frozen", xSplit: sheet.frozenCols, ySplit: top + sheet.frozenRows }],
    properties: {
      ...(outlined ? { outlineLevelRow: sheet.outlineLevels, outlineProperties: { summaryBelow: sheet.summaryBelow ?? false, summaryRight: true } } : {}),
    } as Partial<ExcelJS.WorksheetProperties>,
  });
  (sheet.preamble ?? []).forEach((line, i) => {
    const cell = ws.getCell(i + 1, 1);
    cell.value = line.text;
    stylePreamble(cell, line);
    ws.getRow(i + 1).height = line.role === "title" ? 22 : 16;
  });
  const levels = model.heat?.levels ?? 9;
  sheet.cells.forEach((row, r) => {
    row.forEach((src, c) => {
      const cell = ws.getCell(top + r + 1, c + 1);
      if (src.f !== undefined) cell.value = { formula: src.f, result: typeof src.v === "number" ? src.v : undefined } as ExcelJS.CellFormulaValue;
      else if (src.v !== null) cell.value = src.v;
      const isDimension = c < sheet.rowHeaderColumnCount;
      const bodyIndex = r - sheet.frozenRows;
      const columnIndex = c - sheet.rowHeaderColumnCount;
      let toneKey: string | undefined;
      if (toneAligned && !isDimension && bodyIndex >= 0 && columnIndex >= 0) {
        const bodyRow = model.rows[bodyIndex]!;
        const column = model.columns[columnIndex]!;
        const modelCell = bodyRow.cells[columnIndex]!;
        toneKey = cellTone!({ model, row: bodyRow, rowIndex: bodyIndex, column, columnIndex, cell: modelCell });
      }
      const fillHex =
        isDimension || r < sheet.frozenRows
          ? undefined
          : valueFillHex(src, levels, model, toneHex, toneKey);
      styleCell(cell, src, levels, isDimension, statement, fillHex);
    });
    const xr = ws.getRow(top + r + 1);
    xr.height = r < sheet.frozenRows ? 20 : 18;
    const meta = r >= sheet.frozenRows ? sheet.bodyRows?.[r - sheet.frozenRows] : undefined;
    if (meta) {
      if (meta.outlineLevel > 0) xr.outlineLevel = meta.outlineLevel;
      if (meta.hidden) xr.hidden = true;
      // exceljs derives `collapsed` from the level; Excel reads it on the summary row of a hidden block.
      Object.defineProperty(xr, "collapsed", { value: meta.collapsed === true, configurable: true });
    }
  });
  for (const m of sheet.merges) ws.mergeCells(top + m.row + 1, m.col + 1, top + m.row + m.rowSpan, m.col + m.colSpan);

  // Print setup: landscape, one page wide, header rows on every page, title / units / page numbers.
  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: false,
    ...(sheet.frozenRows > 0 ? { printTitlesRow: `${top + 1}:${top + sheet.frozenRows}` } : {}),
  } as Partial<ExcelJS.PageSetup>;
  const title = sheet.title;
  const units = sheet.units;
  const header = `${title ? `&L${hfText(title)}` : ""}${units ? `&R${hfText(units)}` : ""}`;
  if (header) ws.headerFooter.oddHeader = header;
  ws.headerFooter.oddFooter = `${options.generatedAt ? `&L${hfText(options.generatedAt)}` : ""}&RPage &P of &N`;
  for (let c = 0; c < sheet.columnCount; c++) {
    const texts =
      c < sheet.rowHeaderColumnCount
        ? sheet.cells.map((row) => " ".repeat(2 * (row[c]?.indent ?? 0)) + String(row[c]?.v ?? ""))
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
    if (sheet.filters?.length) {
      ks.addRow([]);
      ks.addRow(["Filters"]).font = { bold: true, color: { argb: argb(palette.mutedForeground) } };
      for (const text of sheet.filters) ks.addRow([text]);
    }
  }

  // --- Spec sheet (hidden, traceability) -----------------------------------------------------
  if (options.spec) {
    const ss = wb.addWorksheet("Spec", { state: "hidden" });
    ss.addRow(["nqgrid-export · PivotSpec v1 (rebuild this workbook from the spec and the same rows)"]);
    ss.addRow(["generatedAt", options.generatedAt ?? null]);
    for (const text of sheet.filters ?? []) ss.addRow(["filter", text]);
    if (model.units) ss.addRow(["units", model.units]);
    for (const d of model.diagnostics ?? []) ss.addRow(["diagnostic", d.message]);
    ss.addRow([]);
    for (const line of JSON.stringify(options.spec, null, 2).split("\n")) ss.addRow([line]);
    ss.getColumn(1).width = 100;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
