import { pivotScaledHeatLevel, type PivotHeatDomain } from "../core/pivot/heat";
import type { PivotBodyRow, PivotHeatScale, PivotHeatSpec, PivotModel } from "../core/pivot/types";
import type { PivotCellContext, PivotColumnHeaderContext } from "./pivot-table";

/**
 * Design options of `PivotTable` (0.5.0): data bars, per-measure layout, resize / reorder callbacks
 * and the heat / bar level of each cell. Pure functions, no React, so `pivotTableGeometry` can give
 * an exporter (XLSX) the same levels the grid draws.
 */

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** Narrowest column a resize handle sets, in px. */
export const PIVOT_COLUMN_WIDTH_MIN = 48;
/** Widest column a resize handle sets, in px. */
export const PIVOT_COLUMN_WIDTH_MAX = 800;
/** Lowest body row height the row handle sets, in px. */
export const PIVOT_ROW_HEIGHT_MIN = 20;
/** Highest body row height the row handle sets, in px. */
export const PIVOT_ROW_HEIGHT_MAX = 96;

// ---------------------------------------------------------------------------
// Spec types
// ---------------------------------------------------------------------------

/** A data bar drawn behind the numbers of one measure (`PivotTable` `bars`). */
export interface PivotBarSpec {
  /** Measure id. */
  readonly measure: string;
  /** Which rows get bars (default `leaf`). The grand total never does. */
  readonly applyTo?: "leaf" | "group" | "all";
  /** Fixed `[min, max]` instead of the data range (which always includes 0). */
  readonly domain?: readonly [number, number];
  /** Negative values: a bar to the left of the zero line (default `left`), or none (`hide`). */
  readonly negative?: "left" | "hide";
}

/** Per-measure cell layout (`PivotTable` `measureLayout`). */
export interface PivotMeasureLayout {
  /** Text alignment of the value cells and their leaf headers (default: the grid's, `end`). */
  readonly align?: "start" | "end" | "center";
  /** `wrap`: long text wraps; `clip`: one line, cut at the cell edge (default: one line). */
  readonly wrap?: "wrap" | "clip";
}

/** How a size change came about (third argument of the resize callbacks). */
export interface PivotResizeInfo {
  /** `pointer` (drag), `keyboard` (arrow keys on the handle) or `autofit` (double-click). */
  readonly source: "pointer" | "keyboard" | "autofit";
  /**
   * `false` while a drag is in progress (one call per animation frame), `true` for the last value
   * of a gesture. Persist the design on `final` calls; an Escape during a drag sends the original
   * size with `final: true`.
   */
  readonly final: boolean;
}

/** `onValueWidthChange(key, width, info)`: `key` is the value column's `PivotValueColumn.id`. */
export type PivotValueWidthChangeHandler = (key: string, width: number, info: PivotResizeInfo) => void;
/** `onDimensionWidthChange(index, width, info)`: `index` into `dimensionWidths`. */
export type PivotDimensionWidthChangeHandler = (index: number, width: number, info: PivotResizeInfo) => void;
/** `onRowHeightChange(height, info)`: the new `rowHeight`. */
export type PivotRowHeightChangeHandler = (height: number, info: PivotResizeInfo) => void;
/** `onMeasureOrderChange(order)`: every value measure id, in the new order (the next `measureOrder`). */
export type PivotMeasureOrderChangeHandler = (order: readonly string[]) => void;

/** Second argument of `rowClassName`. */
export interface PivotRowClassContext {
  /** `leaf` (leaf and calculated rows), `subtotal` (group and subtotal rows) or `total` (grand total). */
  readonly kind: "leaf" | "subtotal" | "total";
  /** Index in `model.rows`. */
  readonly index: number;
}

export type PivotCellClassName = (context: PivotCellContext) => string | undefined;
export type PivotRowClassName = (row: PivotBodyRow, context: PivotRowClassContext) => string | undefined;
export type PivotHeaderClassName = (context: PivotColumnHeaderContext) => string | undefined;

/** The coarse row kind of `rowClassName` and `data-nq-row-kind`. */
export function pivotRowDesignKind(row: Pick<PivotBodyRow, "kind">): PivotRowClassContext["kind"] {
  return row.kind === "grandTotal" ? "total" : row.kind === "group" || row.kind === "subtotal" ? "subtotal" : "leaf";
}

// ---------------------------------------------------------------------------
// Per-cell heat and bar levels
// ---------------------------------------------------------------------------

/** CSS palette steps of a heat ramp (`--nq-pivot-heat-0 … -8`). */
const HEAT_STEPS = 9;

export interface PivotCellHeat {
  /** Level `0 … levels-1`. */
  readonly level: number;
  readonly levels: number;
  /** Palette step `0 … 8` (`data-nq-heat`, `--nq-pivot-heat-N`); the middle level maps to step 4. */
  readonly step: number;
  readonly scale: PivotHeatScale;
}

export interface PivotCellBar {
  /** Left edge of the bar as a fraction of the cell width (`0 … 1`). */
  readonly start: number;
  /** Bar width as a fraction of the cell width (`0 … 1`). */
  readonly width: number;
  /** The value is below zero. */
  readonly negative: boolean;
}

export interface PivotCellDesign {
  readonly heat?: PivotCellHeat;
  readonly bar?: PivotCellBar;
}

/** Heat / bar of every body cell: `[rowIndex][columnIndex]` over `model.rows` / `model.columns`. */
export type PivotCellDesigns = readonly (readonly (PivotCellDesign | undefined)[] | undefined)[];

export interface PivotCellDesignOptions {
  /**
   * Heat specs computed from the model's displayed values (`cell.value`). `undefined`: the model's
   * own heat (`spec.heat`, levels from `cell.heat`); `[]`: no heat.
   */
  readonly heat?: PivotHeatSpec | readonly PivotHeatSpec[];
  readonly bars?: readonly PivotBarSpec[];
}

/** Palette step of a heat level (keeps a diverging ramp's middle level on the middle step). */
export function pivotHeatPaletteStep(level: number, levels: number): number {
  if (levels <= 1) return 0;
  return Math.round((Math.min(levels - 1, Math.max(0, level)) * (HEAT_STEPS - 1)) / (levels - 1));
}

/** `heat` prop → a list (`undefined` stays `undefined`: the model's heat). */
export function pivotHeatSpecList(heat: PivotHeatSpec | readonly PivotHeatSpec[] | undefined): readonly PivotHeatSpec[] | undefined {
  if (heat === undefined) return undefined;
  return isHeatList(heat) ? heat : [heat];
}

function isHeatList(heat: PivotHeatSpec | readonly PivotHeatSpec[]): heat is readonly PivotHeatSpec[] {
  return Array.isArray(heat);
}

const columnLevels = (model: PivotModel): number => model.columnDimensions?.length ?? (model.columnDimension ? 1 : 0);
const isLeafRow = (row: PivotBodyRow): boolean => row.kind === "leaf" || row.kind === "calculated";
const rowApplies = (row: PivotBodyRow, applyTo: "leaf" | "group" | "all"): boolean =>
  row.kind !== "grandTotal" && (applyTo === "all" || (applyTo === "leaf") === isLeafRow(row));
const finite = (v: number | null): v is number => v !== null && Number.isFinite(v);

/**
 * Heat and bar levels of every body cell, as `PivotTable` draws them for `heat` / `bars`. Values are
 * the displayed ones (`cell.value`). Heat follows `PivotHeatSpec` (scope, levels, applyTo, domain,
 * scale); bars cover the measure's leaf columns (not subtotal or row-total columns), in one domain
 * per spec that always includes 0. The grand total row gets neither.
 */
export function pivotCellDesigns(model: PivotModel, options: PivotCellDesignOptions): PivotCellDesigns {
  const out: (PivotCellDesign | undefined)[][] = [];
  const set = (r: number, c: number, patch: PivotCellDesign) => {
    const row = (out[r] ??= []);
    row[c] = { ...row[c], ...patch };
  };
  const levelsOfColumns = columnLevels(model);
  const specs = pivotHeatSpecList(options.heat);

  if (specs === undefined) {
    // The model's own heat (spec.heat).
    const info = model.heat;
    if (info) {
      const scale: PivotHeatScale = info.scale ?? "sequential";
      model.rows.forEach((row, r) =>
        row.cells.forEach((cell, c) => {
          if (cell.heat !== undefined) set(r, c, { heat: { level: cell.heat, levels: info.levels, step: pivotHeatPaletteStep(cell.heat, info.levels), scale } });
        }),
      );
    }
  } else {
    for (const spec of specs) {
      const measureId = spec.measure ?? model.columns[0]?.measureId;
      if (measureId === undefined) continue;
      const scope = spec.scope ?? "all";
      const levels = spec.levels ?? 9;
      const applyTo = spec.applyTo ?? "leaf";
      const scale: PivotHeatScale = spec.scale ?? "sequential";
      const midpoint = spec.midpoint ?? 0;
      const columns = model.columns.flatMap((c, i) =>
        c.measureId === measureId && !(levelsOfColumns > 0 && c.columnKey === null) && (scope === "column" || !c.subtotal) ? [i] : [],
      );
      const scopeOf = (row: PivotBodyRow): string =>
        scope === "row" ? row.id : scope === "group" ? row.path.slice(0, -1).join("\u0001") : "";
      const keyOf = (rowKey: string, c: number) => (scope === "column" ? model.columns[c]!.id : rowKey);
      const fixed: PivotHeatDomain | null = spec.domain ? { min: spec.domain[0], max: spec.domain[1] } : null;
      const domains = new Map<string, { min: number; max: number }>();
      if (!fixed) {
        for (const row of model.rows) {
          if (!rowApplies(row, applyTo)) continue;
          const rowKey = scopeOf(row);
          for (const c of columns) {
            const v = row.cells[c]?.value ?? null;
            if (!finite(v)) continue;
            const k = keyOf(rowKey, c);
            const d = domains.get(k);
            if (!d) domains.set(k, { min: v, max: v });
            else if (v < d.min) d.min = v;
            else if (v > d.max) d.max = v;
          }
        }
      }
      model.rows.forEach((row, r) => {
        if (!rowApplies(row, applyTo)) return;
        const rowKey = fixed ? "" : scopeOf(row);
        for (const c of columns) {
          const domain = fixed ?? domains.get(keyOf(rowKey, c));
          if (!domain) continue;
          const level = pivotScaledHeatLevel(row.cells[c]?.value ?? null, domain, levels, scale, midpoint, !fixed);
          if (level !== undefined) set(r, c, { heat: { level, levels, step: pivotHeatPaletteStep(level, levels), scale } });
        }
      });
    }
  }

  for (const bar of options.bars ?? []) {
    const applyTo = bar.applyTo ?? "leaf";
    const hide = bar.negative === "hide";
    const columns = model.columns.flatMap((c, i) => (c.measureId === bar.measure && !c.subtotal && !(levelsOfColumns > 0 && c.columnKey === null) ? [i] : []));
    let min = 0;
    let max = 0;
    if (bar.domain) {
      [min, max] = bar.domain;
    } else {
      for (const row of model.rows) {
        if (!rowApplies(row, applyTo)) continue;
        for (const c of columns) {
          const v = row.cells[c]?.value ?? null;
          if (!finite(v) || (hide && v < 0)) continue;
          if (v < min) min = v;
          else if (v > max) max = v;
        }
      }
    }
    const span = max - min;
    if (!(span > 0)) continue;
    const base = Math.min(max, Math.max(min, 0));
    model.rows.forEach((row, r) => {
      if (!rowApplies(row, applyTo)) return;
      for (const c of columns) {
        const v = row.cells[c]?.value ?? null;
        if (!finite(v) || v === 0 || (hide && v < 0)) continue;
        const clamped = Math.min(max, Math.max(min, v));
        const start = (Math.min(base, clamped) - min) / span;
        const width = (Math.max(base, clamped) - min) / span - start;
        if (width > 0) set(r, c, { bar: { start, width, negative: v < 0 } });
      }
    });
  }
  return out;
}

/** Clamp a column width to `[PIVOT_COLUMN_WIDTH_MIN, PIVOT_COLUMN_WIDTH_MAX]` (whole px). */
export function pivotClampColumnWidth(width: number): number {
  return Math.min(PIVOT_COLUMN_WIDTH_MAX, Math.max(PIVOT_COLUMN_WIDTH_MIN, Math.round(width)));
}

/** Clamp a row height to `[PIVOT_ROW_HEIGHT_MIN, PIVOT_ROW_HEIGHT_MAX]` (whole px). */
export function pivotClampRowHeight(height: number): number {
  return Math.min(PIVOT_ROW_HEIGHT_MAX, Math.max(PIVOT_ROW_HEIGHT_MIN, Math.round(height)));
}

/** Re-exported for `PivotTable` `heat` (also in `@nqlib/nqgrid/core`). */
export type { PivotHeatScale, PivotHeatScope, PivotHeatSpec } from "../core/pivot/types";
