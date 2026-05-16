import { useMemo, useRef, useState } from "react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Input, ScrollArea, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@nqlib/nqui";
import {
  TablePercentBattery,
  buildRichColumnFromDef,
  buildRichColumnsFromDefs,
  demoAssigneePerson,
  tableCellClass,
  tableDenseTypography,
  tableFooterClass,
  tableHeaderClass,
  tableHeadClass,
  tableRowClass,
  tableScrollAreaContentClass,
  tableScrollAreaRootClass,
  tableScrollViewportStyle,
  tableShellClass,
  type ProjectLeadPerson,
  type RichSchemaColumnDef,
} from "@nqlib/nqgrid";
import { PlaygroundPeopleComboboxCell } from "./playground-people-combobox-cell";
import { usePlaygroundTableBodyClass } from "../playground-table-settings";

/** Roster keys must match row `leads` — use {@link reconcileRichPeopleWithRoster} / name-only ids (see repo rule). */
const TASK_TEAM_DIRECTORY: ProjectLeadPerson[] = ["ada", "ben", "chen", "maya", "jordan"].map((nick) =>
  demoAssigneePerson(nick),
);

type TaskStatus = "todo" | "in_progress" | "done";

export type TaskRow = {
  readonly id: string;
  title: string;
  status: TaskStatus;
  progress: number;
  leads: ProjectLeadPerson[];
};

const INITIAL_TASKS: TaskRow[] = [
  {
    id: "t1",
    title: "Design review",
    status: "in_progress",
    progress: 61,
    leads: [{ ...TASK_TEAM_DIRECTORY[0]! }, { ...TASK_TEAM_DIRECTORY[1]! }],
  },
  {
    id: "t2",
    title: "API contract",
    status: "todo",
    progress: 12,
    leads: [{ ...TASK_TEAM_DIRECTORY[0]! }],
  },
  {
    id: "t3",
    title: "QA sign-off",
    status: "done",
    progress: 100,
    leads: [{ ...TASK_TEAM_DIRECTORY[2]! }],
  },
];

type EditTarget = { readonly rowId: string; readonly columnId: string };

export function RichInlineTasksDemo() {
  const [rows, setRows] = useState<TaskRow[]>(() => INITIAL_TASKS.map((r) => ({ ...r, leads: [...r.leads] })));
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const escapeCancelRef = useRef(false);
  const tableBodyClassName = usePlaygroundTableBodyClass();

  const columns = useMemo(() => {
    const locale = typeof navigator !== "undefined" ? navigator.language : undefined;
    const richConfig = {
      locale,
      defaultLocale: locale,
      renderPeoplePicker: PlaygroundPeopleComboboxCell,
    } as const;

    const titleDef: RichSchemaColumnDef<TaskRow> = {
      kind: "custom",
      id: "title",
      name: "Task",
      header: "Task",
      accessorKey: "title",
      width: 260,
      cell: (ctx) => {
        const row = ctx.row.original;
        const isEd = editing?.rowId === row.id && editing?.columnId === "title";
        if (isEd) {
          return (
            <Input
              key={`${row.id}-title-edit`}
              aria-label="Edit task title"
              className="h-8"
              defaultValue={row.title}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  escapeCancelRef.current = true;
                  setEditing(null);
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onBlur={(e) => {
                if (escapeCancelRef.current) {
                  escapeCancelRef.current = false;
                  return;
                }
                const next = e.target.value.trim();
                setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, title: next || r.title } : r)));
                setEditing(null);
              }}
            />
          );
        }
        return (
          <button
            type="button"
            className="w-full max-w-full truncate text-left text-sm font-medium leading-normal text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            onDoubleClick={() => setEditing({ rowId: row.id, columnId: "title" })}
          >
            {row.title}
          </button>
        );
      },
    };

    const progressDef: RichSchemaColumnDef<TaskRow> = {
      kind: "custom",
      id: "progress",
      name: "%",
      header: "%",
      accessorKey: "progress",
      width: 120,
      cell: (ctx) => {
        const row = ctx.row.original;
        const isEd = editing?.rowId === row.id && editing?.columnId === "progress";
        const n = Number(ctx.getValue());
        if (isEd) {
          return (
            <Input
              key={`${row.id}-progress-edit`}
              type="number"
              min={0}
              max={100}
              aria-label="Edit progress percent"
              className="h-8 text-right tabular-nums"
              defaultValue={Number.isFinite(n) ? String(Math.round(n)) : "0"}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  escapeCancelRef.current = true;
                  setEditing(null);
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onBlur={(e) => {
                if (escapeCancelRef.current) {
                  escapeCancelRef.current = false;
                  return;
                }
                const raw = Number(e.target.value);
                const clamped = Number.isFinite(raw) ? Math.min(100, Math.max(0, Math.round(raw))) : row.progress;
                setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, progress: clamped } : r)));
                setEditing(null);
              }}
            />
          );
        }
        return (
          <button
            type="button"
            className="block w-full text-right outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onDoubleClick={() => setEditing({ rowId: row.id, columnId: "progress" })}
          >
            <TablePercentBattery value={n} />
          </button>
        );
      },
    };

    const [statusCol] = buildRichColumnsFromDefs<TaskRow>(
      [
        {
          id: "status",
          name: "Status",
          kind: "status",
          accessorKey: "status",
          width: 148,
          map: {
            todo: { label: "To do", variant: "outline" },
            in_progress: { label: "In progress", variant: "default" },
            done: { label: "Done", variant: "secondary" },
          },
          choiceOrder: ["todo", "in_progress", "done"],
          editable: true,
          onValueChange: ({ row, value }) => {
            setRows((prev) =>
              prev.map((r) =>
                r.id === row.id ? { ...r, status: value as TaskRow["status"] } : r,
              ),
            );
          },
        },
      ],
      richConfig,
    );

    const peopleCol = buildRichColumnFromDef<TaskRow>(
      {
        id: "people",
        name: "People",
        kind: "people",
        accessorKey: "leads",
        width: 260,
        max: 6,
        editable: true,
        pickerOptions: TASK_TEAM_DIRECTORY,
        onValueChange: ({ row, value }) => {
          setRows((prev) =>
            prev.map((r) => (r.id === row.id ? { ...r, leads: [...value] as ProjectLeadPerson[] } : r)),
          );
        },
      },
      richConfig,
    );

    return [
      buildRichColumnFromDef(titleDef, richConfig),
      statusCol,
      buildRichColumnFromDef(progressDef, richConfig),
      peopleCol,
    ];
  }, [editing]);

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        <strong>Status</strong> uses a dropdown; double-click <strong>task</strong> or <strong>%</strong> to edit inline
        (Enter save, Escape cancel). <strong>People</strong> uses a compact overlapping{" "}
        <span className="font-mono">nqui</span> avatar trigger (ellipsis when there are many) with a multi-select list
        — styling is playground-only via <span className="font-mono">renderPeoplePicker</span>.
      </p>
      <div className={tableShellClass}>
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
                        className={cn(
                          tableHeadClass,
                          header.column.id === "progress" ? "text-right" : "",
                        )}
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className={tableBodyClassName}>
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
        <div className={tableFooterClass}>
          <p className="text-xs text-muted-foreground">
            State is local to this tab — pattern for PM tools: same column defs + API commit on blur.
          </p>
        </div>
      </div>
    </div>
  );
}
