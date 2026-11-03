/**
 * Stable-id row list reordering (used with TanStack `getRowId` + drag-and-drop UIs).
 * Pair with `@nqlib/nqui/sortable` (vertical) or your own DnD layer.
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
