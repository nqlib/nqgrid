import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getExpandedRowModel,
  type ExpandedState,
  type RowSelectionState,
  type SortingState,
  type Table as TanStackTable,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import {
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  cn,
} from "@nqlib/nqui";
import { Sortable, SortableContent, SortableItem, SortableOverlay } from "@nqlib/nqui/sortable";
import type { FlightRow } from "@nqlib/nqgrid";
import { createGlobalFilterFn, useInfiniteVisibleRows, withCoreSortingFiltered } from "@nqlib/nqgrid";
import {
  pinPlaygroundCell,
  usePlaygroundPinnedLayout,
} from "../lib/playground-row-index-gutter";
import { createSelectColumn } from "../lib/playground-canonical-select-column";
import {
  sortableDropTargetProps,
  usePlaygroundSortableRowDropIndicator,
} from "../lib/playground-sortable-drop-indicator";
import { SortableDragOverlay } from "../lib/playground-sortable-drag-chrome";
import {
  gridBodyHoverClass,
  gridCellClass,
  gridHeadCellClass,
  gridHeaderClass,
  gridNumericClass,
  gridRowClass,
  gridTableClass,
} from "../lib/grid-styles";
import {
  neutralTanStackRowFillClass,
  playgroundTanStackRowStripeData,
  useNeutralPlaygroundTable,
} from "../lib/playground-neutral-table";
import { EngineScrollTableShell, useEngineScrollViewport } from "../parity/engine-scroll-table-shell";

const columnHelper = createColumnHelper<FlightRow>();

const gateNotes: Record<string, string[]> = {
  f1: ["Gate C12 — boarding in 8m", "Crew: complete"],
  f3: ["Equipment swap — new ETD +42m", "Snack vouchers at desk 4"],
  f4: ["Weather at MUC — rebook hotline active"],
  f8: ["De-icing queue — monitor FIDS"],
};

const COLUMN_LABELS: Record<string, string> = {
  code: "Flight",
  origin: "Origin",
  destination: "Destination",
  start: "Schedule",
  duration: "Duration",
  status: "Status",
  aircraft: "Equipment",
  gate: "Gate",
  terminal: "Terminal",
  stand: "Stand",
  pax: "Passengers",
  crew: "Crew",
  delayMin: "Delay",
  loadPct: "Load %",
  fuel1kKg: "Fuel (1000 kg)",
  groundHandler: "Ground handler",
  belt: "Bag belt",
};

const FLIGHT_GLOBAL_FILTER_KEYS = [
  "code",
  "origin",
  "destination",
  "start",
  "end",
  "duration",
  "aircraft",
  "gate",
  "terminal",
  "stand",
  "groundHandler",
  "belt",
  "status",
] as const satisfies readonly (keyof FlightRow)[];

const PINNED_DATA_COLUMN_IDS = ["code", "origin"] as const;
const PINNED_WIDTH_OVERRIDES: Record<string, number> = {
  select: 48,
  code: 88,
  origin: 72,
};

function FlightStatusBadge({ status }: { status: FlightRow["status"] }) {
  const map = {
    boarding: { label: "Boarding", variant: "default" as const },
    on_time: { label: "On time", variant: "secondary" as const },
    delayed: { label: "Delayed", variant: "outline" as const },
    cancelled: { label: "Cancelled", variant: "destructive" as const },
  } as const;
  const m = map[status];
  return (
    <Badge variant={m.variant} className="text-xs font-medium leading-normal">
      {m.label}
    </Badge>
  );
}

function TimelineCell({ row }: { row: FlightRow }) {
  const delayed = row.status === "delayed";
  const cancelled = row.status === "cancelled";
  return (
    <div className="flex min-w-[11rem] items-center gap-1.5 sm:min-w-[13rem]">
      <span
        className={cn(
          gridNumericClass,
          delayed && "font-medium text-primary",
          cancelled && "line-through opacity-60",
        )}
      >
        {row.start}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-0.5 text-muted-foreground">
        <span className="h-px flex-1 border-b border-dotted border-border" />
        <span className="size-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
        <span className="h-px flex-1 border-b border-dotted border-border" />
      </span>
      <span className="shrink-0 text-xs leading-normal text-muted-foreground">{row.duration}</span>
      <span className="flex min-w-0 flex-1 items-center gap-0.5 text-muted-foreground">
        <span className="h-px flex-1 border-b border-dotted border-border" />
        <span className="size-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
        <span className="h-px flex-1 border-b border-dotted border-border" />
      </span>
      <span className={cn(gridNumericClass, cancelled && "line-through opacity-60")}>
        {row.end}
      </span>
    </div>
  );
}

function ColumnVisibilityMenu({ table }: { table: TanStackTable<FlightRow> }) {
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Visible columns</p>
        <DropdownMenuSeparator />
        {hideable.map((column) => (
          <DropdownMenuItem
            key={column.id}
            className="flex cursor-default items-center gap-2 py-2"
            onSelect={(e) => e.preventDefault()}
          >
            <Checkbox
              checked={column.getIsVisible()}
              onCheckedChange={(v) => column.toggleVisibility(!!v)}
              aria-label={COLUMN_LABELS[column.id] ?? column.id}
              className="hit-area-6"
            />
            <span className="text-sm leading-normal text-foreground">{COLUMN_LABELS[column.id] ?? column.id}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FlightsTable({ data }: { data: FlightRow[] }) {
  const { tokens } = useNeutralPlaygroundTable();
  const [rowData, setRowData] = useState(data);
  const [sorting, setSorting] = useState<SortingState>([{ id: "start", desc: false }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const { viewportRef, scrollRoot, scrolledX } = useEngineScrollViewport(true);

  useEffect(() => {
    setRowData(data);
  }, [data]);

  const columns = useMemo(
    () => [
      createSelectColumn(columnHelper, { mode: "index+checkbox", getRowLabel: (r) => r.code }),
      columnHelper.accessor("code", {
        id: "code",
        enableHiding: false,
        header: "Flight",
        cell: (info) => {
          const cancelled = info.row.original.status === "cancelled";
          return (
            <span className={cn(gridNumericClass, "font-medium", cancelled && "line-through opacity-60")}>
              {info.getValue()}
            </span>
          );
        },
      }),
      columnHelper.accessor("origin", {
        id: "origin",
        enableHiding: true,
        header: "Origin",
        cell: (info) => (
          <span className="whitespace-nowrap font-medium leading-normal text-foreground">{info.getValue() ?? "—"}</span>
        ),
      }),
      columnHelper.accessor("destination", {
        id: "destination",
        enableHiding: true,
        header: "Dest",
        cell: (info) => {
          const cancelled = info.row.original.status === "cancelled";
          return (
            <span className={cn("whitespace-nowrap font-medium leading-normal text-foreground", cancelled && "line-through opacity-60")}>
              {info.getValue()}
            </span>
          );
        },
      }),
      columnHelper.accessor("start", {
        id: "start",
        enableHiding: true,
        header: () => (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            Schedule <span className="text-xs text-primary">▲</span>
          </span>
        ),
        cell: ({ row }) => <TimelineCell row={row.original} />,
        sortingFn: "alphanumeric",
      }),
      columnHelper.accessor("duration", {
        id: "duration",
        enableHiding: true,
        header: "Dur",
        cell: (info) => (
          <span className={cn(gridNumericClass, "whitespace-nowrap text-muted-foreground")}>{info.getValue()}</span>
        ),
        sortingFn: "alphanumeric",
      }),
      columnHelper.accessor("status", {
        id: "status",
        enableHiding: true,
        header: "Status",
        cell: (info) => <FlightStatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor("aircraft", {
        id: "aircraft",
        enableHiding: true,
        header: "Eqp",
        cell: (info) => <span className={cn(cn(gridNumericClass, "font-medium"), "whitespace-nowrap")}>{info.getValue() ?? "—"}</span>,
      }),
      columnHelper.accessor("gate", {
        id: "gate",
        enableHiding: true,
        header: "Gate",
        cell: (info) => <span className={cn(cn(gridNumericClass, "text-muted-foreground"), "whitespace-nowrap")}>{info.getValue() ?? "—"}</span>,
      }),
      columnHelper.accessor("terminal", {
        id: "terminal",
        enableHiding: true,
        header: "Term",
        cell: (info) => <span className="whitespace-nowrap text-muted-foreground">{info.getValue() ?? "—"}</span>,
      }),
      columnHelper.accessor("stand", {
        id: "stand",
        enableHiding: true,
        header: "Stand",
        cell: (info) => <span className={cn(cn(gridNumericClass, "text-muted-foreground"), "whitespace-nowrap")}>{info.getValue() ?? "—"}</span>,
      }),
      columnHelper.accessor("pax", {
        id: "pax",
        enableHiding: true,
        header: () => <span className="block w-full whitespace-nowrap text-right">Pax</span>,
        cell: (info) => <div className={cn("text-right tabular-nums", cn(gridNumericClass, "text-muted-foreground"))}>{info.getValue() ?? "—"}</div>,
        sortingFn: "basic",
      }),
      columnHelper.accessor("crew", {
        id: "crew",
        enableHiding: true,
        header: () => <span className="block w-full whitespace-nowrap text-right">Crew</span>,
        cell: (info) => <div className={cn("text-right tabular-nums", cn(gridNumericClass, "text-muted-foreground"))}>{info.getValue() ?? "—"}</div>,
        sortingFn: "basic",
      }),
      columnHelper.accessor("delayMin", {
        id: "delayMin",
        enableHiding: true,
        header: () => <span className="block w-full whitespace-nowrap text-right">Delay</span>,
        cell: (info) => {
          const v = info.getValue() ?? 0;
          return (
            <div className={cn("text-right tabular-nums", v > 0 ? "font-medium text-primary" : cn(gridNumericClass, "text-muted-foreground"))}>
              {v ? `${v}m` : "—"}
            </div>
          );
        },
        sortingFn: "basic",
      }),
      columnHelper.accessor("loadPct", {
        id: "loadPct",
        enableHiding: true,
        header: () => <span className="block w-full whitespace-nowrap text-right">Load</span>,
        cell: (info) => {
          const v = info.getValue();
          return (
            <div className={cn("text-right tabular-nums", cn(gridNumericClass, "text-muted-foreground"))}>{v != null ? `${v}%` : "—"}</div>
          );
        },
        sortingFn: "basic",
      }),
      columnHelper.accessor("fuel1kKg", {
        id: "fuel1kKg",
        enableHiding: true,
        header: () => <span className="block w-full whitespace-nowrap text-right">Fuel</span>,
        cell: (info) => {
          const v = info.getValue();
          return <div className={cn("text-right tabular-nums", cn(gridNumericClass, "text-muted-foreground"))}>{v != null ? `${v}k` : "—"}</div>;
        },
        sortingFn: "basic",
      }),
      columnHelper.accessor("groundHandler", {
        id: "groundHandler",
        enableHiding: true,
        header: "Ground",
        cell: (info) => (
          <span className="max-w-[7rem] truncate text-muted-foreground" title={info.getValue() ?? ""}>
            {info.getValue() ?? "—"}
          </span>
        ),
      }),
      columnHelper.accessor("belt", {
        id: "belt",
        enableHiding: true,
        header: () => <span className="block w-full whitespace-nowrap text-right">Bag</span>,
        cell: (info) => <div className={cn("text-right", cn(gridNumericClass, "text-muted-foreground"))}>{info.getValue() ?? "—"}</div>,
      }),
      columnHelper.display({
        id: "ops",
        enableHiding: false,
        header: "",
        cell: ({ row }) =>
          row.getCanExpand() ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-expanded={row.getIsExpanded()}
              aria-label="Row details"
              onClick={row.getToggleExpandedHandler()}
            >
              ⌖
            </Button>
          ) : (
            <span className="inline-flex size-8 items-center justify-center text-muted-foreground/30" aria-hidden>
              ·
            </span>
          ),
      }),
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack useReactTable
  const table = useReactTable({
    ...withCoreSortingFiltered({
      data: rowData,
      columns,
      state: { sorting, expanded, rowSelection, columnVisibility, globalFilter },
      onSortingChange: setSorting,
      onExpandedChange: setExpanded,
      onRowSelectionChange: setRowSelection,
      onColumnVisibilityChange: setColumnVisibility,
      onGlobalFilterChange: setGlobalFilter,
      globalFilterFn: createGlobalFilterFn<FlightRow>(FLIGHT_GLOBAL_FILTER_KEYS),
      getRowId: (r) => r.id,
    }),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: (row) => Boolean(gateNotes[row.original.id]?.length),
  });
  const leafColumns = table.getVisibleLeafColumns();
  const pinnedLayout = usePlaygroundPinnedLayout({
    table,
    dataPinnedLeftIds: PINNED_DATA_COLUMN_IDS,
    selectColumnMode: "full",
    widthOverrides: PINNED_WIDTH_OVERRIDES,
    defaultWidth: 120,
  });
  const rows = table.getRowModel().rows;
  /** Larger initial window + step; hook already prefetches with `rootMargin` on the sentinel. */
  const { hasMore, resetVisibleRows, sentinelRef, visibleRows } = useInfiniteVisibleRows(rows, 40, 40, scrollRoot);

  useEffect(() => {
    resetVisibleRows();
  }, [data, resetVisibleRows, sorting, columnVisibility, globalFilter]);

  const sortableDrop = usePlaygroundSortableRowDropIndicator();

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search flights, gates, cities…"
            className="h-9 pl-9"
            aria-label="Search flights"
          />
        </div>
        <ColumnVisibilityMenu table={table} />
      </div>

      <EngineScrollTableShell
        viewportRef={viewportRef}
        className="max-h-[min(70dvh,560px)]"
        footer={
          <>
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{visibleRows.length}</span> of{" "}
              <span className="font-medium text-foreground">{rows.length}</span> in view
              {globalFilter.trim() ? (
                <>
                  {" "}
                  (<span className="font-medium text-foreground">{data.length}</span> total)
                </>
              ) : null}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasMore ? "Scroll to load more rows" : "All rows loaded"}
            </p>
          </>
        }
      >
        <div ref={sortableDrop.containerRef} className={sortableDrop.containerClassName}>
        <table className={cn(gridTableClass, "min-w-[1320px]")} style={{ width: table.getTotalSize() }}>
          <colgroup>
            {leafColumns.map((col) => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>
          <thead className={gridHeaderClass}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const id = header.column.id;
                  const pin = pinPlaygroundCell({
                    pinnedLayout,
                    columnId: id,
                    variant: "head",
                    scrolledX,
                    rowIndexGutter: id === "select",
                  });
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        gridHeadCellClass,
                        pin.className,
                        id === "select" && "min-w-9 max-w-[3.25rem]",
                        !pin.style && "bg-card",
                      )}
                      style={{ width: header.getSize(), ...pin.style }}
                      {...(pin["data-pinned"] ? { "data-pinned": true as const } : {})}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <Sortable
            value={rowData}
            onValueChange={setRowData}
            getItemValue={(r) => r.id}
            orientation="vertical"
            flatCursor
            {...sortableDrop.sortableProps}
          >
            <SortableContent withoutSlot>
              <tbody className={gridBodyHoverClass}>
                {visibleRows.map((row) => {
                  const cancelled = row.original.status === "cancelled";
                  return (
                    <Fragment key={row.id}>
                      <SortableItem
                        value={row.original.id}
                        asChild
                        asHandle
                        {...sortableDropTargetProps(row.original.id)}
                      >
                        <tr
                          data-state={row.getIsSelected() ? "selected" : undefined}
                          className={cn(
                            gridRowClass,
                            "group/row",
                            neutralTanStackRowFillClass(tokens, row.index),
                            cancelled && "[&>td:not([data-frozen])]:text-muted-foreground [&>td:not([data-frozen])]:opacity-75",
                          )}
                          {...playgroundTanStackRowStripeData(tokens, row.index)}
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
                                data-frozen={pin.style ? "" : undefined}
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
                      {row.getIsExpanded() && gateNotes[row.original.id] ? (
                        <tr className="hover:bg-transparent [&>td]:bg-muted/30">
                          <td
                            colSpan={row.getVisibleCells().length}
                            className={cn(gridCellClass, "p-4 text-sm text-muted-foreground")}
                          >
                            <ul className="list-inside list-disc space-y-1">
                              {gateNotes[row.original.id].map((n, i) => (
                                <li key={i}>{n}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </SortableContent>
            <SortableOverlay>
              {({ value }) => {
                const f = rowData.find((x) => x.id === value);
                return <SortableDragOverlay axis="row" label={f ? f.code : String(value)} />;
              }}
            </SortableOverlay>
          </Sortable>
        </table>
        {sortableDrop.indicator}
        {hasMore ? <div ref={sentinelRef} className="h-2 shrink-0" aria-hidden /> : null}
        </div>
      </EngineScrollTableShell>
    </div>
  );
}
