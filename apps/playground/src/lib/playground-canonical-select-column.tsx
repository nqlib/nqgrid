import type { KeyboardEvent } from "react";
import type { CellContext, HeaderContext, Table } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import type { RowKeyboardReorderProps } from "@nqlib/nqgrid";
import { Checkbox, cn } from "@nqlib/nqui";
import {
  gridRowHeaderCellClass,
  gridRowHeaderCellShellClass,
  gridRowHeaderHeadClass,
  gridRowHeaderNumberClass,
} from "./grid-styles";
import { SelectCellChrome } from "./select-cell-chrome";
import { stopSortableChain } from "./playground-sortable-utils";

export { stopSortableChain } from "./playground-sortable-utils";

/** First-column interaction mode — see nqgrid-playground-starter §2. */
export type SelectColumnMode = "index" | "checkbox" | "index+checkbox" | "full";

const MODE_SIZING: Record<
  SelectColumnMode,
  { size: number; minSize: number; maxSize: number }
> = {
  index: { size: 44, minSize: 40, maxSize: 48 },
  checkbox: { size: 36, minSize: 32, maxSize: 40 },
  "index+checkbox": { size: 48, minSize: 44, maxSize: 52 },
  full: { size: 48, minSize: 44, maxSize: 52 },
};

/** TanStack column id for the first column — see `ROW_INDEX_GUTTER_ID` in playground-row-index-gutter.ts. */
export const SELECT_COLUMN_ID = "select" as const;

/** Visible **data column** ids for horizontal header Sortable (excludes row-index gutter). */
export function dataColumnOrder(order: string[]) {
  return order.filter((id) => id !== SELECT_COLUMN_ID);
}

export type SelectColumnOptions<TData extends { id: string }> = {
  /**
   * `index` — row # only (analytics default).
   * `checkbox` — bulk multi-select only.
   * `index+checkbox` — # ↔ checkbox (`SelectCellChrome`).
   * `full` — deprecated alias for `index+checkbox` (grip lane removed; row/header Sortable handles DnD).
   */
  mode?: SelectColumnMode;
  /** Accessible label for row checkbox. */
  getRowLabel?: (row: TData) => string;
  /** `page` uses toggleAllPageRowsSelected (paged tables). */
  selectAllScope?: "all" | "page";
  /** Keyboard reorder props per row id (from `useRowKeyboardReorder.getGripProps`). */
  getKeyboardReorderProps?: (id: string) => RowKeyboardReorderProps;
  /** Whether a row id is currently grabbed for keyboard reorder. */
  isGrabbed?: (id: string) => boolean;
};

type ColumnHelper<TData extends { id: string }> = ReturnType<typeof createColumnHelper<TData>>;

export type SelectColumnMeta = { selectColumnMode: SelectColumnMode };

export function getSelectColumnMode(column: { columnDef: { meta?: unknown } }): SelectColumnMode | undefined {
  const meta = column.columnDef.meta as Partial<SelectColumnMeta> | undefined;
  return meta?.selectColumnMode;
}

export function selectColumnUsesRowHeader(mode?: SelectColumnMode): boolean {
  return mode === "index" || mode === "index+checkbox" || mode === "full";
}

/** `<th>` classes for the select column — row-header gutter or default head cell. */
export function selectColumnThClass(mode: SelectColumnMode | undefined, defaultHeadClass: string) {
  const shell = "relative min-w-9 max-w-[3.25rem]";
  if (selectColumnUsesRowHeader(mode)) {
    return cn(gridRowHeaderHeadClass, shell);
  }
  return cn(defaultHeadClass, shell);
}

/** `<td>` classes for the select column — row-header gutter or default body cell. */
export function selectColumnTdClass(
  mode: SelectColumnMode | undefined,
  defaultCellClass: string,
  options?: { pinned?: boolean },
) {
  const shell = "min-w-0 align-middle px-0";
  if (selectColumnUsesRowHeader(mode)) {
    return cn(options?.pinned ? gridRowHeaderCellShellClass : gridRowHeaderCellClass, shell);
  }
  return cn(defaultCellClass, shell);
}

/** Set on `<td>` when `selectColumnUsesRowHeader` so row hover skips the gutter. */
export function selectColumnRowHeaderProps(mode: SelectColumnMode | undefined) {
  return selectColumnUsesRowHeader(mode) ? ({ "data-row-header": true } as const) : undefined;
}

function selectAllState<TData>(table: Table<TData>, scope: "all" | "page") {
  const showSelect =
    scope === "page"
      ? table.getIsSomePageRowsSelected() || table.getIsAllPageRowsSelected()
      : table.getIsSomeRowsSelected() || table.getIsAllRowsSelected();
  const checked: boolean | "indeterminate" =
    scope === "page"
      ? table.getIsAllPageRowsSelected()
        ? true
        : table.getIsSomePageRowsSelected()
          ? "indeterminate"
          : false
      : table.getIsAllRowsSelected()
        ? true
        : table.getIsSomeRowsSelected()
          ? "indeterminate"
          : false;
  const onToggleAll =
    scope === "page"
      ? (v: boolean) => table.toggleAllPageRowsSelected(v)
      : (v: boolean) => table.toggleAllRowsSelected(v);
  return { showSelect, checked, onToggleAll };
}

function SelectAllCheckbox({
  checked,
  onToggleAll,
  scope,
}: {
  checked: boolean | "indeterminate";
  onToggleAll: (v: boolean) => void;
  scope: "all" | "page";
}) {
  return (
    <div
      className="flex items-center justify-center"
      onPointerDown={stopSortableChain}
      onMouseDown={stopSortableChain}
      onTouchStart={stopSortableChain}
      onKeyDown={stopSortableChain}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onToggleAll(!!v)}
        aria-label={scope === "page" ? "Select all on page" : "Select all rows"}
        className="hit-area-6"
      />
    </div>
  );
}

function IndexHashHeader() {
  return <span className="select-none">#</span>;
}

function IndexNumberCell({ rowIndex }: { rowIndex: number }) {
  return (
    <div className="flex h-8 w-full items-center justify-center">
      <span className={cn(gridRowHeaderNumberClass, "select-none")}>{rowIndex + 1}</span>
    </div>
  );
}

function CheckboxOnlyCell<TData extends { id: string }>({
  row,
  getRowLabel,
}: {
  row: CellContext<TData, unknown>["row"];
  getRowLabel: (row: TData) => string;
}) {
  return (
    <div
      className="flex h-8 w-full items-center justify-center"
      onPointerDown={stopSortableChain}
      onMouseDown={stopSortableChain}
      onTouchStart={stopSortableChain}
    >
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label={`Select ${getRowLabel(row.original)}`}
        className="hit-area-6"
      />
    </div>
  );
}

/** First column — mode-driven: # / checkbox / both / full parity chrome. */
export function createSelectColumn<TData extends { id: string }>(
  helper: ColumnHelper<TData>,
  options: SelectColumnOptions<TData> = {},
) {
  const {
    mode = "index+checkbox",
    getRowLabel = (row) => row.id,
    selectAllScope = "all",
    getKeyboardReorderProps,
    isGrabbed,
  } = options;
  const effectiveMode = mode === "full" ? "index+checkbox" : mode;
  const sizing = MODE_SIZING[effectiveMode];

  return helper.display({
    id: "select",
    meta: { selectColumnMode: effectiveMode } satisfies SelectColumnMeta,
    enableHiding: false,
    enableResizing: false,
    enableSorting: false,
    size: sizing.size,
    minSize: sizing.minSize,
    maxSize: sizing.maxSize,
    header: ({ table }: HeaderContext<TData, unknown>) => {
      if (effectiveMode === "index") {
        return (
          <div className="flex h-8 w-full items-center justify-center">
            <IndexHashHeader />
          </div>
        );
      }

      if (effectiveMode === "checkbox") {
        const { checked, onToggleAll } = selectAllState(table, selectAllScope);
        return (
          <div className="flex h-8 w-full items-center justify-center">
            <SelectAllCheckbox checked={checked} onToggleAll={onToggleAll} scope={selectAllScope} />
          </div>
        );
      }

      const { showSelect, checked, onToggleAll } = selectAllState(table, selectAllScope);
      return (
        <div className="group relative flex h-8 w-full items-center justify-center">
          <span
            className={cn(
              "text-xs font-semibold tabular-nums tracking-wide text-muted-foreground transition-opacity",
              showSelect
                ? "opacity-0"
                : "group-hover:opacity-0 group-focus-within:opacity-0 pointer-coarse:opacity-0",
            )}
          >
            #
          </span>
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity",
              showSelect
                ? "pointer-events-auto opacity-100"
                : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100",
            )}
          >
            <SelectAllCheckbox checked={checked} onToggleAll={onToggleAll} scope={selectAllScope} />
          </div>
        </div>
      );
    },
    cell: ({ row }: CellContext<TData, unknown>) => {
      if (effectiveMode === "index") {
        return <IndexNumberCell rowIndex={row.index} />;
      }

      if (effectiveMode === "checkbox") {
        return <CheckboxOnlyCell row={row} getRowLabel={getRowLabel} />;
      }

      const id = row.original.id;
      const reorderProps = getKeyboardReorderProps?.(id);
      const keyboardReorderProps = reorderProps
        ? {
            ...reorderProps,
            "aria-grabbed": reorderProps["aria-grabbed"] ?? isGrabbed?.(id) ?? false,
            onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
              e.stopPropagation();
              reorderProps.onKeyDown(e);
            },
          }
        : undefined;
      return (
        <SelectCellChrome
          rowIndex={row.index}
          selected={row.getIsSelected()}
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(v)}
          rowLabel={getRowLabel(row.original)}
          numberClassName={gridRowHeaderNumberClass}
          keyboardReorderProps={keyboardReorderProps}
        />
      );
    },
  });
}
