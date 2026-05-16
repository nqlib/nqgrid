import { useCallback } from "react";
import type { KeyboardEvent } from "react";
import type { Table } from "@tanstack/react-table";

export interface CellNavPosition {
  rowIndex: number;
  columnId: string;
}

export interface UseCellKeyboardTableOptions<TData> {
  table: Table<TData>;
  /** Visible leaf column ids in order. */
  columnIds: readonly string[];
  active: CellNavPosition | null;
  onActiveChange: (next: CellNavPosition | null) => void;
  /** Skip row indices (e.g. group header rows). */
  isRowNavigable?: (rowIndex: number) => boolean;
}

/**
 * Minimal arrow-key navigation for read-only / light table mode (single focused cell).
 */
export function useCellKeyboardTable<TData>({
  table,
  columnIds,
  active,
  onActiveChange,
  isRowNavigable = () => true,
}: UseCellKeyboardTableOptions<TData>) {
  const rowCount = table.getRowModel().rows.length;

  const move = useCallback(
    (dx: number, dy: number) => {
      if (columnIds.length === 0 || rowCount === 0) return;
      const cur = active ?? { rowIndex: 0, columnId: columnIds[0]! };
      let colIdx = columnIds.indexOf(cur.columnId);
      if (colIdx < 0) colIdx = 0;
      let rowIdx = cur.rowIndex;

      colIdx = Math.min(columnIds.length - 1, Math.max(0, colIdx + dx));
      if (dy !== 0) {
        rowIdx += dy;
        while (rowIdx >= 0 && rowIdx < rowCount && !isRowNavigable(rowIdx)) {
          rowIdx += dy > 0 ? 1 : -1;
        }
      }
      rowIdx = Math.min(rowCount - 1, Math.max(0, rowIdx));
      if (!isRowNavigable(rowIdx)) return;

      onActiveChange({ rowIndex: rowIdx, columnId: columnIds[colIdx]! });
    },
    [active, columnIds, isRowNavigable, onActiveChange, rowCount],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        move(1, 0);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(-1, 0);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        move(0, 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        move(0, -1);
      }
    },
    [move],
  );

  return { onKeyDown };
}
