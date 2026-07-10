import type { Row } from "@tanstack/react-table";

import type { TableRowSections } from "../virtualization/use-table-row-sections";

/**
 * Returns false for Excel-frozen prefix rows and TanStack top/bottom pinned rows.
 */
export function isRowNavigableForFreeze<TData>(
  rowIndex: number,
  sections: Pick<
    TableRowSections<TData>,
    "allRows" | "frozenTopRows" | "topPinnedRows" | "bottomPinnedRows"
  >,
): boolean {
  const row = sections.allRows[rowIndex];
  if (!row) return false;
  const nonNavigable = new Set([
    ...sections.frozenTopRows.map((r) => r.id),
    ...sections.topPinnedRows.map((r) => r.id),
    ...sections.bottomPinnedRows.map((r) => r.id),
  ]);
  return !nonNavigable.has(row.id);
}

export function isCenterRowNavigable<TData>(
  centerRowIndex: number,
  centerRows: readonly Row<TData>[],
): boolean {
  return centerRowIndex >= 0 && centerRowIndex < centerRows.length;
}
