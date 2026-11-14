import { createPivotModelBuilder, type BuildPivotModelOptions, type PivotModelBuilder } from "./build-model";
import { pivotShowAsFormatKind } from "./format";
import type { PivotBodyRow, PivotDataRow, PivotModel, PivotSpec } from "./types";

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
  /**
   * Indent level of a compact-layout row label (Excel's alignment indent, one step per depth), in
   * place of leading spaces, so the label text stays exact for filters and lookups.
   */
  readonly indent?: number;
  /**
   * `subtotalFormulas`: an Excel formula without the leading `=` (`SUBTOTAL(9,C5:C9)`, A1 references
   * of the written sheet, i.e. after `tableRow`); `v` stays the cached result.
   */
  readonly f?: string;
  /** Statement profile rules: a thin rule above (subtotal and calculated item values, grand total) and a double rule below (grand total). */
  readonly border?: { readonly top?: "thin"; readonly bottom?: "double" };
}

export interface PivotSheetMerge {
  readonly row: number;
  readonly col: number;
  readonly rowSpan: number;
  readonly colSpan: number;
}

/** A text line printed above the table (`PivotSheet.preamble`). */
export interface PivotSheetLine {
  readonly text: string;
  readonly role: "title" | "subtitle" | "units" | "filters";
}

/** Outline and visibility of one body row (`PivotSheet.bodyRows`, aligned with `cells` after the header rows). */
export interface PivotSheetRow {
  readonly kind: PivotBodyRow["kind"];
  readonly depth: number;
  /**
   * Excel row outline level (0–7): the number of groups this row is detail of. A group whose
   * subtotals sit at its end (`subtotal: "end"`) is detail of itself (its header collapses with its
   * children and the subtotal row below stays), so its header is one level deeper than its subtotal row.
   */
  readonly outlineLevel: number;
  /** Inside a group collapsed in the view (`expanded`): written hidden, so Excel's outline shows it collapsed. */
  readonly hidden?: true;
  /** The row Excel attaches the outline button of a hidden block to (`collapsed="1"`, shows +). */
  readonly collapsed?: true;
}

/**
 * Rectangular, spreadsheet-shaped view of a `PivotModel`: what an XLSX writer
 * (exceljs in Node, openpyxl in Python) or CSV/TSV export needs, with no layout logic left.
 */
export interface PivotSheet {
  readonly title?: string;
  readonly subtitle?: string;
  /** `model.units` (the spec's unit note, e.g. "EUR thousands"), when set: writers print it in the page header. */
  readonly units?: string;
  /** Active filters as printable lines (`model.filters[].text`), when any. */
  readonly filters?: readonly string[];
  /**
   * Lines to write above the table (title, subtitle, units, one `Filters: …` line), when any; the
   * table starts at `tableRow`, so a reader of the report sheet sees what it shows and how it is filtered.
   */
  readonly preamble?: readonly PivotSheetLine[];
  /** First sheet row (0-based) of `cells`: the preamble lines plus one blank row, `0` without a preamble. */
  readonly tableRow: number;
  readonly cells: readonly (readonly PivotSheetCell[])[];
  readonly merges: readonly PivotSheetMerge[];
  /** Header rows of `cells` (frozen and repeated on every printed page, below the preamble). */
  readonly frozenRows: number;
  readonly frozenCols: number;
  readonly rowHeaderColumnCount: number;
  readonly columnCount: number;
  /** Per body row (after the `frozenRows` header rows): outline level and visibility. */
  readonly bodyRows: readonly PivotSheetRow[];
  /**
   * Excel's single per-sheet summary position: `true` (summary rows below their detail) when the
   * sheet has `subtotal: "end"` rows, else `false` (group rows above their children, Excel's pivot default).
   */
  readonly summaryBelow: boolean;
  /** Deepest `bodyRows[].outlineLevel`. */
  readonly outlineLevels: number;
  /** `statement`: writers drop the grey group bands (rules come in `cells[].border`). */
  readonly profile?: "statement";
}

export interface PivotModelToSheetOptions {
  /** Default: `model.layout`. */
  readonly layout?: "tabular" | "compact";
  /**
   * Compact layout: indent labels with this string per depth instead of `PivotSheetCell.indent`
   * (the pre-0.4 behaviour, e.g. `"  "`). Default: no leading spaces, `indent` levels.
   */
  readonly indent?: string;
  /**
   * Tabular layout: how a group's label covers its rows. `repeat` (default) writes it on every row of
   * the group, so Excel's AutoFilter and sort keep each row's context; `first` writes it once, leaving
   * the rows below blank (Excel's pivot default); `merge` merges the cells (prints like the app but
   * breaks filtering and sorting).
   */
  readonly rowLabels?: "repeat" | "first" | "merge";
  /**
   * The same report built with `expanded: "all"` (same spec otherwise). Rows of groups collapsed in
   * `model` are then written as hidden outline rows instead of being left out, so the recipient can
   * expand them in Excel; `model` decides what is collapsed.
   */
  readonly detail?: PivotModel;
  /** `statement`: finance-statement rules (`cells[].border`) and `sheet.profile` (no grey bands). */
  readonly profile?: "report" | "statement";
  /**
   * Write group, subtotal and grand-total cells of additive columns as `SUBTOTAL(9, …)` formulas over
   * their detail rows (the cached value stays in `v`). Needs `spec`: only plain `sum` / `count` measures
   * without `showAs` qualify (others keep values). Default false.
   */
  readonly subtotalFormulas?: boolean;
  /** The spec of `model` (`subtotalFormulas`). */
  readonly spec?: PivotSpec;
  /** Preamble overrides (like the PDF options): a string replaces `model.title` / `subtitle` / `units`, `null` drops it. */
  readonly title?: string | null;
  readonly subtitle?: string | null;
  readonly units?: string | null;
}

/** Deepest Excel outline level. */
const MAX_OUTLINE_LEVEL = 7;

const roleOf = (row: PivotBodyRow): PivotSheetCellRole =>
  row.kind === "grandTotal" ? "grandTotal" : row.kind === "group" || row.kind === "subtotal" || row.kind === "calculated" ? "group" : "leaf";

/** Excel number format of a value cell: the measure's, its percent format, or `0` for ranks. */
function numFmtOf(showAs: string | undefined, numFmt: string, percentNumFmt: string): string {
  const kind = pivotShowAsFormatKind(showAs);
  return kind === "percent" ? percentNumFmt : kind === "rank" ? "0" : numFmt;
}

/** Excel column letters of a 0-based column index (`0` → `A`, `27` → `AB`). */
export function pivotSheetColumnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

const startsWith = (path: readonly string[], prefix: readonly string[]): boolean => prefix.length <= path.length && prefix.every((k, i) => path[i] === k);

/** Is `row` a strict descendant of the group at `prefix` (its subtotal row and header excluded)? */
const isDescendant = (row: PivotBodyRow, prefix: readonly string[]): boolean => row.kind !== "grandTotal" && row.path.length > prefix.length && startsWith(row.path, prefix);

/**
 * Body rows to write: `model.rows`, or with `detail` every row of the expanded report, with groups
 * collapsed in `model` marked hidden. A collapsed group keeps its summary visible: the group row
 * (subtotals at the start; with `subtotal: "none"` the collapsed row of `model`, which carries the
 * totals) or its subtotal row (`subtotal: "end"`, the header row is hidden with the detail).
 */
function bodyRowsOf(model: PivotModel, detail: PivotModel | undefined): { rows: PivotBodyRow[]; hidden: boolean[]; source: PivotModel } {
  if (!detail) return { rows: [...model.rows], hidden: model.rows.map(() => false), source: model };
  const collapsed = model.rows.filter((r) => r.kind === "group" && r.expandable && !r.expanded);
  if (collapsed.length === 0) return { rows: [...model.rows], hidden: model.rows.map(() => false), source: model };
  const viewRow = new Map(collapsed.map((r) => [r.id, r] as const));
  const rows: PivotBodyRow[] = [];
  const hidden: boolean[] = [];
  for (const row of detail.rows) {
    const inside = collapsed.some((c) => isDescendant(row, c.path));
    const view = row.kind === "group" ? viewRow.get(row.id) : undefined;
    if (view && !inside) {
      // The collapsed group's own row: a blank "end" header hides with its detail; a blank "none" header shows the totals.
      if (row.subtotal === "end") {
        rows.push(row);
        hidden.push(true);
      } else {
        rows.push(row.subtotal === "none" ? view : row);
        hidden.push(false);
      }
      continue;
    }
    rows.push(row);
    hidden.push(inside);
  }
  return { rows, hidden, source: detail };
}

export function pivotModelToSheet(model: PivotModel, options: PivotModelToSheetOptions = {}): PivotSheet {
  const layout = options.layout ?? model.layout;
  const legacyIndent = options.indent;
  const rowLabels = options.rowLabels ?? "repeat";
  const statement = options.profile === "statement";
  const dimCols = layout === "tabular" ? model.rowDimensions.length : 1;
  const headerCount = model.headerRows.length;
  const cells: PivotSheetCell[][] = [];
  const merges: PivotSheetMerge[] = [];

  // Preamble: title, subtitle, units and the active filters, then one blank row before the table.
  const pick = (override: string | null | undefined, fallback: string | undefined) => (override === undefined ? fallback : (override ?? undefined));
  const title = pick(options.title, model.title);
  const subtitle = pick(options.subtitle, model.subtitle);
  const units = pick(options.units, model.units);
  const filters = model.filters?.length ? model.filters.map((f) => f.text) : undefined;
  const preamble: PivotSheetLine[] = [];
  if (title) preamble.push({ text: title, role: "title" });
  if (subtitle) preamble.push({ text: subtitle, role: "subtitle" });
  if (units) preamble.push({ text: units, role: "units" });
  if (filters) preamble.push({ text: `Filters: ${filters.join(" · ")}`, role: "filters" });
  const tableRow = preamble.length ? preamble.length + 1 : 0;

  // Header rows: row-dimension labels sit in the last header row (merged upward). Cells covered
  // by a header spanning down from an earlier row (column subtotals) stay empty.
  const covered = model.headerRows.map(() => new Set<number>());
  model.headerRows.forEach((headerRow, r) => {
    const out: PivotSheetCell[] = [];
    const last = r === headerCount - 1;
    if (layout === "tabular") {
      for (const d of model.rowDimensions) out.push({ v: last ? d.label : null, role: "corner", bold: true });
    } else {
      out.push({ v: last ? model.rowDimensions.map((d) => d.label).join(" / ") : null, role: "corner", bold: true });
    }
    const skip = () => {
      while (covered[r]!.has(out.length - dimCols)) out.push({ v: null, role: "header" });
    };
    for (const h of headerRow) {
      skip();
      const rowSpan = h.rowSpan ?? 1;
      if (h.colSpan > 1 || rowSpan > 1) merges.push({ row: r, col: out.length, rowSpan, colSpan: h.colSpan });
      for (let below = 1; below < rowSpan && r + below < headerCount; below++) {
        for (let i = 0; i < h.colSpan; i++) covered[r + below]!.add(out.length - dimCols + i);
      }
      out.push({ v: h.label, role: "header", bold: true });
      for (let i = 1; i < h.colSpan; i++) out.push({ v: null, role: "header" });
    }
    skip();
    cells.push(out);
  });
  if (headerCount > 1) {
    for (let c = 0; c < dimCols; c++) merges.push({ row: 0, col: c, rowSpan: headerCount, colSpan: 1 });
  }

  // Body rows (with `detail`: hidden rows of collapsed groups too).
  const { rows, hidden, source } = bodyRowsOf(model, options.detail);
  const summaryBelow = rows.some((r) => r.kind === "subtotal");
  const bodyRows: PivotSheetRow[] = [];
  // Tabular labels of ancestors (repeated item labels), by key path.
  const groupLabels = new Map<string, string>();
  if (layout === "tabular" && rowLabels === "repeat") for (const r of rows) if (r.kind === "group") groupLabels.set(JSON.stringify(r.path), r.label);
  rows.forEach((row, rowIndex) => {
    const role = roleOf(row);
    const bold = row.kind !== "leaf";
    const out: PivotSheetCell[] = [];
    if (layout === "tabular") {
      for (let i = 0; i < dimCols; i++) {
        const own = row.kind === "grandTotal" ? i === 0 : row.depth === i;
        // Repeated labels: every row of a group names its ancestors (Excel's "Repeat all item labels").
        const ancestor = rowLabels === "repeat" && row.kind !== "grandTotal" && i < row.depth;
        const v = own ? row.label : ancestor ? (groupLabels.get(JSON.stringify(row.path.slice(0, i + 1))) ?? row.path[i]!) : null;
        out.push({ v, role, depth: row.depth, bold });
      }
      if (row.kind === "grandTotal" && dimCols > 1 && rowLabels === "merge") {
        merges.push({ row: headerCount + rowIndex, col: 0, rowSpan: 1, colSpan: dimCols });
      }
    } else if (legacyIndent !== undefined) {
      out.push({ v: legacyIndent.repeat(Math.max(0, row.depth)) + row.label, role, depth: row.depth, bold });
    } else {
      out.push({ v: row.label, role, depth: row.depth, bold, ...(row.depth > 0 ? { indent: row.depth } : {}) });
    }
    const subtotalRule = statement && (row.kind === "subtotal" || row.kind === "calculated");
    const totalRule = statement && row.kind === "grandTotal";
    if (totalRule) for (let i = 0; i < out.length; i++) out[i] = { ...out[i]!, border: { top: "thin", bottom: "double" } };
    row.cells.forEach((cell, i) => {
      const col = model.columns[i]!;
      out.push({
        v: cell.value,
        numFmt: numFmtOf(cell.showAs, row.excelNumFmt ?? col.excelNumFmt, col.excelPercentNumFmt),
        role,
        bold,
        ...(cell.heat !== undefined ? { heat: cell.heat } : {}),
        ...(totalRule ? { border: { top: "thin", bottom: "double" } } : subtotalRule ? { border: { top: "thin" } } : {}),
      });
    });
    cells.push(out);
    const endHeader = row.kind === "group" && row.subtotal === "end";
    bodyRows.push({
      kind: row.kind,
      depth: row.depth,
      outlineLevel: Math.min(MAX_OUTLINE_LEVEL, Math.max(0, row.depth) + (endHeader ? 1 : 0)),
      ...(hidden[rowIndex] ? { hidden: true as const } : {}),
    });
  });
  // The outline button of each hidden block sits on the adjacent summary row (below or above).
  for (let i = 0; i < bodyRows.length; i++) {
    if (!bodyRows[i]!.hidden || (i > 0 && bodyRows[i - 1]!.hidden)) continue;
    let end = i;
    while (end + 1 < bodyRows.length && bodyRows[end + 1]!.hidden) end++;
    const at = summaryBelow ? end + 1 : i - 1;
    if (at >= 0 && at < bodyRows.length && !bodyRows[at]!.hidden) bodyRows[at] = { ...bodyRows[at]!, collapsed: true };
    i = end;
  }

  // Tabular row-dimension merges (only with `rowLabels: "merge"`; a group label covers its rows).
  if (layout === "tabular" && rowLabels === "merge") {
    source.spans.forEach((levelSpans, level) => {
      for (const s of levelSpans) {
        // A group's `subtotal: "end"` row prints its label in the group's column (Excel), outside the merge.
        const last = rows[s.rowIndex + s.span - 1];
        const span = last?.kind === "subtotal" && last.depth === level ? s.span - 1 : s.span;
        if (span > 1) merges.push({ row: headerCount + s.rowIndex, col: level, rowSpan: span, colSpan: 1 });
      }
    });
  }

  if (options.subtotalFormulas && options.spec) addSubtotalFormulas(cells, rows, model, options.spec, headerCount, dimCols, tableRow);

  return {
    ...(title !== undefined ? { title } : {}),
    ...(subtitle !== undefined ? { subtitle } : {}),
    ...(units !== undefined ? { units } : {}),
    ...(filters ? { filters } : {}),
    ...(preamble.length ? { preamble } : {}),
    tableRow,
    cells,
    merges,
    frozenRows: headerCount,
    frozenCols: dimCols,
    rowHeaderColumnCount: dimCols,
    columnCount: dimCols + model.columns.length,
    bodyRows,
    summaryBelow,
    outlineLevels: bodyRows.reduce((m, r) => Math.max(m, r.outlineLevel), 0),
    ...(statement ? { profile: "statement" as const } : {}),
  };
}

/**
 * `SUBTOTAL(9, …)` on group, subtotal and grand-total cells of additive columns (plain `sum` / `count`
 * measures without `showAs`). `SUBTOTAL` skips other `SUBTOTAL` cells in its range, so each range
 * covers every detail row of the group (nested groups included) and still adds each leaf once;
 * function 9 also counts rows hidden by the outline, so collapsed groups keep their totals, while
 * rows hidden by an AutoFilter drop out (Excel's behaviour). Cells without a value stay empty.
 * Calculated item rows keep values, and a range with a calculated item inside keeps values too (a
 * `SUBTOTAL` would add the item into the total; `includeInTotals` items are already in the cached value).
 */
function addSubtotalFormulas(
  cells: PivotSheetCell[][],
  rows: readonly PivotBodyRow[],
  model: PivotModel,
  spec: PivotSpec,
  headerCount: number,
  dimCols: number,
  tableRow: number,
): void {
  const additive = model.columns.map((col) => {
    const m = spec.measures.find((x) => x.id === col.measureId);
    if (!m || m.calculate !== undefined || (m.showAs !== undefined && m.showAs !== "value")) return false;
    const agg = m.aggregate ?? "sum";
    return agg === "sum" || agg === "count";
  });
  if (!additive.some(Boolean)) return;
  const excelRow = (bodyIndex: number) => tableRow + headerCount + bodyIndex + 1;
  rows.forEach((row, i) => {
    let from = -1;
    let to = -1;
    if (row.kind === "grandTotal") {
      const others = rows.map((r, j) => (r.kind === "grandTotal" ? -1 : j)).filter((j) => j >= 0);
      if (others.length) [from, to] = [others[0]!, others[others.length - 1]!];
    } else if (row.kind === "subtotal") {
      // Detail between the group's header row and this subtotal row.
      let j = i - 1;
      while (j >= 0 && !(rows[j]!.kind === "group" && rows[j]!.path.length === row.path.length && startsWith(rows[j]!.path, row.path))) j--;
      if (j >= 0 && j + 1 <= i - 1) [from, to] = [j + 1, i - 1];
    } else if (row.kind === "group") {
      let j = i + 1;
      while (j < rows.length && isDescendant(rows[j]!, row.path)) j++;
      if (j - 1 > i) [from, to] = [i + 1, j - 1];
    }
    if (from < 0) return;
    for (let j = from; j <= to; j++) if (rows[j]!.kind === "calculated") return;
    const out = cells[headerCount + i]!;
    row.cells.forEach((cell, c) => {
      if (!additive[c] || cell.value === null || cell.showAs !== undefined) return;
      const letter = pivotSheetColumnLetter(dimCols + c);
      const k = dimCols + c;
      out[k] = { ...out[k]!, f: `SUBTOTAL(9,${letter}${excelRow(from)}:${letter}${excelRow(to)})` };
    });
  });
}

/**
 * Plain text/number matrix (e.g. for `matrixToTsv` or CSV writers): header and body rows, compact
 * labels indented with two spaces per `indent` level, rows hidden by a collapsed group left out
 * (unless `includeHidden`).
 */
export function pivotSheetToMatrix(sheet: PivotSheet, options: { readonly includeHidden?: boolean } = {}): (string | number | null)[][] {
  const out: (string | number | null)[][] = [];
  sheet.cells.forEach((row, r) => {
    const body = r - sheet.frozenRows;
    if (body >= 0 && !options.includeHidden && sheet.bodyRows?.[body]?.hidden) return;
    out.push(row.map((c) => (c.indent && typeof c.v === "string" ? "  ".repeat(c.indent) + c.v : c.v)));
  });
  return out;
}

export interface BuildPivotSheetOptions extends BuildPivotModelOptions, Omit<PivotModelToSheetOptions, "detail" | "spec"> {
  /** Reuse a builder (its encoding and cubes); default: a new one for this call. */
  readonly builder?: PivotModelBuilder;
}

/**
 * Model and sheet of `spec` the way the exporters write workbooks: when groups are collapsed
 * (`expanded`), the expanded report is built too (the same aggregation: only the view stage runs
 * again), so their rows are written hidden in Excel's outline instead of being left out.
 */
export function buildPivotSheet(
  spec: PivotSpec,
  rows: readonly PivotDataRow[],
  options: BuildPivotSheetOptions = {},
): { readonly model: PivotModel; readonly sheet: PivotSheet } {
  const { builder: given, aggregators, validate, ...sheetOptions } = options;
  const builder = given ?? createPivotModelBuilder({ maxCubes: 1 });
  const buildOptions: BuildPivotModelOptions = { ...(aggregators ? { aggregators } : {}), ...(validate !== undefined ? { validate } : {}) };
  const model = builder.build(spec, rows, buildOptions);
  const collapsed = model.rows.some((r) => r.kind === "group" && r.expandable && !r.expanded);
  const detail = collapsed ? builder.build({ ...spec, expanded: "all" }, rows, { ...buildOptions, validate: false }) : undefined;
  return { model, sheet: pivotModelToSheet(model, { ...sheetOptions, spec, ...(detail ? { detail } : {}) }) };
}
