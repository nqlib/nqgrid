import {
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type FilterFn,
  type RowSelectionState,
  type TableOptions,
} from "@tanstack/react-table";

/**
 * Default empty TanStack `rowSelection` map. Keys must match `row.id` (from `getRowId` when set)
 * so `row.getIsSelected()` and row checkboxes stay in sync.
 */
export const EMPTY_ROW_SELECTION: RowSelectionState = {};

/** Preset ids for docs / configurator discovery. */
export const TANSTACK_ROW_MODEL_PRESETS = [
  "withCoreRowModel",
  "withCoreSorting",
  "withCoreSortingRowSelection",
  "withCoreSortingExpanded",
  "withCoreSortingFiltered",
  "withCoreSortingPaginated",
  "withCoreSortingGroupedExpanded",
  "withCoreSortingFaceted",
  "withCoreDataTable",
  "withFreezePanesSupport",
] as const;

export type TanstackRowModelPresetId = (typeof TANSTACK_ROW_MODEL_PRESETS)[number];

/** Substring match across listed accessor keys (case-insensitive). */
export function createGlobalFilterFn<TData>(
  searchKeys: readonly (keyof TData & string)[],
): FilterFn<TData> {
  return (row, _columnId, filterValue) => {
    const q = String(filterValue ?? "")
      .trim()
      .toLowerCase();
    if (!q) return true;
    const original = row.original;
    for (const key of searchKeys) {
      const v = original[key];
      if (v != null && String(v).toLowerCase().includes(q)) return true;
    }
    return false;
  };
}

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

/**
 * Adds freeze-pane / row-pinning defaults on top of {@link withCoreSorting}.
 * Render with `useTableRowSections` — do not use `getRowModel().rows` alone when pinning is active.
 */
export function withFreezePanesSupport<TData>(
  options: Omit<TableOptions<TData>, "getCoreRowModel" | "getSortedRowModel">,
): TableOptions<TData> {
  return {
    enablePinning: true,
    enableColumnPinning: true,
    enableRowPinning: true,
    keepPinnedRows: true,
    ...withCoreSorting(options),
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

/** Core + sorting + filtering (global and/or column filters). */
export function withCoreSortingFiltered<TData>(
  options: Omit<
    TableOptions<TData>,
    "getCoreRowModel" | "getSortedRowModel" | "getFilteredRowModel"
  >,
): TableOptions<TData> {
  return {
    ...options,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  };
}

/** Core + sorting + client pagination. */
export function withCoreSortingPaginated<TData>(
  options: Omit<
    TableOptions<TData>,
    "getCoreRowModel" | "getSortedRowModel" | "getPaginationRowModel"
  >,
): TableOptions<TData> {
  return {
    ...options,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  };
}

/** Core + grouping + sorting + expanded group rows. */
export function withCoreSortingGroupedExpanded<TData>(
  options: Omit<
    TableOptions<TData>,
    | "getCoreRowModel"
    | "getGroupedRowModel"
    | "getSortedRowModel"
    | "getExpandedRowModel"
  >,
): TableOptions<TData> {
  return {
    ...options,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  };
}

/** Core + sorting + filtering + faceting (unique values / min-max). */
export function withCoreSortingFaceted<TData>(
  options: Omit<
    TableOptions<TData>,
    | "getCoreRowModel"
    | "getSortedRowModel"
    | "getFilteredRowModel"
    | "getFacetedRowModel"
    | "getFacetedUniqueValues"
    | "getFacetedMinMaxValues"
  >,
): TableOptions<TData> {
  return {
    ...options,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
  };
}

/** Full client data table: filter → group → sort → expand → page + selection defaults. */
export function withCoreDataTable<TData>(
  options: Omit<
    TableOptions<TData>,
    | "getCoreRowModel"
    | "getFilteredRowModel"
    | "getGroupedRowModel"
    | "getSortedRowModel"
    | "getExpandedRowModel"
    | "getPaginationRowModel"
  >,
): TableOptions<TData> {
  return {
    enableRowSelection: true,
    enableMultiRowSelection: true,
    ...options,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  };
}
