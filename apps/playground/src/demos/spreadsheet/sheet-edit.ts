/**
 * Pure data layer for the Spreadsheet editing features. Kept free of React so it
 * can be unit-tested in the node env: cell-commit coercion + the undo/redo
 * history reducer. The grid + page wire these into state.
 */
import type { OrderRow } from "./mock-data";

/**
 * Coerce a raw edited string into the value written for a column.
 * - numeric columns → a number. Accepts what people type in a spreadsheet:
 *   thousands separators (`1,234`), currency symbols (`$5`, `€1.5`), accounting
 *   negatives (`(12)`), percents (`12%` → 0.12) and exponents (`1e3`).
 *   Anything else — including an empty cell — returns `null`: the edit is
 *   rejected and the previous value kept, instead of silently writing 0.
 * - text columns → the raw string (empty string clears the cell).
 */
export function coerceCellValue(raw: string, numeric: boolean): string | number | null {
  if (!numeric) return raw;
  return parseLooseNumber(raw);
}

/** Lenient number parse for typed cell input; `null` when it isn't a number. */
export function parseLooseNumber(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith("-")) {
    sign = -sign;
    s = s.slice(1).trim();
  } else if (s.startsWith("+")) {
    s = s.slice(1).trim();
  }
  s = s.replace(/^[$€£¥]\s*/, "");
  let scale = 1;
  if (s.endsWith("%")) {
    scale = 0.01;
    s = s.slice(0, -1).trim();
  }
  // Thousands separators only between digit groups (1,234,567.8).
  if (/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(s)) s = s.replace(/,/g, "");
  if (!/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
  const n = Number(s) * scale * sign;
  return Number.isFinite(n) ? n : null;
}

/**
 * Apply an edited value to one cell, returning a new rows array (or the same
 * reference when the row id is absent or the input is rejected).
 */
export function commitCellValue(
  data: OrderRow[],
  rowId: string,
  key: keyof OrderRow,
  raw: string,
  numeric: boolean,
): OrderRow[] {
  const value = coerceCellValue(raw, numeric);
  if (value === null) return data;
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
