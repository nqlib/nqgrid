import type { RowPinningState, TableOptions } from "@tanstack/react-table";

import { createEmptyRowPinningState } from "./row-pinning";

/**
 * TanStack options fragment for id-based row pinning (`getTopRows` / `getCenterRows` / `getBottomRows`).
 */
export function withRowPinningDefaults<TData>(
  options: TableOptions<TData>,
): TableOptions<TData> {
  return {
    enablePinning: true,
    enableRowPinning: true,
    keepPinnedRows: true,
    ...options,
  };
}

export function mergeRowPinningState(
  current: RowPinningState | undefined,
  patch: Partial<RowPinningState>,
): RowPinningState {
  const base = current ?? createEmptyRowPinningState();
  return {
    top: patch.top ?? base.top ?? [],
    bottom: patch.bottom ?? base.bottom ?? [],
  };
}

export function addRowToPinning(
  state: RowPinningState,
  rowId: string,
  position: "top" | "bottom",
): RowPinningState {
  const key = position;
  const list = [...(state[key] ?? [])];
  if (!list.includes(rowId)) list.push(rowId);
  const otherKey = position === "top" ? "bottom" : "top";
  const other = (state[otherKey] ?? []).filter((id) => id !== rowId);
  return { ...state, [key]: list, [otherKey]: other };
}

export function removeRowFromPinning(state: RowPinningState, rowId: string): RowPinningState {
  return {
    top: (state.top ?? []).filter((id) => id !== rowId),
    bottom: (state.bottom ?? []).filter((id) => id !== rowId),
  };
}
