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

/** A header cell with its value-column range (row spans from earlier rows accounted for). */
export interface PivotPlacedHeaderCell {
  readonly cell: PivotHeaderCell;
  readonly row: number;
  readonly start: number;
  readonly end: number;
}

/** Every header cell with its column range, row by row (cells spanning down cover later rows). */
export function pivotHeaderCellPositions(model: PivotModel): PivotPlacedHeaderCell[][] {
  const covered = model.headerRows.map(() => new Set<number>());
  return model.headerRows.map((row, r) => {
    const out: PivotPlacedHeaderCell[] = [];
    let at = 0;
    for (const cell of row) {
      while (covered[r]!.has(at)) at++;
      out.push({ cell, row: r, start: at, end: at + cell.colSpan });
      for (let below = 1; below < (cell.rowSpan ?? 1) && r + below < covered.length; below++) {
        for (let i = at; i < at + cell.colSpan; i++) covered[r + below]!.add(i);
      }
      at += cell.colSpan;
    }
    return out;
  });
}

/**
 * Indivisible column groups: one per top-level header cell (one per column when there are no
 * headers). With `maxColumns`, a group wider than that is split along the next header row (e.g. a
 * fiscal year into its quarters, its subtotal staying one unit), recursively, so chunks keep groups
 * whole where they fit and only split them where they cannot. Labels of split units carry the outer
 * labels (`FY26 Q1`).
 */
export function pivotColumnUnits(model: PivotModel, maxColumns = Infinity): PivotColumnUnit[] {
  const top = model.headerRows[0];
  if (!top?.length) return model.columns.map((c, i) => ({ start: i, end: i + 1, label: c.measureLabel }));
  const placed = pivotHeaderCellPositions(model);
  const units: PivotColumnUnit[] = [];
  const add = (p: PivotPlacedHeaderCell, label: string) => {
    const next = p.row + (p.cell.rowSpan ?? 1);
    if (p.end - p.start > maxColumns && next < placed.length) {
      const inner = placed[next]!.filter((q) => q.start >= p.start && q.end <= p.end);
      if (inner.length > 1) {
        for (const q of inner) add(q, `${label} ${q.cell.label}`);
        return;
      }
    }
    units.push({ start: p.start, end: p.end, label });
  };
  for (const p of placed[0]!) add(p, p.cell.label);
  return units;
}

/**
 * Split value columns into page chunks of at most `maxColumns` columns (a wider unit gets a chunk
 * of its own). Chunks are balanced: 12 months at 5 per page → 4 + 4 + 4, not 5 + 5 + 2.
 */
export function pivotColumnChunks(model: PivotModel, maxColumns: number): PivotColumnChunk[] {
  const total = model.columns.length;
  const max = Math.max(1, Math.floor(maxColumns));
  const units = pivotColumnUnits(model, max);
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
  const headerRows = pivotHeaderCellPositions(model).map((row) => {
    const out: PivotHeaderCell[] = [];
    for (const { cell: h, start: at } of row) {
      const a = Math.max(at, start);
      const b = Math.min(at + h.colSpan, end);
      if (b > a) out.push(b - a === h.colSpan ? h : { ...h, colSpan: b - a });
    }
    return out;
  });
  const sliceRow = <R extends PivotModel["rows"][number]>(r: R): R => ({ ...r, cells: r.cells.slice(start, end) });
  const outer = new Set(columns.flatMap((c) => (c.columnPath?.length ? [c.columnPath[0]!] : [])));
  const series = model.headerSeries;
  return {
    ...model,
    columns,
    columnKeys: model.columnKeys.filter((k) => keys.has(k.key)),
    headerRows,
    rows: model.rows.map(sliceRow),
    grandTotal: sliceRow(model.grandTotal),
    headerSeries: series
      ? {
          ...series,
          points: series.points.filter((p) => ids.has(p.columnId)),
          ...(series.groups ? { groups: series.groups.filter((g) => outer.has(decodeURIComponent(g.columnKey))) } : {}),
        }
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
