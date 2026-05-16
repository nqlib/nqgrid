import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from "react";
import {
  createColumnHelper,
  flexRender,
  type ColumnOrderState,
  type ColumnSizingState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { RiDraggable } from "@remixicon/react";
import {
  Checkbox,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@nqlib/nqui";
import { Sortable, SortableContent, SortableItem, SortableOverlay } from "@nqlib/nqui/sortable";
import {
  EMPTY_ROW_SELECTION,
  tableCellClass,
  tableDenseTypography,
  tableHeaderClass,
  tableHeadClass,
  tableRowClass,
  tableScrollAreaContentClass,
  tableShellClass,
  withCoreSortingRowSelection,
} from "@nqlib/nqgrid";
import { usePlaygroundTableBodyClass } from "../playground-table-settings";

type Row = { id: string; label: string; amount: number };

const helper = createColumnHelper<Row>();

const DEFAULT_COLUMN_ORDER: ColumnOrderState = ["select", "label", "amount"];

const COLUMN_SIZING_STORAGE_KEY = "nqgrid-playground-table-selection-column-sizing-v1";

function readStoredColumnSizing(): ColumnSizingState {
  try {
    const raw = localStorage.getItem(COLUMN_SIZING_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as ColumnSizingState;
  } catch {
    /* ignore */
  }
  return {};
}

function dataColumnOrder(order: ColumnOrderState) {
  return order.filter((id) => id !== "select");
}

/** Stop parent `SortableItem asHandle` (row or column) from capturing pointer/keyboard for controls. */
function stopSortableChain(e: SyntheticEvent) {
  e.stopPropagation();
}

export function TableSelectionDemo({ data }: { data: Row[] }) {
  const [rowData, setRowData] = useState<Row[]>(data);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(EMPTY_ROW_SELECTION);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(readStoredColumnSizing);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(DEFAULT_COLUMN_ORDER);
  const tableBodyClassName = usePlaygroundTableBodyClass();

  useEffect(() => {
    setRowData(data);
  }, [data]);

  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_SIZING_STORAGE_KEY, JSON.stringify(columnSizing));
    } catch {
      /* ignore */
    }
  }, [columnSizing]);

  const sortableColumnIds = useMemo(() => dataColumnOrder(columnOrder), [columnOrder]);

  const columns = useMemo(
    () => [
      helper.display({
        id: "select",
        enableHiding: false,
        enableResizing: false,
        size: 44,
        minSize: 40,
        maxSize: 52,
        header: ({ table }) => {
          const showSelect = table.getIsSomeRowsSelected() || table.getIsAllRowsSelected();
          return (
            <div className="group relative flex h-8 w-full items-center justify-center">
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums tracking-wide text-muted-foreground transition-opacity",
                  showSelect ? "opacity-0" : "group-hover:opacity-0 group-focus-within:opacity-0",
                )}
              >
                #
              </span>
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center transition-opacity",
                  showSelect
                    ? "pointer-events-auto opacity-100"
                    : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
                )}
                onPointerDown={stopSortableChain}
                onMouseDown={stopSortableChain}
                onTouchStart={stopSortableChain}
                onKeyDown={stopSortableChain}
              >
                <Checkbox
                  checked={
                    table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false
                  }
                  onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
                  aria-label="Select all rows"
                  className="hit-area-6"
                />
              </div>
            </div>
          );
        },
        cell: ({ row }) => {
          const selected = row.getIsSelected();
          return (
            <div className="relative flex h-8 w-full min-w-0 items-center justify-center">
              <span
                className={cn(
                  "text-sm font-medium tabular-nums text-foreground transition-opacity",
                  selected && "opacity-0",
                  !selected &&
                    "opacity-100 group-hover/row:opacity-0 group-focus-within/row:opacity-0",
                )}
              >
                {row.index + 1}
              </span>
              {/* Row drag: same slot as #; pointer events bubble to `tr` (SortableItem asHandle). */}
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-0 transition-opacity",
                  !selected &&
                    "group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:opacity-0",
                )}
                aria-hidden
              >
                <RiDraggable className="size-4 text-muted-foreground" />
              </div>
              <div
                className={cn(
                  "absolute inset-0 z-10 flex items-center justify-center transition-opacity",
                  selected
                    ? "pointer-events-auto opacity-100"
                    : "pointer-events-none opacity-0 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100",
                )}
                onPointerDown={stopSortableChain}
                onMouseDown={stopSortableChain}
                onTouchStart={stopSortableChain}
                onKeyDown={stopSortableChain}
              >
                <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(v) => row.toggleSelected(!!v)}
                  aria-label={`Select ${row.original.label}`}
                  className="hit-area-6"
                />
              </div>
            </div>
          );
        },
      }),
      helper.accessor("label", {
        id: "label",
        header: "Label",
        cell: (i) => i.getValue(),
        size: 220,
        minSize: 120,
        maxSize: 480,
      }),
      helper.accessor("amount", {
        id: "amount",
        header: () => <span className="block w-full text-right">Amount</span>,
        cell: (i) => <span className="tabular-nums">{i.getValue()}</span>,
        size: 140,
        minSize: 96,
        maxSize: 320,
      }),
    ],
    [],
  );

  const table = useReactTable<Row>(
    withCoreSortingRowSelection({
      data: rowData,
      columns,
      state: { sorting, rowSelection, columnSizing, columnOrder },
      onSortingChange: setSorting,
      onRowSelectionChange: setRowSelection,
      onColumnSizingChange: setColumnSizing,
      onColumnOrderChange: setColumnOrder,
      getRowId: (r) => r.id,
      enableColumnResizing: true,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 72, maxSize: 560, size: 160 },
    }),
  );

  const onSortableColumnReorder = useCallback((nextDataOrder: string[]) => {
    setColumnOrder(["select", ...nextDataOrder]);
  }, []);

  return (
    <div className={cn(tableShellClass, "min-h-[20rem] max-h-[min(70dvh,520px)]")}>
      <p className="shrink-0 border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
        Column widths persist in <code className="rounded bg-muted px-1">localStorage</code>. Column reorder is in{" "}
        <code className="rounded bg-muted px-1">thead</code>; row reorder uses the <code className="rounded bg-muted px-1">#</code>{" "}
        cell (hover row — drag icon replaces the index in that slot). ⌘/Ctrl-click toggles selection; Tab into the
        # cell to show the checkbox when unselected. Selected rows keep the checkbox visible. Engine:{" "}
        <code className="rounded bg-muted px-1">EMPTY_ROW_SELECTION</code> /{" "}
        <code className="rounded bg-muted px-1">withCoreSortingRowSelection</code>.
      </p>

      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div
          className={cn(
            tableScrollAreaContentClass,
            "absolute inset-0 overflow-x-auto overflow-y-auto",
          )}
          style={{
            minHeight: 0,
            minWidth: 0,
            overscrollBehavior: "contain",
          }}
        >
          <table
            className={tableDenseTypography}
            style={{
              width: table.getTotalSize(),
              tableLayout: "fixed",
            }}
          >
            <Sortable
              value={sortableColumnIds}
              onValueChange={onSortableColumnReorder}
              orientation="horizontal"
              flatCursor
            >
              <SortableContent withoutSlot>
                <TableHeader className={tableHeaderClass}>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id} className={tableRowClass}>
                      {hg.headers.map((header) => {
                        const id = header.column.id;
                        if (id === "select") {
                          return (
                            <TableHead
                              key={header.id}
                              className={cn(
                                tableHeadClass,
                                "relative",
                                "group min-w-9 max-w-[3.25rem]",
                              )}
                              style={{ width: header.getSize() }}
                            >
                              {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                          );
                        }
                        return (
                          <SortableItem key={header.id} value={id} asChild asHandle>
                            <TableHead
                              className={cn(tableHeadClass, "group/col relative")}
                              style={{ width: header.getSize() }}
                            >
                              {header.isPlaceholder ? null : (
                                <>
                                  <div className="flex min-w-0 items-center gap-1.5 pr-3">
                                    <span
                                      className="pointer-events-none inline-flex shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/col:opacity-100"
                                      aria-hidden
                                    >
                                      <RiDraggable className="size-3.5" />
                                    </span>
                                    <button
                                      type="button"
                                      className="inline-flex min-w-0 flex-1 items-center gap-1 text-left"
                                      onClick={header.column.getToggleSortingHandler()}
                                      onPointerDown={stopSortableChain}
                                      onMouseDown={stopSortableChain}
                                      onTouchStart={stopSortableChain}
                                      onKeyDown={stopSortableChain}
                                    >
                                      {flexRender(header.column.columnDef.header, header.getContext())}
                                      {header.column.getIsSorted() === "asc"
                                        ? "▲"
                                        : header.column.getIsSorted() === "desc"
                                          ? "▼"
                                          : ""}
                                    </button>
                                  </div>
                                  {header.column.getCanResize() ? (
                                    <div
                                      role="separator"
                                      aria-orientation="vertical"
                                      aria-label={`Resize ${id} column`}
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        header.getResizeHandler()(e);
                                      }}
                                      onTouchStart={(e) => {
                                        e.stopPropagation();
                                        header.getResizeHandler()(e);
                                      }}
                                      className={cn(
                                        "absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none select-none",
                                        "border-r border-transparent hover:border-border hover:bg-primary/15",
                                        header.column.getIsResizing() && "border-primary/40 bg-primary/20",
                                      )}
                                    />
                                  ) : null}
                                </>
                              )}
                            </TableHead>
                          </SortableItem>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
              </SortableContent>
              <SortableOverlay>
                {({ value }) => (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-md">
                    <RiDraggable className="size-4 text-muted-foreground" aria-hidden />
                    {value === "label" ? "Label" : value === "amount" ? "Amount" : String(value)}
                  </div>
                )}
              </SortableOverlay>
            </Sortable>

            <Sortable
              value={rowData}
              onValueChange={setRowData}
              getItemValue={(r: Row) => r.id}
              orientation="vertical"
              flatCursor
            >
              <SortableContent withoutSlot>
                <TableBody className={tableBodyClassName}>
                  {table.getRowModel().rows.map((row) => (
                    <SortableItem key={row.id} value={row.original.id} asChild asHandle>
                      <tr
                        data-state={row.getIsSelected() ? "selected" : undefined}
                        className={cn(tableRowClass, "group/row")}
                        title="Hover row for drag handle in # column; ⌘/Ctrl-click row to toggle selection."
                        onClick={(e) => {
                          if (!e.metaKey && !e.ctrlKey) return;
                          e.preventDefault();
                          row.toggleSelected();
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              tableCellClass,
                              cell.column.id === "select" && "min-w-0 py-2 align-middle",
                            )}
                            style={{ width: cell.column.getSize() }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </tr>
                    </SortableItem>
                  ))}
                </TableBody>
              </SortableContent>
              <SortableOverlay>
                {({ value }) => {
                  const r = rowData.find((x) => x.id === value);
                  return (
                    <div className="flex min-w-[12rem] items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-md">
                      <RiDraggable className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate">{r ? `${r.label} · ${r.amount}` : String(value)}</span>
                    </div>
                  );
                }}
              </SortableOverlay>
            </Sortable>
          </table>
        </div>
      </div>
    </div>
  );
}
