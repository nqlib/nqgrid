import { useCallback, useMemo, useState } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { Button, ScrollArea, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@nqlib/nqui";
import {
  buildRichColumnsFromDefs,
  tableCellClass,
  tableDenseTypography,
  tableHeaderClass,
  tableHeadClass,
  tableRowClass,
  tableScrollAreaContentClass,
  tableScrollAreaRootClass,
  tableScrollViewportStyle,
  tableShellClass,
  type RichSchemaColumnDef,
} from "@nqlib/nqgrid";
import { Gantt, type DepEdge, type ZoomUnit } from "@nqlib/nqgantt";

/** A task is one row of typed cells — the SAME shape the table and the gantt both consume. */
type GanttTask = {
  readonly id: string;
  title: string;
  status: "backlog" | "in_progress" | "review" | "done";
  assignee: string;
  /** `timeline` raw: the SSOT for the bar position. Drag in the gantt rewrites these dates. */
  span: { start: string; end: string };
};

const STATUS_MAP = {
  backlog: { label: "Backlog", backgroundColor: "#64748b", color: "#fff" },
  in_progress: { label: "In Progress", backgroundColor: "#f59e0b", color: "#fff" },
  review: { label: "Review", backgroundColor: "#6366f1", color: "#fff" },
  done: { label: "Done", backgroundColor: "#10b981", color: "#fff" },
} as const;

const INITIAL_TASKS: GanttTask[] = [
  { id: "t1", title: "Discovery & specs", status: "done", assignee: "Maya", span: { start: "2026-05-04", end: "2026-05-08" } },
  { id: "t2", title: "Schema + contract", status: "done", assignee: "Sam", span: { start: "2026-05-08", end: "2026-05-13" } },
  { id: "t3", title: "Engine build", status: "in_progress", assignee: "Sam", span: { start: "2026-05-13", end: "2026-05-22" } },
  { id: "t4", title: "Gantt projection", status: "in_progress", assignee: "Maya", span: { start: "2026-05-18", end: "2026-05-27" } },
  { id: "t5", title: "Review gate", status: "review", assignee: "Jordan", span: { start: "2026-05-27", end: "2026-05-27" } },
  { id: "t6", title: "Polish & ship", status: "backlog", assignee: "Jordan", span: { start: "2026-05-28", end: "2026-06-03" } },
];

/** Finish-to-start dependencies, stored as raw edges (routed by the view, not stored as pixels). */
const DEPENDENCIES: readonly DepEdge[] = [
  { from: "t1", to: "t2" },
  { from: "t2", to: "t3" },
  { from: "t3", to: "t4" },
  { from: "t4", to: "t5" },
  { from: "t5", to: "t6" },
];

const ZOOMS: ZoomUnit[] = ["day", "week", "month", "quarter"];

export function GanttTimelineDemo() {
  const [rows, setRows] = useState<GanttTask[]>(() => INITIAL_TASKS.map((t) => ({ ...t, span: { ...t.span } })));
  const [zoom, setZoom] = useState<ZoomUnit>("week");

  // One schema, two views. The table reads parse/format/style/compareKey; the gantt also
  // reads `toInterval` off the `timeline` column. Neither knows what "status" means.
  const schema = useMemo<RichSchemaColumnDef<GanttTask>[]>(
    () => [
      { id: "title", name: "Task", kind: "text", accessorKey: "title", width: 200 },
      {
        id: "status",
        name: "Status",
        kind: "status",
        accessorKey: "status",
        width: 140,
        map: STATUS_MAP,
        choiceOrder: ["backlog", "in_progress", "review", "done"],
        editable: true,
        onValueChange: ({ row, value }) =>
          setRows((prev) =>
            prev.map((r) => (r.id === row.id ? { ...r, status: value as GanttTask["status"] } : r)),
          ),
      },
      { id: "assignee", name: "Owner", kind: "text", accessorKey: "assignee", width: 120 },
      { id: "span", name: "Timeline", kind: "timeline", accessorKey: "span", width: 200 },
    ],
    [],
  );

  const columns = useMemo(() => buildRichColumnsFromDefs<GanttTask>(schema), [schema]);

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const getRowId = useCallback((r: GanttTask) => r.id, []);

  // Drag end commits new DATES back to the shared store — the table re-derives instantly.
  const onReschedule = useCallback(
    (rowId: string, next: { start: Date; end: Date }) =>
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? { ...r, span: { start: toISODate(next.start), end: toISODate(next.end) } }
            : r,
        ),
      ),
    [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        One typed task store, two projections. Edit <strong>Status</strong> in the grid → the bar recolors. Drag or
        resize a <strong>bar</strong> → the grid&apos;s Timeline updates. The diamond is a milestone (zero-width
        interval); arrows are finish-to-start dependencies. Sorting the <strong>Status</strong> column orders by
        workflow (Backlog → Done), not alphabetically.
      </p>

      <div className={tableShellClass} style={{ minHeight: "14rem", maxHeight: "22rem" }}>
        <ScrollArea
          orientation="horizontal"
          fadeMask={false}
          className={tableScrollAreaRootClass}
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
                        className={cn(tableHeadClass, "cursor-pointer select-none")}
                        style={{ width: header.getSize() }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted() as string] ?? ""}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className={tableRowClass}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={tableCellClass}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
        </ScrollArea>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Zoom</span>
        {ZOOMS.map((z) => (
          <Button
            key={z}
            size="sm"
            variant={z === zoom ? "default" : "outline"}
            className="h-7 px-2 text-xs capitalize"
            onClick={() => setZoom(z)}
          >
            {z}
          </Button>
        ))}
      </div>

      <div
        className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card"
        style={
          {
            "--nqgantt-surface": "var(--card)",
            "--nqgantt-border": "var(--border)",
            "--nqgantt-grid": "var(--border)",
            "--nqgantt-laneHeader": "var(--muted)",
            "--nqgantt-muted": "var(--muted-foreground)",
            "--nqgantt-dep": "var(--muted-foreground)",
          } as React.CSSProperties
        }
      >
        <Gantt<GanttTask>
          rows={rows}
          schema={schema}
          roles={{ labelColumnId: "title", colorColumnId: "status", laneColumnId: "assignee" }}
          getRowId={getRowId}
          dependencies={DEPENDENCIES}
          zoom={zoom}
          onReschedule={onReschedule}
          className="h-full text-foreground"
        />
      </div>
    </div>
  );
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
