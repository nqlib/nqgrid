import type { ColumnDef, ColumnPinningState } from "@tanstack/react-table";

import type { PivotBodyRow, PivotCell, PivotModel, PivotValueColumn } from "../core/pivot/types";
import { pivotTableGeometry } from "./layout";

/** Stored on each column's `meta.pivot` (read it back with `getPivotColumnMeta`). */
export type PivotColumnMeta =
  | { readonly kind: "dimension"; readonly level: number }
  | { readonly kind: "value"; readonly index: number; readonly column: PivotValueColumn };

export interface PivotTanstackOptions {
  readonly dimensionWidths?: readonly number[];
  readonly valueWidth?: number;
}

export interface PivotTanstack {
  /** `model.rows` (visible body rows, grand total included). */
  readonly data: PivotBodyRow[];
  /** One column per row dimension (`dim:<level>`), then one per value column (`model.columns[i].id`). */
  readonly columns: ColumnDef<PivotBodyRow, unknown>[];
  /** Pin the dimension columns left (`state.columnPinning`). */
  readonly columnPinning: ColumnPinningState;
  readonly getRowId: (row: PivotBodyRow) => string;
}

export const pivotDimensionColumnId = (level: number) => `dim:${level}`;

/** Label for dimension `level` on `row` (the row's own label at its depth, else the path key). */
export function pivotDimensionText(row: PivotBodyRow, level: number): string {
  if (row.kind === "grandTotal") return level === 0 ? row.label : "";
  if (level === row.depth) return row.label;
  return level < row.depth ? (row.path[level] ?? "") : "";
}

/**
 * Thin TanStack adapter: `useReactTable({ ...pivotModelToTanstack(model), getCoreRowModel })`.
 * Cells render `PivotCell.text` by default; override `cell` to add heat, toggles or spans
 * (`model.spans`) — or use `PivotTable` for the full planning layout.
 */
export function pivotModelToTanstack(model: PivotModel, options: PivotTanstackOptions = {}): PivotTanstack {
  const geometry = pivotTableGeometry({ ...model, layout: "tabular" }, options);
  const dimensions: ColumnDef<PivotBodyRow, unknown>[] = model.rowDimensions.map((dim, level) => {
    const meta: PivotColumnMeta = { kind: "dimension", level };
    return {
      id: pivotDimensionColumnId(level),
      header: dim.label,
      accessorFn: (row: PivotBodyRow) => pivotDimensionText(row, level),
      size: geometry.dimensionWidths[level],
      meta: { pivot: meta },
    };
  });
  const values: ColumnDef<PivotBodyRow, unknown>[] = model.columns.map((column, index) => {
    const meta: PivotColumnMeta = { kind: "value", index, column };
    return {
      id: column.id,
      header: column.headerPath.join(" "),
      accessorFn: (row: PivotBodyRow) => row.cells[index],
      cell: (info) => (info.getValue() as PivotCell | undefined)?.text ?? "",
      size: geometry.valueWidth,
      meta: { pivot: meta },
    };
  });
  return {
    data: [...model.rows],
    columns: [...dimensions, ...values],
    columnPinning: { left: dimensions.map((d) => d.id!), right: [] },
    getRowId: (row) => row.id,
  };
}

/** Read the pivot metadata off a TanStack column def (`column.columnDef`). */
export function getPivotColumnMeta(def: { readonly meta?: unknown }): PivotColumnMeta | undefined {
  const meta = def.meta as { pivot?: PivotColumnMeta } | undefined;
  return meta?.pivot;
}
