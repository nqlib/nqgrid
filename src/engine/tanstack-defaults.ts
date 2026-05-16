import {
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type TableOptions,
} from "@tanstack/react-table";

/**
 * Default empty TanStack `rowSelection` map. Keys must match `row.id` (from `getRowId` when set)
 * so `row.getIsSelected()` and row checkboxes stay in sync.
 */
export const EMPTY_ROW_SELECTION: RowSelectionState = {};

/** Core row model only — baseline for headless tables. */
export function withCoreRowModel<TData>(
  options: Omit<TableOptions<TData>, "getCoreRowModel">,
): TableOptions<TData> {
  return {
    ...options,
    getCoreRowModel: getCoreRowModel(),
  };
}

/** Core + client sorting (TanStack v8). */
export function withCoreSorting<TData>(
  options: Omit<TableOptions<TData>, "getCoreRowModel" | "getSortedRowModel">,
): TableOptions<TData> {
  return {
    ...options,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  };
}

/** Core + sorting + row selection defaults (`enableRowSelection` / `enableMultiRowSelection`). */
export function withCoreSortingRowSelection<TData>(
  options: Omit<TableOptions<TData>, "getCoreRowModel" | "getSortedRowModel">,
): TableOptions<TData> {
  return {
    enableRowSelection: true,
    enableMultiRowSelection: true,
    ...options,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  };
}

/** Core + sorting + expanded rows (e.g. master/detail). */
export function withCoreSortingExpanded<TData>(
  options: Omit<
    TableOptions<TData>,
    "getCoreRowModel" | "getSortedRowModel" | "getExpandedRowModel"
  >,
): TableOptions<TData> {
  return {
    ...options,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  };
}
