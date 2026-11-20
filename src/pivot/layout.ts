import { formatPivotNumber } from "../core/pivot/format";
import { pivotCellDesigns, type PivotBarSpec, type PivotCellDesigns, type PivotCellTone, type PivotFormatRule } from "./design";
import type {
  PivotBodyRow,
  PivotHeaderCell,
  PivotHeaderSeriesPoint,
  PivotHeatSpec,
  PivotKpiValue,
  PivotModel,
  PivotRowSpan,
} from "../core/pivot/types";

/**
 * Pure render math shared by the interactive grid and static (PDF) output. No React here, so it
 * is unit-tested directly and reused by `@nqlib/nqgrid/render-static` later.
 */

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

export interface PivotTableGeometry {
  /** Row-dimension columns actually rendered (tabular: one per level; compact: one). */
  readonly dimensionColumns: number;
  /** Width of each dimension column in px. */
  readonly dimensionWidths: readonly number[];
  /** Sticky `left` of each dimension column in px. */
  readonly dimensionOffsets: readonly number[];
  /** Value column width in px when `valueWidths` has no entry for the column. */
  readonly valueWidth: number;
  /** Total table width in px (fixed layout). */
  readonly width: number;
  /**
   * Resolved width of each value column in px, in `model.columns` order (`valueWidths[column.id]`,
   * else `valueWidth`). Always set by `pivotTableGeometry`.
   */
  readonly valueWidths?: readonly number[];
  /** Every column left to right in px: the dimension columns, then the value columns. Always set by `pivotTableGeometry`. */
  readonly columnWidths?: readonly number[];
  /**
   * Header rows to freeze, e.g. an XLSX `ySplit` under any title rows: `model.headerRows.length`, or
   * 0 with `freezeHeader: false`. The header chart band is not counted. Always set by `pivotTableGeometry`.
   */
  readonly frozenRows?: number;
  /** Row-label columns to freeze (XLSX `xSplit`): `dimensionColumns`, or 0 with `freezeDimensions: false`. Always set by `pivotTableGeometry`. */
  readonly frozenColumns?: number;
  /**
   * Heat level, bar, number format and tone of every body cell (`[rowIndex][columnIndex]`, see
   * `pivotCellDesigns`); present when `heat`, `bars`, `numberFormats` or `cellTone` is passed.
   */
  readonly cells?: PivotCellDesigns;
}

export interface PivotTableGeometryOptions {
  readonly dimensionWidths?: readonly number[];
  readonly valueWidth?: number;
  /** Width per value column, by `PivotValueColumn.id` (falls back to `measureWidths`, then `valueWidth`). */
  readonly valueWidths?: Readonly<Record<string, number>>;
  /** Width for every column of a measure, by measure id (falls back to `valueWidth`). */
  readonly measureWidths?: Readonly<Record<string, number>>;
  /** Default true. */
  readonly freezeHeader?: boolean;
  /** Default true. */
  readonly freezeDimensions?: boolean;
  /** As `PivotTable` `heat`: fills `cells` (pass `undefined` with `bars` for the model's own heat). */
  readonly heat?: PivotHeatSpec | readonly PivotHeatSpec[];
  /** As `PivotTable` `bars`: fills `cells`. */
  readonly bars?: readonly PivotBarSpec[];
  /** As `PivotTable` `numberFormats`: fills `cells[r][c].numberFormat` (format, Excel format, text). */
  readonly numberFormats?: readonly PivotFormatRule[];
  /**
   * As `PivotTable` `cellTone`: a toned cell reports `tone` and no `heat` (`cells[r][c]`). Without
   * `heat`, the other cells report the model's own heat, as `PivotTable` draws them.
   */
  readonly cellTone?: PivotCellTone;
}

export const PIVOT_DEFAULT_DIMENSION_WIDTHS = [208, 172] as const;
export const PIVOT_DEFAULT_COMPACT_WIDTH = 260;
export const PIVOT_DEFAULT_VALUE_WIDTH = 84;

/**
 * Column widths, sticky offsets and frozen counts of a `PivotTable`, plus (with `heat` / `bars`) the
 * level of each cell, so an exporter can write the same design (e.g. XLSX column widths, freeze
 * panes and fills). Pass the model `PivotTable` renders (after `pivotOrderMeasures` when you use
 * `measureOrder`).
 */
export function pivotTableGeometry(model: PivotModel, options: PivotTableGeometryOptions = {}): PivotTableGeometry {
  const dimensionColumns = model.layout === "compact" ? 1 : model.rowDimensions.length;
  const defaults = model.layout === "compact" ? [PIVOT_DEFAULT_COMPACT_WIDTH] : PIVOT_DEFAULT_DIMENSION_WIDTHS;
  const dimensionWidths = Array.from(
    { length: dimensionColumns },
    (_, i) => options.dimensionWidths?.[i] ?? defaults[i] ?? defaults[defaults.length - 1]!,
  );
  const dimensionOffsets = dimensionWidths.map((_, i) => dimensionWidths.slice(0, i).reduce((a, b) => a + b, 0));
  const valueWidth = options.valueWidth ?? PIVOT_DEFAULT_VALUE_WIDTH;
  const byKey = options.valueWidths;
  const byMeasure = options.measureWidths;
  const valueWidths = model.columns.map((c) => byKey?.[c.id] ?? byMeasure?.[c.measureId] ?? valueWidth);
  // Uniform widths: a product, exactly as 0.4.0 computed it (a float sum can differ in the last digit).
  const uniform = valueWidths.every((w) => w === valueWidth);
  const width = dimensionWidths.reduce((a, b) => a + b, 0) + (uniform ? valueWidth * model.columns.length : valueWidths.reduce((a, b) => a + b, 0));
  return {
    dimensionColumns,
    dimensionWidths,
    dimensionOffsets,
    valueWidth,
    width,
    valueWidths,
    columnWidths: [...dimensionWidths, ...valueWidths],
    frozenRows: options.freezeHeader === false ? 0 : model.headerRows.length,
    frozenColumns: options.freezeDimensions === false ? 0 : dimensionColumns,
    ...(options.heat !== undefined || options.bars !== undefined || options.numberFormats !== undefined || options.cellTone !== undefined
      ? { cells: pivotCellDesigns(model, { heat: options.heat, bars: options.bars, numberFormats: options.numberFormats, cellTone: options.cellTone }) }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Column headers
// ---------------------------------------------------------------------------

/** What a value-column header cell names (see `pivotColumnHeaderRole`). */
export interface PivotColumnHeaderRole {
  /**
   * `dimension` — a key of column field `level` (a group over its children, a leaf, or a collapsed
   * group); `subtotal` — a column group's subtotal; `measure` — a value measure (the Σ Values level);
   * `total` — the grand total column(s).
   */
  readonly kind: "dimension" | "subtotal" | "measure" | "total";
  /** Column-field index for `dimension` / `subtotal`, else `null`. */
  readonly level: number | null;
  /**
   * Position of this level among the field list's Columns chips (Σ Values included), i.e. the
   * `PivotFieldMove.index` before it: use it as `pivotDropZoneProps("columns", { axis: "x", offset })`.
   */
  readonly areaIndex: number;
}

/** The column fields of a model, outermost first (`columnDimensions`, else `[columnDimension]`). */
export function pivotModelColumnDimensions(model: PivotModel): readonly { readonly field: string; readonly label: string }[] {
  return model.columnDimensions ?? (model.columnDimension ? [model.columnDimension] : []);
}

/** Role of header cell `cell` in header row `row` (for render slots, drag handles and drop zones). */
export function pivotColumnHeaderRole(model: PivotModel, row: number, cell: PivotHeaderCell): PivotColumnHeaderRole {
  const levels = pivotModelColumnDimensions(model).length;
  const multi = new Set(model.columns.map((c) => c.measureId)).size > 1;
  if (levels > 1) {
    // Σ Values position: where the measure sits in a leaf column's header path (innermost by default).
    const leaf = model.columns.find((c) => c.columnPath?.length === levels && !c.subtotal);
    const sigma = !multi ? -1 : leaf ? leaf.headerPath.indexOf(leaf.measureLabel) : levels;
    const at = (level: number) => level + (sigma >= 0 && sigma <= level ? 1 : 0);
    if (cell.columnLevel !== undefined) return { kind: cell.subtotal ? "subtotal" : "dimension", level: cell.columnLevel, areaIndex: at(cell.columnLevel) };
    if (cell.columnKey === null && (!multi || cell.measureId === undefined)) return { kind: "total", level: null, areaIndex: levels + (multi ? 1 : 0) };
    return { kind: "measure", level: null, areaIndex: Math.max(0, sigma) };
  }
  if (levels === 0) return { kind: "measure", level: null, areaIndex: row };
  if (cell.columnKey === null) return { kind: multi && row > 0 ? "measure" : "total", level: null, areaIndex: row };
  // One column field: with several measures the Σ row is first when its cells carry no column key.
  const sigmaRow = !multi ? -1 : (model.headerRows[0] ?? []).every((h) => h.columnKey !== undefined) ? 1 : 0;
  return row === sigmaRow ? { kind: "measure", level: null, areaIndex: row } : { kind: "dimension", level: 0, areaIndex: row };
}

// ---------------------------------------------------------------------------
// Row-dimension cells (tabular layout)
// ---------------------------------------------------------------------------

/**
 * What to draw in dimension column `level` of a body row:
 * - `span` — the group's own cell, covering `rowSpan` rows (department + KPI panel);
 * - `group` — the group summary next to its span (label, child count, toggle);
 * - `leaf` — a leaf label;
 * - `subtotal` — the label of a group's `subtotal: "end"` row ("Camp Total"), next to the group's span;
 * - `calculated` — the label of a calculated item, in the column of its own level;
 * - `grandTotal` — the grand-total label, covering every dimension column;
 * - `empty` — nothing to show;
 * - `covered` — inside an earlier `span` cell; render no `<td>`.
 */
export type PivotDimensionSlot =
  | { readonly type: "span"; readonly level: number; readonly rowSpan: number }
  | { readonly type: "group"; readonly level: number }
  | { readonly type: "leaf"; readonly level: number }
  | { readonly type: "subtotal"; readonly level: number }
  | { readonly type: "calculated"; readonly level: number }
  | { readonly type: "grandTotal"; readonly colSpan: number }
  | { readonly type: "empty"; readonly level: number }
  | { readonly type: "covered"; readonly level: number };

/** Per-row dimension slots for a tabular model, from `model.spans` (row spans are never recomputed). */
export function pivotDimensionSlots(model: PivotModel): PivotDimensionSlot[][] {
  const levels = model.rowDimensions.length;
  const leafDepth = levels - 1;
  const starts = model.spans.map((spans) => new Map(spans.map((s) => [s.rowIndex, s] as const)));
  const coveredUntil = model.spans.map(() => -1);

  return model.rows.map((row, rowIndex) => {
    if (row.kind === "grandTotal") return [{ type: "grandTotal", colSpan: levels }];
    const slots: PivotDimensionSlot[] = [];
    for (let level = 0; level < levels; level++) {
      const start: PivotRowSpan | undefined = starts[level]!.get(rowIndex);
      if (start && level < leafDepth && row.kind === "group" && row.depth === level) {
        coveredUntil[level] = rowIndex + start.span - 1;
        slots.push({ type: "span", level, rowSpan: start.span });
      } else if (rowIndex <= coveredUntil[level]!) {
        slots.push({ type: "covered", level });
      } else if (row.kind === "leaf" && level === leafDepth) {
        slots.push({ type: "leaf", level });
      } else if (row.kind === "group" && level === row.depth + 1) {
        slots.push({ type: "group", level });
      } else if (row.kind === "subtotal" && level === row.depth + 1) {
        slots.push({ type: "subtotal", level });
      } else if (row.kind === "calculated" && level === row.depth) {
        slots.push({ type: "calculated", level });
      } else {
        slots.push({ type: "empty", level });
      }
    }
    return slots;
  });
}

// ---------------------------------------------------------------------------
// Heat
// ---------------------------------------------------------------------------

/** CSS palette steps (`--nqg-heat-0 … --nqg-heat-8`). */
export const PIVOT_HEAT_STEPS = 9;

/** Map a model heat level (`0 … levels-1`) to a palette step (`0 … 8`). */
export function pivotHeatStep(level: number, levels: number): number {
  if (levels <= 1) return 0;
  return Math.round((Math.min(levels - 1, Math.max(0, level)) * (PIVOT_HEAT_STEPS - 1)) / (levels - 1));
}

// ---------------------------------------------------------------------------
// Header chart band
// ---------------------------------------------------------------------------

export interface PivotBarSegment {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** Index in the breakdown (stable series slot → color). */
  readonly seriesIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Top-most segment: gets the rounded data end. */
  readonly top: boolean;
}

export interface PivotBarGeometryOptions {
  /** SVG width in px. */
  readonly width: number;
  /** SVG height in px (bar of `max` fills it). */
  readonly height: number;
  /** Bar width as a fraction of `width` (default 0.56), capped at `maxBarWidth`. */
  readonly barFraction?: number;
  readonly maxBarWidth?: number;
  /** Surface gap between stacked segments in px (default 1). */
  readonly gap?: number;
}

/**
 * Stacked (or single) bar for one header-series point, anchored to the baseline.
 * Non-positive and null values draw nothing; segments shorter than the gap are dropped.
 */
export function pivotBarSegments(
  point: PivotHeaderSeriesPoint,
  max: number | null,
  options: PivotBarGeometryOptions,
): PivotBarSegment[] {
  if (max === null || !(max > 0)) return [];
  const gap = options.gap ?? 1;
  const barWidth = Math.min(options.maxBarWidth ?? 36, Math.round(options.width * (options.barFraction ?? 0.56)));
  const x = Math.round((options.width - barWidth) / 2);
  const parts = point.breakdown
    ? point.breakdown.map((b, i) => ({ key: b.key, label: b.label, value: b.value ?? 0, seriesIndex: i }))
    : [{ key: point.columnKey, label: point.label, value: point.value ?? 0, seriesIndex: 0 }];
  const scale = options.height / max;
  const segments: PivotBarSegment[] = [];
  let baseline = options.height;
  for (const p of parts) {
    if (!(p.value > 0)) continue;
    const full = p.value * scale;
    const height = segments.length === 0 ? full : full - gap;
    if (height <= 0) {
      baseline -= full;
      continue;
    }
    // The gap sits at the bottom of each upper segment, so the stack keeps its total height.
    segments.push({ ...p, x, y: baseline - full, width: barWidth, height, top: false });
    baseline -= full;
  }
  if (segments.length) segments[segments.length - 1] = { ...segments[segments.length - 1]!, top: true };
  return segments;
}

/** SVG path for a bar with rounded top corners (square at the baseline). */
export function pivotBarPath(s: Pick<PivotBarSegment, "x" | "y" | "width" | "height">, radius: number): string {
  const r = Math.max(0, Math.min(radius, s.width / 2, s.height));
  const { x, y, width: w, height: h } = s;
  const n = (v: number) => Math.round(v * 100) / 100;
  if (r === 0) return `M${n(x)},${n(y + h)}V${n(y)}H${n(x + w)}V${n(y + h)}Z`;
  return (
    `M${n(x)},${n(y + h)}V${n(y + r)}Q${n(x)},${n(y)} ${n(x + r)},${n(y)}` +
    `H${n(x + w - r)}Q${n(x + w)},${n(y)} ${n(x + w)},${n(y + r)}V${n(y + h)}Z`
  );
}

/** Series legend for stacked header bars (top-level groups, fixed order). */
export function pivotHeaderLegend(model: PivotModel): { readonly key: string; readonly label: string; readonly seriesIndex: number }[] {
  const first = model.headerSeries?.points.find((p) => p.breakdown?.length);
  return first?.breakdown?.map((b, seriesIndex) => ({ key: b.key, label: b.label, seriesIndex })) ?? [];
}

/** Value label for a header point, in the format of its value column. */
export function pivotHeaderPointText(model: PivotModel, point: PivotHeaderSeriesPoint): string {
  const column = model.columns.find((c) => c.id === point.columnId);
  return formatPivotNumber(point.value, column?.format ?? {});
}

export interface PivotHeaderSummaryData {
  /** Header-series measure label (e.g. `Actual`). */
  readonly label: string;
  /** Sum of the header-series points, formatted like the measure (e.g. `$66.0M`). */
  readonly total: number | null;
  readonly totalText: string;
  /** Grand-level headline KPI (first entry of `model.kpis`), e.g. growth. */
  readonly headline?: PivotKpiValue;
}

/** Top-left band summary: header-series total plus the grand headline KPI. */
export function pivotHeaderSummary(model: PivotModel): PivotHeaderSummaryData | null {
  const series = model.headerSeries;
  if (!series) return null;
  const column = model.columns.find((c) => c.measureId === series.measureId);
  const values = series.points.map((p) => p.value).filter((v): v is number => v !== null);
  const total = values.length ? values.reduce((a, b) => a + b, 0) : null;
  return {
    label: column?.measureLabel ?? series.measureId,
    total,
    totalText: formatPivotNumber(total, column?.format ?? {}),
    ...(model.kpis[0] ? { headline: model.kpis[0] } : {}),
  };
}

// ---------------------------------------------------------------------------
// KPI panel
// ---------------------------------------------------------------------------

export interface PivotKpiPanelParts {
  /** Shown large (e.g. "Growth on FY25 -2%"). */
  readonly headline: PivotKpiValue | null;
  /** Label / value rows (e.g. Forecast, Outlook, Plan). */
  readonly values: readonly PivotKpiValue[];
  /** "vs Plan -1.3%" rows for KPIs with a `compareTo`. */
  readonly deltas: readonly { readonly id: string; readonly label: string; readonly delta: number | null; readonly text: string }[];
}

/** Split KPIs into headline / values / deltas. `headlineId` defaults to the first KPI. */
export function pivotKpiPanelParts(kpis: readonly PivotKpiValue[], headlineId?: string): PivotKpiPanelParts {
  const headline = (headlineId ? kpis.find((k) => k.id === headlineId) : kpis[0]) ?? null;
  return {
    headline,
    values: kpis.filter((k) => k !== headline),
    deltas: kpis
      .filter((k) => k.deltaText !== undefined)
      .map((k) => ({
        id: k.id,
        label: `vs ${k.compareLabel ?? "target"}`,
        delta: k.delta ?? null,
        text: k.deltaText!,
      })),
  };
}

/** Sign of a value for delta coloring (`0` for null / zero). */
export function pivotSign(value: number | null | undefined): -1 | 0 | 1 {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return 0;
  return value > 0 ? 1 : -1;
}

/** Up to two initials for an owner avatar. */
export function pivotInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** First string attribute of a row (e.g. `owner`), used as the KPI panel caption. */
export function pivotRowCaption(row: PivotBodyRow, attribute?: string): string | null {
  const attrs = row.attributes;
  if (!attrs) return null;
  const value = attribute !== undefined ? attrs[attribute] : Object.values(attrs).find((v) => v !== null && v !== undefined);
  return value === null || value === undefined || value === "" ? null : String(value);
}

/**
 * Box metrics of `PivotKpiPanel` in px (default tokens and the `render-static` stylesheet use the
 * same type scale): used to estimate the panel height without measuring the DOM.
 */
export const PIVOT_KPI_PANEL_METRICS = {
  /** Span cell vertical padding (top + bottom) plus its bottom rule. */
  cellPaddingY: 17,
  /** Gap between panel blocks. */
  gap: 8,
  title: 20,
  headlineLabel: 16,
  headline: 28,
  listRow: 16,
  listRowGap: 2,
  /** Rule + top padding + avatar. */
  caption: 27,
} as const;

export interface PivotKpiPanelHeightOptions {
  readonly headlineId?: string;
  /** Panel shows a title row (default true). */
  readonly title?: boolean;
  /** Panel shows a caption (owner) row (default false). */
  readonly caption?: boolean;
}

/** Estimated height in px of a span cell hosting `PivotKpiPanel` (including the cell padding). */
export function pivotKpiPanelHeight(kpis: readonly PivotKpiValue[], options: PivotKpiPanelHeightOptions = {}): number {
  const m = PIVOT_KPI_PANEL_METRICS;
  const { headline, values, deltas } = pivotKpiPanelParts(kpis, options.headlineId);
  const blocks: number[] = [];
  if (options.title ?? true) blocks.push(m.title);
  if (headline) blocks.push(m.headlineLabel + m.headline);
  const listRows = values.length + deltas.length;
  if (listRows) blocks.push(listRows * m.listRow + (listRows - 1) * m.listRowGap);
  if (options.caption) blocks.push(m.caption);
  const content = blocks.reduce((a, b) => a + b, 0) + Math.max(0, blocks.length - 1) * m.gap;
  return m.cellPaddingY + content;
}

// ---------------------------------------------------------------------------
// Row virtualization
// ---------------------------------------------------------------------------

/**
 * Body rows to render for a virtualized grid: the rows overlapping the viewport, `offset` px below
 * the top of the first body row and `height` px tall, plus `overscan` rows on each side, widened to
 * multiples of `chunk` rows so that small scrolls keep the same window (no re-render).
 * `rowTop(i)` is the top of row `i` in px (non-decreasing; `rowTop(rowCount)` is the body height).
 */
export function pivotVirtualRowWindow(
  rowCount: number,
  rowTop: (index: number) => number,
  offset: number,
  height: number,
  overscan: number,
  chunk = 8,
): { readonly start: number; readonly end: number } {
  if (rowCount <= 0) return { start: 0, end: 0 };
  /** First row whose top is greater than `y`. */
  const after = (y: number): number => {
    let lo = 0;
    let hi = rowCount;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (rowTop(mid) <= y) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const first = Math.max(0, after(offset) - 1);
  const last = Math.max(first + 1, after(offset + height));
  const step = Math.max(1, Math.floor(chunk));
  const start = Math.max(0, Math.floor((first - overscan) / step) * step);
  const end = Math.min(rowCount, Math.ceil((last + overscan) / step) * step);
  return { start, end: Math.max(end, Math.min(rowCount, start + 1)) };
}

// ---------------------------------------------------------------------------
// Body groups (static / print output)
// ---------------------------------------------------------------------------

export interface PivotBodyGroup {
  /** Stable key: the top-level group's row id (or the grand-total row id). */
  readonly id: string;
  /** First row index (inclusive) in `model.rows`. */
  readonly start: number;
  /** Last row index (exclusive). */
  readonly end: number;
  readonly kind: PivotBodyRow["kind"];
}

/**
 * Consecutive `model.rows` ranges per top-level group (plus one per grand total or top-level leaf),
 * so static output can wrap each in its own `<tbody>` with `break-inside: avoid`.
 */
export function pivotBodyGroups(model: PivotModel): PivotBodyGroup[] {
  const groups: PivotBodyGroup[] = [];
  model.rows.forEach((row, i) => {
    // A group's `subtotal: "end"` row closes its group instead of starting one.
    const startsGroup =
      row.kind === "grandTotal" || (row.depth <= 0 && row.kind !== "subtotal") || groups.length === 0 || groups[groups.length - 1]!.kind === "grandTotal";
    if (startsGroup) {
      groups.push({ id: row.id, start: i, end: i + 1, kind: row.kind });
    } else {
      const last = groups[groups.length - 1]!;
      groups[groups.length - 1] = { ...last, end: i + 1 };
    }
  });
  return groups;
}

/** A printed slice of a body group: one `<tbody>` of static output, starting a new page when `breakBefore`. */
export interface PivotBodySegment extends PivotBodyGroup {
  /** Starts a new page (`break-before: page`). */
  readonly breakBefore?: true;
  /** Continues a group split across pages: the renderer repeats the group label ("Opex (cont.)"). */
  readonly continued?: true;
}

export interface PivotPageSegmentsOptions {
  /** Table height available per page, in table px (page content height / zoom, less a safety margin). */
  readonly pageHeight: number;
  /** Space used above the table on its first page (report header, chunk caption), in table px. */
  readonly firstPageOffset?: number;
  /** Header rows repeated on every page (`<thead>`), in px. */
  readonly headHeight: number;
  readonly rowHeight: number;
  /** Extra height after a row (e.g. a KPI-panel filler row), in px. */
  readonly extraHeight?: (rowIndex: number) => number;
  /** Height of the repeated group label rows when a continued segment starts at `rowIndex` (default 0). */
  readonly continuationHeight?: (rowIndex: number) => number;
  /** Fewest rows worth starting a split group with at the bottom of a page (default 3). */
  readonly minRows?: number;
}

/**
 * Print pagination of the body groups (pure, from fixed row heights): a group that fits the rest of
 * the page stays there; one that fits a fresh page starts one; a group taller than a page is split
 * across pages (filling the current page first, so a long first section never leaves page 1 empty),
 * with `continued` segments for the repeated label and at least two rows (e.g. the last line and its
 * subtotal) carried onto the last page. The renderer marks `breakBefore` with `break-before: page`.
 */
export function pivotPageBodySegments(model: PivotModel, options: PivotPageSegmentsOptions): PivotBodySegment[] {
  const { pageHeight, headHeight, rowHeight } = options;
  const minRows = Math.max(1, options.minRows ?? 3);
  const heightOf = (i: number) => rowHeight + (options.extraHeight?.(i) ?? 0);
  const contHeight = (i: number) => options.continuationHeight?.(i) ?? 0;
  const out: PivotBodySegment[] = [];
  let used = (options.firstPageOffset ?? 0) + headHeight;
  let empty = true;
  let breakNext = false;
  const newPage = () => {
    used = headHeight;
    empty = true;
    breakNext = true;
  };
  const push = (g: PivotBodyGroup, start: number, end: number, height: number, continued: boolean) => {
    out.push({ id: start === g.start ? g.id : `${g.id}@${start}`, start, end, kind: g.kind, ...(breakNext ? { breakBefore: true as const } : {}), ...(continued ? { continued: true as const } : {}) });
    used += height;
    empty = false;
    breakNext = false;
  };
  for (const g of pivotBodyGroups(model)) {
    let h = 0;
    for (let i = g.start; i < g.end; i++) h += heightOf(i);
    if (used + h <= pageHeight) {
      push(g, g.start, g.end, h, false);
      continue;
    }
    if (!empty && headHeight + h <= pageHeight) {
      newPage();
      push(g, g.start, g.end, h, false);
      continue;
    }
    // Taller than the rest of this page and than a fresh page (or nothing is on this page yet): split.
    if (!empty && pageHeight - used < minRows * rowHeight) newPage();
    let i = g.start;
    let continued = false;
    while (i < g.end) {
      const extra = continued ? contHeight(i) : 0;
      const room = pageHeight - used - extra;
      let j = i;
      let acc = 0;
      while (j < g.end && acc + heightOf(j) <= room) acc += heightOf(j++);
      if (j === i) acc = heightOf(j++);
      // Never leave a single row (a subtotal) alone on the next page.
      if (j < g.end && g.end - j < 2 && j - i > 2) {
        j -= 2 - (g.end - j);
        acc = 0;
        for (let k = i; k < j; k++) acc += heightOf(k);
      }
      push(g, i, j, acc + extra, continued);
      i = j;
      if (i < g.end) {
        newPage();
        continued = true;
      }
    }
  }
  return out;
}
