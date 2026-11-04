import type { Row, Table } from "@tanstack/react-table";
import type { RowPinningState } from "@tanstack/react-table";

export type RowPinPosition = "top" | "bottom";

export function createEmptyRowPinningState(): RowPinningState {
  return { top: [], bottom: [] };
}

export function tableSupportsRowPinning<TData>(table: Table<TData>): boolean {
  return (
    typeof table.getTopRows === "function" &&
    typeof table.getCenterRows === "function" &&
    typeof table.getBottomRows === "function"
  );
}

export function pinRowTop<TData>(row: Row<TData>): void {
  row.pin("top");
}

export function pinRowBottom<TData>(row: Row<TData>): void {
  row.pin("bottom");
}

export function unpinRow<TData>(row: Row<TData>): void {
  row.pin(false);
}

export function getRowPinningState<TData>(table: Table<TData>): RowPinningState {
  return table.getState().rowPinning ?? createEmptyRowPinningState();
}
