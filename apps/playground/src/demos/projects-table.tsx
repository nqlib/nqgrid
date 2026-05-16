import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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
  ScrollArea,
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
  TablePercentBattery,
  tableCellClass,
  tableDenseTypography,
  tableFooterClass,
  tableHeaderClass,
  tableHeadClass,
  tableNestedHeaderClass,
  tableNestedPanelClass,
  tableNumericMutedClass,
  tableNumericStrongClass,
  tableRowClass,
  tableScrollAreaContentClass,
  tableScrollAreaRootClass,
  tableScrollViewportStyle,
  tableShellClass,
  useInfiniteVisibleRows,
  type ProjectLeadPerson,
  type ProjectRow,
} from "@nqlib/nqgrid";
import { usePlaygroundTableSettings } from "../playground-table-settings";
import { usePlaygroundTableBodyClass } from "../playground-table-settings";

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

/** Nested mini-table body: same cell chrome as main grid but no row hover fill (avoids “empty” td area highlighting). */
const subtasksMiniTableBodyClass =
  "[&_td]:border-0 [&_td]:border-b [&_td]:border-border/40 [&_td]:bg-muted [&_tr:last-child_td]:border-b-0";

function SubtasksMiniTable({ data }: { data: ProjectRow["subtasks"] }) {
  return (
    <div className={cn(tableNestedPanelClass, "overflow-hidden")}>
      <table className={tableDenseTypography}>
        <TableHeader className={tableNestedHeaderClass}>
          <TableRow className={tableRowClass}>
            <TableHead className={cn(tableHeadClass, "h-9 w-10")}>Done</TableHead>
            <TableHead className={cn(tableHeadClass, "h-9")}>Subtask</TableHead>
            <TableHead className={cn(tableHeadClass, "h-9")}>Owner</TableHead>
            <TableHead className={cn(tableHeadClass, "h-9")}>Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className={subtasksMiniTableBodyClass}>
          {data.map((t) => (
            <TableRow key={t.id} className={tableRowClass}>
              <TableCell className={cn(tableCellClass, "py-2")}>
                <Checkbox checked={t.done} disabled aria-label={t.done ? "Done" : "Open"} className="hit-area-6" />
              </TableCell>
              <TableCell className={cn(tableCellClass, "py-2 text-foreground")}>{t.title}</TableCell>
              <TableCell className={cn(tableCellClass, "py-2")}>
                <span className="inline-flex p-0.5">
                  <PersonAvatarWithTooltip person={demoAssigneePerson(t.assignee)} />
                </span>
              </TableCell>
              <TableCell className={cn(tableCellClass, "py-2", tableNumericMutedClass)}>{t.due}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  );
}

function CommentsThread({ items }: { items: ProjectRow["comments"] }) {
  return (
    <ul className={cn(tableNestedPanelClass, "flex flex-col gap-2 p-3")}>
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
  const percentProgressDisplay = libraryConfig.styles?.percentProgressDisplay ?? "battery";
  const [sorting, setSorting] = useState<SortingState>([{ id: "updatedAt", desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const captureViewportRef = useCallback((node: HTMLDivElement | null) => {
    setScrollRoot(node);
  }, []);
  const tableBodyClassName = usePlaygroundTableBodyClass();

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
            onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
            aria-label="Select all rows"
            className="hit-area-6"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label={`Select ${row.original.name}`}
            className="hit-area-6"
          />
        ),
        size: 36,
      }),
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
          <span className={tableNumericMutedClass}>{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("budgetUsd", {
        header: () => <span className="w-full text-right">Budget</span>,
        cell: (info) => (
          <div className={cn("text-right", tableNumericStrongClass)}>
            {money.format(info.getValue())}
          </div>
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
            <div className={cn("text-right", tableNumericMutedClass)}>
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
    data,
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

  return (
    <div className={tableShellClass}>
      <ScrollArea
        orientation="both"
        fadeMask={false}
        className={tableScrollAreaRootClass}
        viewportRef={captureViewportRef}
        viewportStyle={tableScrollViewportStyle}
      >
        <div className={tableScrollAreaContentClass}>
        <table className={tableDenseTypography}>
          <TableHeader className={tableHeaderClass}>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className={tableRowClass}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      tableHeadClass,
                      header.column.id === "budgetUsd" || header.column.id === "progress" ? "text-right" : "",
                    )}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={tableBodyClassName}>
            {visibleRows.map((row) => (
              <Fragment key={row.id}>
                <TableRow data-state={row.getIsSelected() && "selected"} className={tableRowClass}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={tableCellClass}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {row.getIsExpanded() ? (
                  <TableRow
                    className={cn(
                      tableRowClass,
                      // Outer tbody uses `[&_tr:hover_td]:bg-accent`; match specificity so padding/gaps don’t flash accent.
                      "[&>td]:bg-card/40 hover:[&>td]:!bg-card/40",
                    )}
                  >
                    <TableCell colSpan={row.getVisibleCells().length} className="p-4">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-normal">
                            <HugeiconsIcon icon={TaskDaily01Icon} className="size-3.5" aria-hidden />
                            Subtasks
                          </p>
                          <SubtasksMiniTable data={row.original.subtasks} />
                        </div>
                        <div className="space-y-2">
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-normal">
                            <HugeiconsIcon icon={Comment01Icon} className="size-3.5" aria-hidden />
                            Comments
                          </p>
                          <CommentsThread items={row.original.comments} />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
        </table>
        {hasMore ? <div ref={sentinelRef} className="h-1 shrink-0" aria-hidden /> : null}
        </div>
      </ScrollArea>

      <div className={tableFooterClass}>
        <p className="text-sm leading-normal text-muted-foreground">
          {table.getSelectedRowModel().rows.length} selected · Showing {visibleRows.length} of {rows.length}
        </p>
        <p className="text-sm leading-normal text-muted-foreground">
          {hasMore ? "Scroll to load more rows" : "All rows loaded"}
        </p>
      </div>
    </div>
  );
}
