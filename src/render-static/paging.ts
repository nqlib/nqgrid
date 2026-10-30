import type { PivotHeaderCell, PivotModel } from "../core/pivot/types";
import { pivotTableGeometry } from "../pivot/layout";

/**
 * Pure page math for static (print) output: page boxes in CSS px, and column chunks for pivots
 * wider than a page. Chunks never split a top-level column header (e.g. a month with two measures).
 */

/** CSS px per millimetre (96 dpi). */
export const PX_PER_MM = 96 / 25.4;

/** Portrait page sizes in mm. */
export const PIVOT_PAGE_SIZES_MM = {
  A4: [210, 297],
  A3: [297, 420],
  Letter: [215.9, 279.4],
  Legal: [215.9, 355.6],
  Tabloid: [279.4, 431.8],
} as const;

export type PivotPageSize = keyof typeof PIVOT_PAGE_SIZES_MM;

export interface PivotPageMargins {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface PivotStaticPageOptions {
  /** Default `A4`. */
  readonly size?: PivotPageSize;
  /** Default `landscape`. */
  readonly orientation?: "landscape" | "portrait";
  /** Margins in mm (default top 16, right 10, bottom 14, left 10 — room for a PDF header/footer). */
  readonly margins?: Partial<PivotPageMargins>;
}

export interface PivotStaticPage {
  readonly size: PivotPageSize;
  readonly orientation: "landscape" | "portrait";
  readonly widthMm: number;
  readonly heightMm: number;
  readonly margins: PivotPageMargins;
  /** Content box in CSS px. */
  readonly contentWidthPx: number;
  readonly contentHeightPx: number;
  /** `@page { size; margin }` rule. */
  readonly css: string;
}

export const PIVOT_DEFAULT_PAGE_MARGINS: PivotPageMargins = { top: 16, right: 10, bottom: 14, left: 10 };

const mm = (v: number) => `${Math.round(v * 100) / 100}mm`;

export function resolvePivotStaticPage(options: PivotStaticPageOptions = {}): PivotStaticPage {
  const size = options.size && options.size in PIVOT_PAGE_SIZES_MM ? options.size : "A4";
  const orientation = options.orientation === "portrait" ? "portrait" : "landscape";
  const [w, h] = PIVOT_PAGE_SIZES_MM[size];
  const widthMm = orientation === "landscape" ? h : w;
  const heightMm = orientation === "landscape" ? w : h;
  const margins = { ...PIVOT_DEFAULT_PAGE_MARGINS, ...options.margins };
  return {
    size,
    orientation,
    widthMm,
    heightMm,
    margins,
    contentWidthPx: Math.floor((widthMm - margins.left - margins.right) * PX_PER_MM),
    contentHeightPx: Math.floor((heightMm - margins.top - margins.bottom) * PX_PER_MM),
    css: `@page { size: ${mm(widthMm)} ${mm(heightMm)}; margin: ${mm(margins.top)} ${mm(margins.right)} ${mm(margins.bottom)} ${mm(margins.left)}; }`,
  };
}

// ---------------------------------------------------------------------------
// Column chunks
// ---------------------------------------------------------------------------

export interface PivotColumnUnit {
  /** First value-column index (inclusive). */
  readonly start: number;
  /** Last value-column index (exclusive). */
  readonly end: number;
  readonly label: string;
}

export interface PivotColumnChunk {
  readonly index: number;
  readonly count: number;
  readonly start: number;
  readonly end: number;
  /** Top-level header labels of the first / last unit (e.g. `Nov`, `Apr`). */
  readonly firstLabel: string;
  readonly lastLabel: string;
}

/** Indivisible column groups: one per top-level header cell (one per column when there are no headers). */
export function pivotColumnUnits(model: PivotModel): PivotColumnUnit[] {
  const top = model.headerRows[0];
  if (!top?.length) return model.columns.map((c, i) => ({ start: i, end: i + 1, label: c.measureLabel }));
  const units: PivotColumnUnit[] = [];
  let at = 0;
  for (const h of top) {
    units.push({ start: at, end: at + h.colSpan, label: h.label });
    at += h.colSpan;
  }
  return units;
}

/**
 * Split value columns into page chunks of at most `maxColumns` columns (a wider unit gets a chunk
 * of its own). Chunks are balanced: 12 months at 5 per page → 4 + 4 + 4, not 5 + 5 + 2.
 */
export function pivotColumnChunks(model: PivotModel, maxColumns: number): PivotColumnChunk[] {
  const units = pivotColumnUnits(model);
  const total = model.columns.length;
  const max = Math.max(1, Math.floor(maxColumns));
  if (units.length === 0) return [{ index: 0, count: 1, start: 0, end: 0, firstLabel: "", lastLabel: "" }];
  const target = total <= max ? total : Math.ceil(total / Math.ceil(total / max));
  const groups: PivotColumnUnit[][] = [];
  let current: PivotColumnUnit[] = [];
  let width = 0;
  for (const u of units) {
    const w = u.end - u.start;
    if (current.length && width + w > target) {
      groups.push(current);
      current = [];
      width = 0;
    }
    current.push(u);
    width += w;
  }
  if (current.length) groups.push(current);
  return groups.map((g, index) => ({
    index,
    count: groups.length,
    start: g[0]!.start,
    end: g[g.length - 1]!.end,
    firstLabel: g[0]!.label,
    lastLabel: g[g.length - 1]!.label,
  }));
}

/**
 * The model restricted to value columns `[start, end)`: columns, header rows, row cells, header
 * series points and column keys. Rows, spans and KPIs are unchanged, and `headerSeries.max` stays
 * global so header bars keep one scale across chunks.
 */
export function slicePivotModelColumns(model: PivotModel, start: number, end: number): PivotModel {
  if (start === 0 && end === model.columns.length) return model;
  const columns = model.columns.slice(start, end);
  const ids = new Set(columns.map((c) => c.id));
  const keys = new Set(columns.map((c) => c.columnKey));
  const headerRows = model.headerRows.map((row) => {
    const out: PivotHeaderCell[] = [];
    let at = 0;
    for (const h of row) {
      const a = Math.max(at, start);
      const b = Math.min(at + h.colSpan, end);
      if (b > a) out.push(b - a === h.colSpan ? h : { ...h, colSpan: b - a });
      at += h.colSpan;
    }
    return out;
  });
  const sliceRow = <R extends PivotModel["rows"][number]>(r: R): R => ({ ...r, cells: r.cells.slice(start, end) });
  return {
    ...model,
    columns,
    columnKeys: model.columnKeys.filter((k) => keys.has(k.key)),
    headerRows,
    rows: model.rows.map(sliceRow),
    grandTotal: sliceRow(model.grandTotal),
    headerSeries: model.headerSeries
      ? { ...model.headerSeries, points: model.headerSeries.points.filter((p) => ids.has(p.columnId)) }
      : null,
  };
}

export interface PivotColumnsPerPageOptions {
  /** Available width in CSS px. */
  readonly widthPx: number;
  /** Smallest zoom allowed to fit columns on a page (default 0.7). */
  readonly minScale?: number;
  readonly dimensionWidths?: readonly number[];
  readonly valueWidth?: number;
}

/** Most value columns that fit `widthPx` at `minScale`, with the dimension columns repeated (at least 1). */
export function pivotColumnsPerPage(model: PivotModel, options: PivotColumnsPerPageOptions): number {
  const g = pivotTableGeometry({ ...model, columns: [] }, options);
  const scale = Math.min(1, Math.max(0.1, options.minScale ?? 0.7));
  return Math.max(1, Math.floor((options.widthPx / scale - g.width) / g.valueWidth));
}
