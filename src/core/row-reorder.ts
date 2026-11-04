/**
 * Stable-id row list reordering (used with TanStack `getRowId` + drag-and-drop UIs).
 * Pair with `@nqlib/nqui/sortable` (vertical) or your own DnD layer. The keyboard
 * helpers (`moveRowUp`/`moveRowDown`/`moveRowToIndex`) give reorder a11y parity
 * with pointer drag — wire them to Alt+Arrow / a keyboard "move mode".
 */

/** Move the row identified by `draggedId` to the index of `beforeId` (insert before that row). */
export function moveRowBefore<T extends { id: string }>(rows: readonly T[], draggedId: string, beforeId: string): T[] {
  if (draggedId === beforeId) return [...rows];
  const list = [...rows];
  const from = list.findIndex((r) => r.id === draggedId);
  let to = list.findIndex((r) => r.id === beforeId);
  if (from < 0 || to < 0) return list;
  const [item] = list.splice(from, 1);
  if (from < to) to -= 1;
  list.splice(to, 0, item!);
  return list;
}

/** Move `draggedId` to an absolute index (clamped). Insert semantics, not swap. */
export function moveRowToIndex<T extends { id: string }>(rows: readonly T[], draggedId: string, toIndex: number): T[] {
  const list = [...rows];
  const from = list.findIndex((r) => r.id === draggedId);
  if (from < 0) return list;
  const clamped = Math.max(0, Math.min(list.length - 1, toIndex));
  if (clamped === from) return list;
  const [item] = list.splice(from, 1);
  list.splice(clamped, 0, item!);
  return list;
}

/** Move a row up one position (keyboard reorder). No-op at the top. */
export function moveRowUp<T extends { id: string }>(rows: readonly T[], id: string): T[] {
  const from = rows.findIndex((r) => r.id === id);
  if (from <= 0) return [...rows];
  return moveRowToIndex(rows, id, from - 1);
}

/** Move a row down one position (keyboard reorder). No-op at the bottom. */
export function moveRowDown<T extends { id: string }>(rows: readonly T[], id: string): T[] {
  const from = rows.findIndex((r) => r.id === id);
  if (from < 0 || from >= rows.length - 1) return [...rows];
  return moveRowToIndex(rows, id, from + 1);
}
