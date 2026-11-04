import { useCallback, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getPaginationRowModel,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnSizingState,
  type VisibilityState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type Table as TanStackTable,
  useReactTable,
} from "@tanstack/react-table";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  MoreVerticalIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@nqlib/nqui";
import { Sortable, SortableContent, SortableItem, SortableOverlay } from "@nqlib/nqui/sortable";
import {
  EMPTY_ROW_SELECTION,
  createGlobalFilterFn,
  demoLeadPerson,
  type ProjectLeadPerson,
  withCoreSortingFiltered,
} from "@nqlib/nqgrid";
import {
  CanonicalHeaderCell,
  CanonicalSelectHeaderCell,
} from "../lib/playground-canonical-header-cell";
import {
  createSelectColumn,
  dataColumnOrder,
  getSelectColumnMode,
  selectColumnRowHeaderProps,
  selectColumnTdClass,
  stopSortableChain,
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
  gridNumericClass,
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

type TicketStatus = "open" | "pending" | "resolved";
type TicketPriority = "urgent" | "high" | "low";
type TicketQueue = "platform" | "billing" | "authentication" | "integrations";

type SlaTone = "breached" | "warning" | "ok";

export type SupportTicketRow = {
  id: string;
  ticketId: string;
  title: string;
  openedLabel: string;
  requester: ProjectLeadPerson;
  company: string;
  queue: TicketQueue;
  priority: TicketPriority;
  slaLabel: string;
  slaHint?: string;
  slaTone: SlaTone;
  status: TicketStatus;
  owner?: string;
  unassigned: boolean;
  nearSla: boolean;
};

const AGENTS: ProjectLeadPerson[] = [
  demoLeadPerson("Maya Chen"),
  demoLeadPerson("Sam Okonkwo"),
  demoLeadPerson("Jordan Lee"),
  demoLeadPerson("Alex Rivera"),
];

const MOCK_TICKETS: SupportTicketRow[] = [
  {
    id: "t1",
    ticketId: "SUP-1831",
    title: "Webhook signatures stop validating after key rotation",
    openedLabel: "2h ago",
    requester: demoLeadPerson("Theo Vincent"),
    company: "Atlas Fleet",
    queue: "platform",
    priority: "urgent",
    slaLabel: "Breached 14m",
    slaHint: "Immediate",
    slaTone: "breached",
    status: "pending",
    unassigned: false,
    nearSla: true,
    owner: "Maya Chen",
  },
  {
    id: "t2",
    ticketId: "SUP-1842",
    title: "SSO claims fail after Okta certificate rotation",
    openedLabel: "36m ago",
    requester: demoLeadPerson("Jordan Park"),
    company: "Northstar Labs",
    queue: "authentication",
    priority: "urgent",
    slaLabel: "28m left",
    slaTone: "warning",
    status: "pending",
    unassigned: true,
    nearSla: true,
  },
  {
    id: "t3",
    ticketId: "SUP-1827",
    title: "Duplicate invoices after usage reconciliation job",
    openedLabel: "4h ago",
    requester: demoLeadPerson("Priya Shah"),
    company: "Helio Commerce",
    queue: "billing",
    priority: "high",
    slaLabel: "1h 12m left",
    slaTone: "warning",
    status: "open",
    unassigned: false,
    nearSla: true,
    owner: "Sam Okonkwo",
  },
  {
    id: "t4",
    ticketId: "SUP-1819",
    title: "Slack alert channel returns 403 for new workspace",
    openedLabel: "6h ago",
    requester: demoLeadPerson("Riley Park"),
    company: "Signal Ops",
    queue: "integrations",
    priority: "high",
    slaLabel: "Under SLA",
    slaTone: "ok",
    status: "resolved",
    unassigned: false,
    nearSla: false,
    owner: "Alex Rivera",
  },
  {
    id: "t5",
    ticketId: "SUP-1814",
    title: "Rate limit headers missing on export endpoint",
    openedLabel: "8h ago",
    requester: demoLeadPerson("Maya Chen"),
    company: "Quanta Systems",
    queue: "platform",
    priority: "low",
    slaLabel: "4h 20m left",
    slaTone: "ok",
    status: "open",
    unassigned: true,
    nearSla: false,
  },
  {
    id: "t6",
    ticketId: "SUP-1808",
    title: "Annual plan proration shows negative line item",
    openedLabel: "11h ago",
    requester: demoLeadPerson("Alex Rivera"),
    company: "Brightline",
    queue: "billing",
    priority: "high",
    slaLabel: "Breached 42m",
    slaTone: "breached",
    status: "pending",
    unassigned: false,
    nearSla: true,
    owner: "Jordan Lee",
  },
  {
    id: "t7",
    ticketId: "SUP-1801",
    title: "SCIM deprovision leaves stale seat count",
    openedLabel: "1d ago",
    requester: demoLeadPerson("Sam Okonkwo"),
    company: "Northwind",
    queue: "authentication",
    priority: "low",
    slaLabel: "6h left",
    slaTone: "ok",
    status: "open",
    unassigned: false,
    nearSla: false,
    owner: "Maya Chen",
  },
  {
    id: "t8",
    ticketId: "SUP-1796",
    title: "HubSpot sync stalls on custom object mapping",
    openedLabel: "1d ago",
    requester: demoLeadPerson("Jordan Lee"),
    company: "Relay CRM",
    queue: "integrations",
    priority: "high",
    slaLabel: "22m left",
    slaTone: "warning",
    status: "pending",
    unassigned: false,
    nearSla: true,
    owner: "Sam Okonkwo",
  },
  {
    id: "t9",
    ticketId: "SUP-1790",
    title: "Audit log export truncates at 10k events",
    openedLabel: "2d ago",
    requester: demoLeadPerson("Chen Wei"),
    company: "Ledgerly",
    queue: "platform",
    priority: "low",
    slaLabel: "On track",
    slaTone: "ok",
    status: "resolved",
    unassigned: false,
    nearSla: false,
    owner: "Alex Rivera",
  },
  {
    id: "t10",
    ticketId: "SUP-1784",
    title: "Tax ID validation fails for EU entities",
    openedLabel: "2d ago",
    requester: demoLeadPerson("Maya Chen"),
    company: "Orbital Pay",
    queue: "billing",
    priority: "urgent",
    slaLabel: "Breached 2h",
    slaTone: "breached",
    status: "open",
    unassigned: false,
    nearSla: true,
    owner: "Jordan Lee",
  },
  {
    id: "t11",
    ticketId: "SUP-1778",
    title: "MFA backup codes not emailed on enrollment",
    openedLabel: "3d ago",
    requester: demoLeadPerson("Riley Park"),
    company: "SecureStack",
    queue: "authentication",
    priority: "high",
    slaLabel: "19m left",
    slaTone: "warning",
    status: "pending",
    unassigned: false,
    nearSla: true,
    owner: "Maya Chen",
  },
];

const FILTER_KEYS = [
  "ticketId",
  "title",
  "company",
  "queue",
  "priority",
  "status",
  "owner",
] as const satisfies readonly (keyof SupportTicketRow)[];

const PAGE_SIZES = [10, 12, 15] as const;
const DEFAULT_PAGE_SIZE = 12;

const columnHelper = createColumnHelper<SupportTicketRow>();
const bundle = playgroundSpreadsheetBundle;

const DEFAULT_COLUMN_ORDER: ColumnOrderState = [
  "select",
  "ticket",
  "requester",
  "queue",
  "priority",
  "sla",
  "status",
  "actions",
];

const QUEUE_LABEL: Record<TicketQueue, string> = {
  platform: "Platform",
  billing: "Billing",
  authentication: "Auth",
  integrations: "Integrations",
};

const PRIORITY_CLASS: Record<TicketPriority, string> = {
  urgent: "font-medium text-destructive",
  high: "font-medium text-amber-600 dark:text-amber-400",
  low: "text-muted-foreground",
};

const STATUS_DOT: Record<TicketStatus, string> = {
  open: "bg-sky-500",
  pending: "bg-amber-500",
  resolved: "bg-emerald-500",
};

const SLA_CLASS: Record<SlaTone, string> = {
  breached: "font-medium text-destructive",
  warning: "font-medium text-amber-600 dark:text-amber-400",
  ok: "text-muted-foreground",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ColumnVisibilityMenu({ table }: { table: TanStackTable<SupportTicketRow> }) {
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs">
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {hideable.map((column) => (
          <DropdownMenuItem
            key={column.id}
            className="flex cursor-default items-center gap-2 text-xs"
            onSelect={(e) => e.preventDefault()}
          >
            <Checkbox
              checked={column.getIsVisible()}
              onCheckedChange={(v) => column.toggleVisibility(!!v)}
              aria-label={column.id}
              className="hit-area-6"
            />
            <span className="capitalize">{column.id}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SupportQueueTable() {
  const { tokens } = useNeutralPlaygroundTable();
  const { viewportRef } = useEngineScrollViewport();
  const [rowData, setRowData] = useState(MOCK_TICKETS);
  const [sorting, setSorting] = useState<SortingState>([{ id: "sla", desc: false }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({ t1: true, t2: true });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(DEFAULT_COLUMN_ORDER);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [queueFilter, setQueueFilter] = useState<"all" | TicketQueue>("all");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [bulkOwner, setBulkOwner] = useState<string>(AGENTS[0]!.name);
  const [bulkStatus, setBulkStatus] = useState<TicketStatus>("open");

  const columns = useMemo(
    () => [
      createSelectColumn(columnHelper, {
        mode: "checkbox",
        getRowLabel: (r) => r.ticketId,
        selectAllScope: "page",
      }),
      columnHelper.accessor("title", {
        id: "ticket",
        header: "Ticket",
        size: 280,
        minSize: 180,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.title}</p>
            <p className="truncate text-[11px] text-muted-foreground tabular-nums">
              {row.original.ticketId} · {row.original.openedLabel}
              {row.original.unassigned ? " · Unassigned" : ""}
            </p>
          </div>
        ),
      }),
      columnHelper.display({
        id: "requester",
        header: "Requester",
        size: 152,
        minSize: 120,
        cell: ({ row }) => {
          const person = row.original.requester;
          return (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="size-6 shrink-0">
                <AvatarImage src={person.image} alt="" />
                <AvatarFallback className="text-[10px]">{initials(person.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 leading-tight">
                <p className="truncate font-medium">{person.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{row.original.company}</p>
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor("queue", {
        header: "Queue",
        size: 96,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{QUEUE_LABEL[getValue()]}</span>
        ),
      }),
      columnHelper.accessor("priority", {
        header: "Pri",
        size: 64,
        cell: ({ getValue }) => (
          <span className={cn("capitalize", PRIORITY_CLASS[getValue()])}>{getValue()}</span>
        ),
      }),
      columnHelper.accessor("slaLabel", {
        id: "sla",
        header: () => <span className="w-full text-right">SLA</span>,
        size: 108,
        sortingFn: "alphanumeric",
        cell: ({ row }) => (
          <span className={cn("block w-full text-right tabular-nums", SLA_CLASS[row.original.slaTone])}>
            {row.original.slaLabel}
          </span>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        size: 88,
        cell: ({ getValue }) => (
          <span className="inline-flex min-w-0 items-center gap-1.5 capitalize">
            <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[getValue()])} aria-hidden />
            {getValue()}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        enableResizing: false,
        size: 40,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Actions for ${row.original.ticketId}`}
                onPointerDown={stopSortableChain}
                onMouseDown={stopSortableChain}
              >
                <HugeiconsIcon icon={MoreVerticalIcon} className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-xs">Open ticket</DropdownMenuItem>
              <DropdownMenuItem className="text-xs">Assign owner</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs text-destructive focus:text-destructive">
                Close ticket
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    ...withCoreSortingFiltered({
      data: rowData,
      columns,
      state: {
        sorting,
        rowSelection,
        columnVisibility,
        globalFilter,
        pagination,
        columnFilters,
        columnOrder,
        columnSizing,
      },
      onSortingChange: setSorting,
      onRowSelectionChange: setRowSelection,
      onColumnVisibilityChange: setColumnVisibility,
      onGlobalFilterChange: setGlobalFilter,
      onPaginationChange: setPagination,
      onColumnFiltersChange: setColumnFilters,
      onColumnOrderChange: setColumnOrder,
      onColumnSizingChange: setColumnSizing,
      globalFilterFn: createGlobalFilterFn<SupportTicketRow>(FILTER_KEYS),
      enableRowSelection: true,
      enableMultiRowSelection: true,
      enableColumnResizing: true,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 56, maxSize: 400, size: 100 },
      getRowId: (r) => r.id,
    }),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const sortableColumnIds = useMemo(() => dataColumnOrder(columnOrder), [columnOrder]);
  const onColumnReorder = useCallback((next: string[]) => {
    setColumnOrder(["select", ...next]);
  }, []);
  const sortableDrop = usePlaygroundSortableTableDropIndicators();

  const filteredRows = table.getFilteredRowModel().rows;
  const selectedCount = table.getSelectedRowModel().rows.length;
  const unassignedCount = filteredRows.filter((r) => r.original.unassigned).length;
  const nearSlaCount = filteredRows.filter((r) => r.original.nearSla).length;

  const clearSelection = useCallback(() => setRowSelection(EMPTY_ROW_SELECTION), []);

  const pageCount = table.getPageCount();
  const pageStart = filteredRows.length === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const pageEnd = Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredRows.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <p className="mr-auto text-xs text-muted-foreground tabular-nums">
          {filteredRows.length} tickets · {unassignedCount} unassigned · {nearSlaCount} near SLA
        </p>
        <Button type="button" size="sm" className="h-8 gap-1.5 shrink-0">
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" aria-hidden />
          New ticket
        </Button>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            placeholder="Search tickets…"
            className="h-8 pl-8 text-xs"
            aria-label="Search tickets"
          />
        </div>
        <Select
          value={queueFilter}
          onValueChange={(v) => {
            if (v === "all" || v in QUEUE_LABEL) {
              const next = v as "all" | TicketQueue;
              setQueueFilter(next);
              setColumnFilters(next === "all" ? [] : [{ id: "queue", value: next }]);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }
          }}
        >
          <SelectTrigger className="h-8 w-[9.5rem] text-xs">
            <SelectValue placeholder="All queues" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All queues</SelectItem>
            {(Object.keys(QUEUE_LABEL) as TicketQueue[]).map((q) => (
              <SelectItem key={q} value={q}>
                {QUEUE_LABEL[q]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ColumnVisibilityMenu table={table} />
      </div>

      {selectedCount > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-y border-border py-1.5 text-xs">
          <span className="font-medium tabular-nums">
            {selectedCount} selected
          </span>
          <Select value={bulkOwner} onValueChange={setBulkOwner}>
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGENTS.map((a) => (
                <SelectItem key={a.name} value={a.name}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
            Assign
          </Button>
          <Select
            value={bulkStatus}
            onValueChange={(v) => {
              if (v === "open" || v === "pending" || v === "resolved") setBulkStatus(v);
            }}
          >
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["open", "pending", "resolved"] as const).map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" className="h-7 text-xs">
            Update
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      ) : null}

      <EngineScrollTableShell
        viewportRef={viewportRef}
        className="flex-1 min-h-[min(68dvh,600px)] max-h-[min(78dvh,720px)]"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Rows</span>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(v) => {
                  const size = Number(v);
                  if (PAGE_SIZES.includes(size as (typeof PAGE_SIZES)[number])) {
                    setPagination({ pageIndex: 0, pageSize: size });
                  }
                }}
              >
                <SelectTrigger className="h-7 w-14 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="tabular-nums">
              {filteredRows.length === 0 ? "0 rows" : `${pageStart}–${pageEnd} of ${filteredRows.length}`}
              {" · "}Page {pagination.pageIndex + 1} of {pageCount}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" aria-hidden />
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        }
      >
        <div ref={sortableDrop.containerRef} className={sortableDrop.containerClassName}>
        <table className={gridTableClass} style={{ width: table.getTotalSize(), tableLayout: "fixed" }}>
          <colgroup>
            {table.getVisibleLeafColumns().map((col) => (
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
                        return (
                          <CanonicalSelectHeaderCell
                            key={header.id}
                            header={header}
                            headClassName={gridHeadCellClass}
                          />
                        );
                      }
                      if (id === "actions") {
                        return (
                          <th
                            key={header.id}
                            className={cn(gridHeadCellClass, "bg-card w-10")}
                            style={{ width: header.getSize() }}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        );
                      }
                      return (
                        <SortableItem key={header.id} value={id} asChild asHandle {...sortableDropTargetProps(id)}>
                          <CanonicalHeaderCell
                            header={header}
                            bundle={bundle}
                            headClassName={gridHeadCellClass}
                            numeric={id === "sla"}
                            sortable={header.column.getCanSort()}
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
                <SortableDragOverlay axis="column" label={String(value)} className="capitalize" />
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
                {table.getRowModel().rows.map((row) => (
                  <SortableItem
                    key={row.id}
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
                      )}
                      {...playgroundTanStackRowStripeData(tokens, row.index)}
                      title="Tap checkbox to select · drag row to reorder · ⌘/Ctrl-click to select"
                      onClick={(e) => {
                        if (!e.metaKey && !e.ctrlKey) return;
                        e.preventDefault();
                        row.toggleSelected();
                      }}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const mode = getSelectColumnMode(cell.column);
                        return (
                        <td
                          key={cell.id}
                          {...selectColumnRowHeaderProps(mode)}
                          className={cn(
                            selectColumnTdClass(mode, gridCellClass),
                            cell.column.id === "sla" && gridNumericClass,
                          )}
                          style={{ width: cell.column.getSize() }}
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
                const t = rowData.find((x) => x.id === value);
                return (
                  <SortableDragOverlay
                    axis="row"
                    className="max-w-xs"
                    label={t ? t.ticketId : String(value)}
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
