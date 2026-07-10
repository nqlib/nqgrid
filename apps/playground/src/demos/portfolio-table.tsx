import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  type ColumnOrderState,
  type ColumnSizingState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { Button, Input, cn } from "@nqlib/nqui";
import { Sortable, SortableContent, SortableItem, SortableOverlay } from "@nqlib/nqui/sortable";
import type { PortfolioRow } from "@nqlib/nqgrid";
import { EMPTY_ROW_SELECTION, createGlobalFilterFn, withCoreSortingFiltered } from "@nqlib/nqgrid";
import {
  pinPlaygroundCell,
  usePlaygroundPinnedLayout,
} from "../lib/playground-row-index-gutter";
import {
  CanonicalHeaderCell,
  CanonicalSelectHeaderCell,
} from "../lib/playground-canonical-header-cell";
import {
  createSelectColumn,
  dataColumnOrder,
} from "../lib/playground-canonical-select-column";
import {
  sortableDropTargetProps,
  usePlaygroundSortableTableDropIndicators,
} from "../lib/playground-sortable-drop-indicator";
import { SortableDragOverlay } from "../lib/playground-sortable-drag-chrome";
import {
  gridBodyHoverClass,
  gridCellClass,
  gridHeadCellClass,
  gridHeaderClass,
  gridRowClass,
  gridTableClass,
} from "../lib/grid-styles";
import {
  neutralTanStackRowFillClass,
  playgroundTanStackRowStripeData,
  useNeutralPlaygroundTable,
} from "../lib/playground-neutral-table";
import { playgroundSpreadsheetBundle } from "../lib/playground-table-tokens";
import { EngineScrollTableShell, useEngineScrollViewport } from "../parity/engine-scroll-table-shell";
const PAGE_SIZE = 10;
const NUMERIC_IDS = new Set(["shares", "avgCost", "last", "dayPnLPct", "weightPct"]);
const PINNED_LEFT_IDS = ["ticker", "name"] as const;
const DEFAULT_COLUMN_ORDER: ColumnOrderState = [
  "select",
  "ticker",
  "name",
  "sector",
  "shares",
  "avgCost",
  "last",
  "dayPnLPct",
  "weightPct",
];

const PORTFOLIO_FILTER_KEYS = [
  "ticker",
  "name",
  "sector",
  "shares",
  "avgCost",
  "last",
  "dayPnLPct",
  "weightPct",
] as const satisfies readonly (keyof PortfolioRow)[];

const columnHelper = createColumnHelper<PortfolioRow>();
const bundle = playgroundSpreadsheetBundle;
const fmt2 = (n: number) => n.toFixed(2);

export function PortfolioTable({ data }: { data: PortfolioRow[] }) {
  const { tokens, rowFill } = useNeutralPlaygroundTable();

  const [rowData, setRowData] = useState(data);
  const [sorting, setSorting] = useState<SortingState>([{ id: "weightPct", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(EMPTY_ROW_SELECTION);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(DEFAULT_COLUMN_ORDER);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [page, setPage] = useState(0);
  const { viewportRef, scrolledX } = useEngineScrollViewport(true);

  useEffect(() => {
    setRowData(data);
  }, [data]);

  const columns = useMemo(
    () => [
      createSelectColumn(columnHelper, { mode: "index+checkbox", getRowLabel: (r) => r.ticker }),
      columnHelper.accessor("ticker", {
        id: "ticker",
        header: "Ticker",
        size: 88,
        minSize: 72,
        cell: (info) => <span className={cn(bundle.textNumericStrong, "font-medium")}>{info.getValue()}</span>,
      }),
      columnHelper.accessor("name", {
        id: "name",
        header: "Name",
        size: 180,
        minSize: 120,
        cell: (info) => (
          <span className="max-w-[10rem] truncate font-medium text-foreground sm:max-w-none">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("sector", {
        id: "sector",
        header: "Sector",
        size: 120,
        minSize: 96,
        cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor("shares", {
        id: "shares",
        header: () => <span className="block w-full text-right">Shares</span>,
        size: 96,
        cell: (info) => (
          <div className={cn("text-right tabular-nums", bundle.textNumericStrong)}>{info.getValue()}</div>
        ),
      }),
      columnHelper.accessor("avgCost", {
        id: "avgCost",
        header: () => <span className="block w-full text-right">Avg</span>,
        size: 96,
        cell: (info) => (
          <div className={cn("text-right tabular-nums", bundle.textNumericMuted)}>${fmt2(info.getValue())}</div>
        ),
      }),
      columnHelper.accessor("last", {
        id: "last",
        header: () => <span className="block w-full text-right">Last</span>,
        size: 96,
        cell: (info) => (
          <div className={cn("text-right tabular-nums", bundle.textNumericStrong)}>${fmt2(info.getValue())}</div>
        ),
      }),
      columnHelper.accessor("dayPnLPct", {
        id: "dayPnLPct",
        header: () => <span className="block w-full text-right">Day</span>,
        size: 88,
        cell: (info) => {
          const v = info.getValue();
          const pos = v >= 0;
          return (
            <div className={cn("text-right tabular-nums", pos ? "text-foreground" : "text-destructive")}>
              {pos ? "+" : ""}
              {v.toFixed(2)}%
            </div>
          );
        },
      }),
      columnHelper.accessor("weightPct", {
        id: "weightPct",
        header: () => <span className="block w-full text-right">Weight</span>,
        size: 96,
        cell: (info) => (
          <div className={cn("text-right tabular-nums text-muted-foreground")}>{fmt2(info.getValue())}%</div>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable(
    withCoreSortingFiltered({
      data: rowData,
      columns,
      state: { sorting, globalFilter, columnOrder, columnSizing, rowSelection },
      onSortingChange: setSorting,
      onGlobalFilterChange: setGlobalFilter,
      onColumnOrderChange: setColumnOrder,
      onColumnSizingChange: setColumnSizing,
      onRowSelectionChange: setRowSelection,
      globalFilterFn: createGlobalFilterFn<PortfolioRow>(PORTFOLIO_FILTER_KEYS),
      getRowId: (r) => r.id,
      enableRowSelection: true,
      enableMultiRowSelection: true,
      enableColumnResizing: true,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 72, maxSize: 480, size: 120 },
    }),
  );

  const leafColumns = table.getVisibleLeafColumns();
  const pinnedLayout = usePlaygroundPinnedLayout({
    table,
    dataPinnedLeftIds: PINNED_LEFT_IDS,
    selectColumnMode: "full",
    defaultWidth: 120,
  });

  const rows = table.getRowModel().rows;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const maxPage = pageCount - 1;
  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  useEffect(() => setPage(0), [data, sorting, globalFilter, columnOrder]);
  useEffect(() => setPage((p) => Math.min(p, maxPage)), [maxPage]);

  const rangeStart = rows.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = rows.length === 0 ? 0 : Math.min((page + 1) * PAGE_SIZE, rows.length);
  const sortableColumnIds = useMemo(() => dataColumnOrder(columnOrder), [columnOrder]);

  const onColumnReorder = useCallback((next: string[]) => {
    setColumnOrder(["select", ...next]);
  }, []);
  const sortableDrop = usePlaygroundSortableTableDropIndicators();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Filter ticker, name, sector…"
            className="h-9 pl-9"
            aria-label="Filter portfolio rows"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Pin: ticker, name · # column: select / drag rows · drag headers · resize
        </p>
      </div>

      <EngineScrollTableShell
        viewportRef={viewportRef}
        className="max-h-[min(60dvh,480px)]"
        footer={
          <>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                {table.getSelectedRowModel().rows.length > 0 ? (
                  <>
                    <span className="font-medium text-foreground">
                      {table.getSelectedRowModel().rows.length}
                    </span>{" "}
                    selected ·{" "}
                  </>
                ) : null}
                Rows <span className="font-medium text-foreground">{rangeStart}</span>–
                <span className="font-medium text-foreground">{rangeEnd}</span> of{" "}
                <span className="font-medium text-foreground">{rows.length}</span>
                {globalFilter.trim() ? (
                  <>
                    {" "}
                    (<span className="font-medium text-foreground">{data.length}</span> total)
                  </>
                ) : null}{" "}
                · Page <span className="font-medium text-foreground">{page + 1}</span> of{" "}
                <span className="font-medium text-foreground">{pageCount}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" aria-hidden />
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= maxPage}
                onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
              >
                Next
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" aria-hidden />
              </Button>
            </div>
          </>
        }
      >
        <div ref={sortableDrop.containerRef} className={sortableDrop.containerClassName}>
        <table className={cn(gridTableClass, "min-w-[960px]")} style={{ width: table.getTotalSize() }}>
          <colgroup>
            {leafColumns.map((col) => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>
          <Sortable
            value={sortableColumnIds}
            onValueChange={onColumnReorder}
            orientation="horizontal"
            flatCursor
            {...sortableDrop.columnSortableProps}
          >
            <SortableContent withoutSlot>
              <thead className={gridHeaderClass}>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => {
                      const id = header.column.id;
                      if (id === "select") {
                        const pin = pinPlaygroundCell({
                          pinnedLayout,
                          columnId: id,
                          variant: "head",
                          scrolledX,
                          rowIndexGutter: true,
                        });
                        return (
                          <CanonicalSelectHeaderCell
                            key={header.id}
                            header={header}
                            headClassName={gridHeadCellClass}
                            style={pin.style}
                            className={pin.className}
                            data-pinned={pin["data-pinned"]}
                          />
                        );
                      }
                      const pin = pinPlaygroundCell({
                        pinnedLayout,
                        columnId: id,
                        variant: "head",
                        scrolledX,
                      });

                      return (
                        <SortableItem key={header.id} value={id} asChild asHandle {...sortableDropTargetProps(id)}>
                          <CanonicalHeaderCell
                            header={header}
                            bundle={bundle}
                            headClassName={cn(
                              gridHeadCellClass,
                              NUMERIC_IDS.has(id) ? "text-right" : undefined,
                            )}
                            style={pin.style}
                            numeric={NUMERIC_IDS.has(id)}
                            className={pin.className}
                          />
                        </SortableItem>
                      );
                    })}
                  </tr>
                ))}
              </thead>
            </SortableContent>
            <SortableOverlay>
              {({ value }) => (
                <SortableDragOverlay axis="column" label={String(value)} />
              )}
            </SortableOverlay>
          </Sortable>

          <Sortable
            value={rowData}
            onValueChange={setRowData}
            getItemValue={(r) => r.id}
            orientation="vertical"
            flatCursor
            {...sortableDrop.rowSortableProps}
          >
            <SortableContent withoutSlot>
              <tbody className={gridBodyHoverClass}>
                {pageRows.map((row) => (
                  <SortableItem
                    key={row.id}
                    value={row.original.id}
                    asChild
                    asHandle
                    {...sortableDropTargetProps(row.original.id)}
                  >
                    <tr
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      className={cn(gridRowClass, "group/row", neutralTanStackRowFillClass(tokens, row.index))}
                      {...playgroundTanStackRowStripeData(tokens, row.index)}
                      title="Tap # or checkbox to select · drag row to reorder · ⌘/Ctrl-click row to toggle"
                      onClick={(e) => {
                        if (!e.metaKey && !e.ctrlKey) return;
                        e.preventDefault();
                        row.toggleSelected();
                      }}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const id = cell.column.id;
                        const pin = pinPlaygroundCell({
                          pinnedLayout,
                          columnId: id,
                          variant: "body",
                          scrolledX,
                          rowIndexGutter: id === "select",
                          rowFillTokens: id === "select" ? undefined : tokens,
                          rowIndex: id === "select" ? undefined : row.index,
                        });

                        return (
                          <td
                            key={cell.id}
                            className={cn(
                              gridCellClass,
                              id === "select" && "min-w-0 align-middle",
                              pin.className,
                            )}
                            style={{ width: cell.column.getSize(), ...pin.style }}
                            {...(pin["data-pinned"] ? { "data-pinned": true as const } : {})}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  </SortableItem>
                ))}
              </tbody>
            </SortableContent>
            <SortableOverlay>
              {({ value }) => {
                const r = rowData.find((x) => x.id === value);
                return (
                  <SortableDragOverlay
                    axis="row"
                    label={r ? `${r.ticker} · ${r.name}` : String(value)}
                  />
                );
              }}
            </SortableOverlay>
          </Sortable>
        </table>
        {sortableDrop.indicators}
        </div>
      </EngineScrollTableShell>
    </div>
  );
}
