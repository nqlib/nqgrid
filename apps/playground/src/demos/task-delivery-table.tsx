import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ExpandedState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  FilterIcon,
  MoreVerticalIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@nqlib/nqui";
import { EMPTY_ROW_SELECTION, TreeIndent } from "@nqlib/nqgrid";
import { CanonicalSelectHeaderCell } from "../lib/playground-canonical-header-cell";
import {
  createSelectColumn,
  getSelectColumnMode,
  selectColumnRowHeaderProps,
  selectColumnTdClass,
} from "../lib/playground-canonical-select-column";
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
import { EngineScrollTableShell, useEngineScrollViewport } from "../parity/engine-scroll-table-shell";
import {
  createTaskDeliveryMockData,
  defaultTaskDeliveryExpanded,
  type TaskDeliveryRow,
  type TaskPriority,
  type TaskStatus,
} from "./task-delivery-mock-data";

export type { TaskDeliveryRow } from "./task-delivery-mock-data";

type TaskView = "all" | "active" | "backlog";

const PAGE_SIZES = [12, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 12;

/** Fixed-width columns — task column absorbs remaining viewport width. */
const FIXED_COLUMN_IDS = new Set(["select", "status", "assignee", "priority", "project", "actions"]);

const STATUS_LABEL: Record<TaskStatus, string> = {
  in_progress: "In progress",
  done: "Done",
  backlog: "Backlog",
};

const STATUS_DOT: Record<TaskStatus, string> = {
  in_progress: "bg-amber-500",
  done: "bg-emerald-500",
  backlog: "bg-muted-foreground/60",
};

const PRIORITY_CLASS: Record<TaskPriority, string> = {
  urgent: "text-destructive",
  high: "text-amber-600 dark:text-amber-400",
  medium: "text-violet-500 dark:text-violet-400",
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
};

type ActiveFilter =
  | { kind: "title"; value: string }
  | { kind: "status"; value: TaskStatus };

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function countRootTasks(rows: TaskDeliveryRow[]) {
  return rows.length;
}

function countByView(rows: TaskDeliveryRow[], view: TaskView) {
  if (view === "all") return rows.length;
  if (view === "active") return rows.filter((r) => r.bucket === "active").length;
  return rows.filter((r) => r.bucket === "backlog").length;
}

function filterByView(rows: TaskDeliveryRow[], view: TaskView): TaskDeliveryRow[] {
  if (view === "all") return rows;
  if (view === "active") return rows.filter((r) => r.bucket === "active");
  return rows.filter((r) => r.bucket === "backlog");
}

function rowMatchesFilters(row: TaskDeliveryRow, filters: ActiveFilter[]): boolean {
  return filters.every((f) => {
    if (f.kind === "title") {
      const q = f.value.toLowerCase();
      const inTitle = row.title.toLowerCase().includes(q);
      const inSub = row.subRows?.some((s) => s.title.toLowerCase().includes(q)) ?? false;
      return inTitle || inSub;
    }
    return row.status === f.value;
  });
}

function filterTree(rows: TaskDeliveryRow[], filters: ActiveFilter[]): TaskDeliveryRow[] {
  if (filters.length === 0) return rows;
  const out: TaskDeliveryRow[] = [];
  for (const row of rows) {
    const sub = row.subRows ? filterTree(row.subRows, filters) : undefined;
    const selfMatch = rowMatchesFilters(row, filters);
    const subMatch = (sub?.length ?? 0) > 0;
    if (!selfMatch && !subMatch) continue;
    out.push({
      ...row,
      subRows: sub?.length ? sub : selfMatch ? row.subRows : undefined,
    });
  }
  return out;
}

function StatusPill({ status }: { status: TaskStatus }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 text-[11px] font-medium leading-none">
      <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[status])} aria-hidden />
      <span className="truncate">{STATUS_LABEL[status]}</span>
    </span>
  );
}

function MetaPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 text-[11px] font-medium leading-none",
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

const columnHelper = createColumnHelper<TaskDeliveryRow>();

export function TaskDeliveryTable() {
  const { tokens } = useNeutralPlaygroundTable();
  const { viewportRef } = useEngineScrollViewport();
  const [tasks] = useState<TaskDeliveryRow[]>(() => createTaskDeliveryMockData());
  const [view, setView] = useState<TaskView>("all");
  const [expanded, setExpanded] = useState<ExpandedState>(() => defaultTaskDeliveryExpanded());
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [bulkStatus, setBulkStatus] = useState<TaskStatus>("in_progress");

  const viewData = useMemo(() => filterByView(tasks, view), [tasks, view]);
  const filteredData = useMemo(() => filterTree(viewData, activeFilters), [viewData, activeFilters]);

  const clearSelection = useCallback(() => setRowSelection(EMPTY_ROW_SELECTION), []);

  const columns = useMemo(
    () => [
      createSelectColumn(columnHelper, {
        mode: "checkbox",
        getRowLabel: (r) => r.title,
        selectAllScope: "page",
      }),
      columnHelper.accessor("title", {
        id: "task",
        header: "Task",
        size: 480,
        minSize: 280,
        cell: ({ row }) => {
          const task = row.original;
          const canExpand = row.getCanExpand();
          const isDone = task.status === "done";
          return (
            <div className="flex min-w-0 items-center gap-0.5">
              <TreeIndent depth={row.depth} />
              {canExpand ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  aria-expanded={row.getIsExpanded()}
                  aria-label={row.getIsExpanded() ? "Collapse subtasks" : "Expand subtasks"}
                  onClick={row.getToggleExpandedHandler()}
                >
                  <HugeiconsIcon
                    icon={row.getIsExpanded() ? ArrowUp01Icon : ArrowDown01Icon}
                    className="size-3.5 text-muted-foreground"
                    aria-hidden
                  />
                </Button>
              ) : (
                <span className="inline-block size-6 shrink-0" aria-hidden />
              )}
              <span
                className={cn(
                  "min-w-0 truncate text-xs leading-normal",
                  isDone ? "text-muted-foreground line-through" : "font-medium text-foreground",
                )}
              >
                {task.title}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor("status", {
        header: "Status",
        size: 112,
        cell: ({ getValue }) => <StatusPill status={getValue()} />,
      }),
      columnHelper.accessor("assignee", {
        header: "Assignee",
        size: 148,
        cell: ({ getValue }) => {
          const person = getValue();
          return (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="size-6 shrink-0">
                <AvatarImage src={person.image} alt="" />
                <AvatarFallback className="text-[10px]">{initials(person.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-xs">{person.name}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor("priority", {
        header: "Priority",
        size: 92,
        cell: ({ getValue }) => (
          <MetaPill className={cn("capitalize", PRIORITY_CLASS[getValue()])}>{PRIORITY_LABEL[getValue()]}</MetaPill>
        ),
      }),
      columnHelper.accessor("project", {
        header: "Project",
        size: 128,
        cell: ({ getValue }) => <MetaPill className="text-muted-foreground">{getValue()}</MetaPill>,
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        size: 40,
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Actions for ${row.original.title}`}
              >
                <HugeiconsIcon icon={MoreVerticalIcon} className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-xs">Open task</DropdownMenuItem>
              <DropdownMenuItem className="text-xs">Reassign</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs text-destructive focus:text-destructive">
                Archive task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, expanded, pagination, rowSelection },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getRowId: (r) => r.id,
    getSubRows: (r) => r.subRows,
    enableRowSelection: true,
    enableMultiRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    paginateExpandedRows: false,
  });

  const rootCount = countRootTasks(tasks);
  const filteredRootCount = table.getFilteredRowModel().flatRows.filter((r) => r.depth === 0).length;
  const selectedCount = table.getSelectedRowModel().rows.length;
  const pageRows = table.getRowModel().rows;
  const pageStart = filteredRootCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const pageEnd = Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredRootCount);
  const tableMinWidth = table.getTotalSize();
  const clearFilters = () => {
    setActiveFilters([]);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const filterLabel = (f: ActiveFilter) => {
    if (f.kind === "title") return `Task contains "${f.value}"`;
    return `Status is ${STATUS_LABEL[f.value]}`;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold tracking-tight">Task delivery</h2>
          <p className="text-xs text-muted-foreground tabular-nums">{rootCount} tasks</p>
        </div>
        <Button type="button" size="sm" className="h-8 shrink-0 gap-1.5">
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" aria-hidden />
          New task
        </Button>
      </div>

      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(v) => {
          if (v === "all" || v === "active" || v === "backlog") {
            setView(v);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }
        }}
        variant="outline"
        size="sm"
        className="w-fit shrink-0"
      >
        <ToggleGroupItem value="all" className="h-8 px-3 text-xs">
          All tasks
          <span className="ml-1.5 tabular-nums text-muted-foreground">{countByView(tasks, "all")}</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="active" className="h-8 px-3 text-xs">
          Active
          <span className="ml-1.5 tabular-nums text-muted-foreground">{countByView(tasks, "active")}</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="backlog" className="h-8 px-3 text-xs">
          Backlog
          <span className="ml-1.5 tabular-nums text-muted-foreground">{countByView(tasks, "backlog")}</span>
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-y border-border py-2">
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <HugeiconsIcon icon={FilterIcon} className="size-3.5" aria-hidden />
          Filters
        </Button>
        {activeFilters.map((f, i) => (
          <button
            key={`${f.kind}-${i}`}
            type="button"
            className="inline-flex max-w-[14rem] items-center gap-1 rounded-full border border-border/80 bg-muted/40 px-2.5 py-1 text-[11px] text-foreground outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              setActiveFilters((prev) => prev.filter((_, idx) => idx !== i));
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <span className="truncate">{filterLabel(f)}</span>
            <HugeiconsIcon icon={Cancel01Icon} className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        ))}
        {activeFilters.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
            Clear
          </Button>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
            Save view
          </Button>
          <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Table settings">
            <HugeiconsIcon icon={Settings01Icon} className="size-3.5" />
          </Button>
        </div>
      </div>

      {selectedCount > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-y border-border py-1.5 text-xs">
          <span className="font-medium tabular-nums">{selectedCount} selected</span>
          <Select
            value={bulkStatus}
            onValueChange={(v) => {
              if (v === "in_progress" || v === "done" || v === "backlog") setBulkStatus(v);
            }}
          >
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["in_progress", "done", "backlog"] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" className="h-7 text-xs">
            Update status
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
            Reassign
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      ) : null}

      <EngineScrollTableShell
        viewportRef={viewportRef}
        className="min-h-[min(68dvh,520px)] flex-1 max-h-[min(78dvh,680px)]"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
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
              {filteredRootCount === 0 ? "0 tasks" : `${pageStart}–${pageEnd} of ${filteredRootCount}`}
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
        {pageRows.length === 0 ? (
          <Empty className="min-h-[16rem] border-0 bg-transparent py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={FilterIcon} className="size-5" />
              </EmptyMedia>
              <EmptyTitle>No tasks match these filters</EmptyTitle>
              <EmptyDescription>Clear filters or switch tabs to see more work.</EmptyDescription>
            </EmptyHeader>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={clearFilters}>
              Clear filters
            </Button>
          </Empty>
        ) : (
          <table
            className={gridTableClass}
            style={{ width: "100%", minWidth: tableMinWidth, tableLayout: "fixed" }}
          >
            <colgroup>
              {table.getVisibleLeafColumns().map((col) => (
                <col
                  key={col.id}
                  style={
                    FIXED_COLUMN_IDS.has(col.id)
                      ? { width: col.getSize() }
                      : { minWidth: col.getSize() }
                  }
                />
              ))}
            </colgroup>
            <thead className={gridHeaderClass}>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => {
                    if (header.column.id === "select") {
                      return (
                        <CanonicalSelectHeaderCell
                          key={header.id}
                          header={header}
                          headClassName={gridHeadCellClass}
                        />
                      );
                    }
                    return (
                      <th
                        key={header.id}
                        className={cn(gridHeadCellClass, header.column.id === "actions" && "w-10")}
                        style={
                          FIXED_COLUMN_IDS.has(header.column.id)
                            ? { width: header.getSize() }
                            : undefined
                        }
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className={gridBodyHoverClass}>
              {pageRows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={cn(gridRowClass, "group/row", neutralTanStackRowFillClass(tokens, row.index))}
                  {...playgroundTanStackRowStripeData(tokens, row.index)}
                  data-depth={row.depth}
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
                        cell.column.id === "task" && "min-w-0",
                      )}
                      style={
                        FIXED_COLUMN_IDS.has(cell.column.id)
                          ? { width: cell.column.getSize() }
                          : undefined
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </EngineScrollTableShell>
    </div>
  );
}
