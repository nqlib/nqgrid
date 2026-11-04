/**
 * Pure data layer for the Spreadsheet editing features. Kept free of React so it
 * can be unit-tested in the node env: cell-commit coercion + the undo/redo
 * history reducer. The grid + page wire these into state.
 */
import type { OrderRow } from "./mock-data";

/**
 * Coerce a raw edited string into the value written for a column.
 * - numeric columns → Number; non-finite (incl. empty) falls back to 0.
 * - text columns → the raw string (empty string clears the cell).
 */
export function coerceCellValue(raw: string, numeric: boolean): string | number {
  if (!numeric) return raw;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : 0;
}

/**
 * Apply an edited value to one cell, returning a new rows array (or the same
 * reference when the row id is absent). Numeric coercion is applied per `numeric`.
 */
export function commitCellValue(
  data: OrderRow[],
  rowId: string,
  key: keyof OrderRow,
  raw: string,
  numeric: boolean,
): OrderRow[] {
  const value = coerceCellValue(raw, numeric);
  let changed = false;
  const next = data.map((row) => {
    if (row.id !== rowId) return row;
    changed = true;
    return { ...row, [key]: value } as OrderRow;
  });
  return changed ? next : data;
}

// ====== Undo / redo history ======

export interface HistoryState {
  past: OrderRow[][];
  present: OrderRow[];
  future: OrderRow[][];
}

export type HistoryAction =
  | { type: "commit"; next: OrderRow[] }
  | { type: "undo" }
  | { type: "redo" };

/**
 * Reducer for the data history. `commit` pushes the current present onto `past`,
 * clears `future`, and adopts `next`. `undo`/`redo` move a snapshot between
 * stacks. No-ops when the relevant stack is empty.
 */
export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "commit":
      if (action.next === state.present) return state;
      return {
        past: [...state.past, state.present],
        present: action.next,
        future: [],
      };
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1]!;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0]!;
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }
  }
}

export function canUndo(state: HistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: HistoryState): boolean {
  return state.future.length > 0;
}
