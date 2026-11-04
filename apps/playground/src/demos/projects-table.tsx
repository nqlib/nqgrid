import { Fragment, useEffect, useMemo, useState } from "react";
import {
  type ExpandedState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon, Comment01Icon, TaskDaily01Icon } from "@hugeicons/core-free-icons";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@nqlib/nqui";
import {
  demoAssigneePerson,
  useInfiniteVisibleRows,
  type ProjectLeadPerson,
  type ProjectRow,
} from "@nqlib/nqgrid";
import { TablePercentBattery } from "../lib/nqgrid-styling";
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
import { usePlaygroundTableSettings } from "../playground-table-settings";
import { Sortable, SortableContent, SortableItem, SortableOverlay } from "@nqlib/nqui/sortable";

const columnHelper = createColumnHelper<ProjectRow>();

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function PersonAvatarWithTooltip({ person }: { person: ProjectLeadPerson }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="relative rounded-full border-2 border-background bg-background outline-none transition-transform hover:z-20 hover:scale-110 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={person.name}
        >
          <Avatar className="size-7">
            <AvatarImage src={person.image} alt={person.name} />
            <AvatarFallback className="text-xs font-medium">{initialsFromName(person.name)}</AvatarFallback>
          </Avatar>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs border-border/80 p-3 shadow-md">
        <div className="flex items-center gap-3">
          <Avatar className="size-14 shrink-0">
            <AvatarImage src={person.image} alt="" />
            <AvatarFallback className="text-sm">{initialsFromName(person.name)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium leading-snug text-foreground">{person.name}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function ProjectLeadsCell({ leads }: { leads: ProjectLeadPerson[] }) {
  if (leads.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const names = leads.map((p) => p.name).join(", ");
  return (
    <div className="flex -space-x-2 p-0.5" role="group" aria-label={`Leads: ${names}`}>
      {leads.map((person, i) => (
        <PersonAvatarWithTooltip key={`${person.name}-${i}`} person={person} />
      ))}
    </div>
  );
}

function statusVariant(s: ProjectRow["status"]) {
  if (s === "active") return "default" as const;
  if (s === "risk") return "destructive" as const;
  if (s === "paused") return "secondary" as const;
  return "outline" as const;
}

function SubtasksMiniTable({ data }: { data: ProjectRow["subtasks"] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/30 p-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Done</TableHead>
            <TableHead>Subtask</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <Checkbox checked={t.done} disabled aria-label={t.done ? "Done" : "Open"} className="hit-area-6" />
              </TableCell>
              <TableCell className="text-foreground">{t.title}</TableCell>
              <TableCell>
                <PersonAvatarWithTooltip person={demoAssigneePerson(t.assignee)} />
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">{t.due}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CommentsThread({ items }: { items: ProjectRow["comments"] }) {
  return (
    <ul className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
      {items.map((c) => (
        <li key={c.id} className="text-sm leading-normal">
          <span className="font-medium text-foreground">{c.author}</span>
          <span className="text-xs leading-normal text-muted-foreground"> · {c.at}</span>
          <p className="mt-0.5 text-sm text-muted-foreground">{c.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function ProjectsTable({ data }: { data: ProjectRow[] }) {
  const { libraryConfig } = usePlaygroundTableSettings();
  const { tokens } = useNeutralPlaygroundTable();
  const percentProgressDisplay = libraryConfig.styles?.percentProgressDisplay ?? "battery";
  const [rowData, setRowData] = useState(data);
  const [sorting, setSorting] = useState<SortingState>([{ id: "updatedAt", desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const { viewportRef, scrollRoot } = useEngineScrollViewport();

  useEffect(() => {
    setRowData(data);
  }, [data]);

  const columns = useMemo(
    () => [
      createSelectColumn(columnHelper, { mode: "index+checkbox", getRowLabel: (r) => r.name }),
      columnHelper.accessor("name", {
        header: "Project",
        cell: (info) => <span className="font-medium leading-normal text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => (
          <Badge variant={statusVariant(info.getValue())} className="text-xs font-medium capitalize leading-normal">
            {info.getValue().replace(/_/g, " ")}
          </Badge>
        ),
      }),
      columnHelper.accessor((row) => row.leads.map((p) => p.name).join(", "), {
        id: "lead",
        header: "Lead",
        cell: ({ row }) => <ProjectLeadsCell leads={row.original.leads} />,
      }),
      columnHelper.accessor("updatedAt", {
        header: "Updated",
        cell: (info) => (
          <span className={cn(gridNumericClass, "text-muted-foreground")}>{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("budgetUsd", {
        header: () => <span className="w-full text-right">Budget</span>,
        cell: (info) => (
          <div className={cn("text-right tabular-nums font-medium")}>{money.format(info.getValue())}</div>
        ),
      }),
      columnHelper.accessor("progress", {
        header: () => <span className="w-full text-right">%</span>,
        cell: (info) => {
          const raw = info.getValue();
          const n = typeof raw === "number" ? raw : Number(raw);
          if (percentProgressDisplay === "battery") {
            return <TablePercentBattery value={n} />;
          }
          return (
            <div className={cn("text-right tabular-nums text-muted-foreground")}>
              {Number.isFinite(n) ? Math.round(n) : "—"}%
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "expand",
        header: "",
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-expanded={row.getIsExpanded()}
            aria-label={row.getIsExpanded() ? "Collapse row" : "Expand row"}
            onClick={row.getToggleExpandedHandler()}
          >
            <HugeiconsIcon
              icon={row.getIsExpanded() ? ArrowUp01Icon : ArrowDown01Icon}
              className="size-4 text-muted-foreground"
              aria-hidden
            />
          </Button>
        ),
        size: 40,
      }),
    ],
    [percentProgressDisplay],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack useReactTable
  const table = useReactTable({
    data: rowData,
    columns,
    state: { sorting, rowSelection, expanded },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });
  const rows = table.getRowModel().rows;
  const { hasMore, resetVisibleRows, sentinelRef, visibleRows } = useInfiniteVisibleRows(rows, 6, 6, scrollRoot);

  useEffect(() => {
    resetVisibleRows();
  }, [data, resetVisibleRows, sorting]);

  const sortableDrop = usePlaygroundSortableRowDropIndicator();

  return (
    <EngineScrollTableShell
      viewportRef={viewportRef}
      className="max-h-[min(60dvh,480px)]"
      footer={
        <>
          <p className="text-sm text-muted-foreground">
            {table.getSelectedRowModel().rows.length} selected · Showing {visibleRows.length} of {rows.length}
          </p>
          <p className="text-sm text-muted-foreground">
            {hasMore ? "Scroll to load more rows" : "All rows loaded"}
          </p>
        </>
      }
    >
      <div ref={sortableDrop.containerRef} className={sortableDrop.containerClassName}>
      <table className={gridTableClass} style={{ width: table.getTotalSize() }}>
        <colgroup>
          {table.getVisibleLeafColumns().map((col) => (
            <col key={col.id} style={{ width: col.getSize() }} />
          ))}
        </colgroup>
        <thead className={gridHeaderClass}>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className={cn(
                    gridHeadCellClass,
                    (header.column.id === "budgetUsd" || header.column.id === "progress") && "text-right",
                    header.column.id === "select" && "min-w-9 max-w-[3.25rem]",
                  )}
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
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
              {visibleRows.map((row) => (
                <Fragment key={row.id}>
                  <SortableItem
                    value={row.original.id}
                    asChild
                    asHandle
                    {...sortableDropTargetProps(row.original.id)}
                  >
                    <tr
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      className={cn(gridRowClass, "group/row", neutralTanStackRowFillClass(tokens, row.index))}
                      {...playgroundTanStackRowStripeData(tokens, row.index)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn(gridCellClass, cell.column.id === "select" && "min-w-0 align-middle")}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  </SortableItem>
                  {row.getIsExpanded() ? (
                    <tr className="hover:bg-transparent [&>td]:bg-muted/30">
                      <td colSpan={row.getVisibleCells().length} className={cn(gridCellClass, "p-4")}>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-2">
                            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <HugeiconsIcon icon={TaskDaily01Icon} className="size-3.5" aria-hidden />
                              Subtasks
                            </p>
                            <SubtasksMiniTable data={row.original.subtasks} />
                          </div>
                          <div className="space-y-2">
                            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <HugeiconsIcon icon={Comment01Icon} className="size-3.5" aria-hidden />
                              Comments
                            </p>
                            <CommentsThread items={row.original.comments} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </SortableContent>
          <SortableOverlay>
            {({ value }) => {
              const p = rowData.find((x) => x.id === value);
              return <SortableDragOverlay axis="row" label={p?.name ?? String(value)} />;
            }}
          </SortableOverlay>
        </Sortable>
      </table>
      {sortableDrop.indicator}
      {hasMore ? <div ref={sentinelRef} className="h-1 shrink-0" aria-hidden /> : null}
      </div>
    </EngineScrollTableShell>
  );
}
