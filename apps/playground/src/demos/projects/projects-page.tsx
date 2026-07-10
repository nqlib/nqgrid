/**
 * Projects — column-types lab. Configure fields via header ⋯ menus; drag columns and rows in table view.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  ToggleGroup,
  ToggleGroupItem,
} from "@nqlib/nqui";
import { cellInterval, groupRowsByColumn, type ColumnSchema, type SelectOption } from "@nqlib/nqgrid/engine";
import {
  DEFAULT_COLUMN_MODELS,
  boardGroupColumn,
  createColumnModel,
  visibleColumns,
  type PmColumnModel,
} from "./pm-column-model";
import { TITLE_FIELD, TASKS, pmRegistry, taskValue, type Task } from "./pm-schema";
import type { ColumnTypeCatalogEntry } from "./column-model-catalog";
import { ProjectsAddFieldMenu } from "./projects-column-editor";
import { ProjectsColumnSheet, saveColumnModel } from "./projects-column-sheet";
import { Cell } from "./cell";
import { ProjectsGridTable } from "./projects-grid-table";

type ViewMode = "table" | "list" | "board";

export function ProjectsPage() {
  const [view, setView] = useState<ViewMode>("table");
  const [tasks, setTasks] = useState<Task[]>(TASKS);
  const [columnModels, setColumnModels] = useState<PmColumnModel[]>(DEFAULT_COLUMN_MODELS);
  const [configureId, setConfigureId] = useState<string | null>(null);

  const schema = useMemo(() => visibleColumns(columnModels), [columnModels]);
  const boardColumn = useMemo(() => boardGroupColumn(columnModels), [columnModels]);
  const boardSchema = boardColumn ? ({ ...boardColumn } as ColumnSchema) : undefined;
  const configureModel = useMemo(
    () => columnModels.find((m) => m.id === configureId) ?? null,
    [columnModels, configureId],
  );

  useEffect(() => {
    if (!boardColumn && view === "board") setView("table");
  }, [boardColumn, view]);

  const secondaryFields = useMemo(
    () => schema.filter((c) => c.id !== TITLE_FIELD),
    [schema],
  );

  const statusOptions = useMemo((): SelectOption[] => {
    const statusCol = columnModels.find((m) => m.id === "status");
    return [...(statusCol?.options ?? [])];
  }, [columnModels]);

  const setBoardValue = (taskId: string, rawId: string) => {
    if (!boardColumn) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, [boardColumn.id]: rawId } : t)),
    );
  };

  const addField = (entry: ColumnTypeCatalogEntry) => {
    const created = createColumnModel(entry.id, columnModels);
    setColumnModels((prev) => [...prev, created]);
    setConfigureId(created.id);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Project tasks</h2>
          <p className="text-xs text-muted-foreground">
            Click to select · click again, Enter, or type to edit · drag headers or rows to reorder
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {view === "table" ? <ProjectsAddFieldMenu onAdd={addField} /> : null}
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={view}
            onValueChange={(v) => {
              if (v === "table" || v === "list" || v === "board") setView(v);
            }}
            aria-label="View mode"
          >
            <ToggleGroupItem value="table" className="h-8 px-3 text-xs">
              Table
            </ToggleGroupItem>
            <ToggleGroupItem value="list" className="h-8 px-3 text-xs">
              List
            </ToggleGroupItem>
            <ToggleGroupItem value="board" className="h-8 px-3 text-xs" disabled={!boardColumn}>
              Board
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </header>

      {view === "table" ? (
        <ProjectsGridTable
          tasks={tasks}
          onTasksChange={setTasks}
          columnModels={columnModels}
          onColumnModelsChange={setColumnModels}
          onConfigureColumn={setConfigureId}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          {view === "list" ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <ListView tasks={tasks} schema={schema} secondaryFields={secondaryFields} />
            </div>
          ) : boardColumn && boardSchema ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <BoardView
                tasks={tasks}
                schema={schema}
                boardColumn={boardColumn}
                boardSchema={boardSchema}
                onSetBoardValue={setBoardValue}
              />
            </div>
          ) : (
            <BoardUnavailable />
          )}
          <TimelineStrip tasks={tasks} schema={schema} statusOptions={statusOptions} />
        </div>
      )}

      <ProjectsColumnSheet
        open={configureId != null}
        model={configureModel}
        onOpenChange={(open) => {
          if (!open) setConfigureId(null);
        }}
        onSave={(saved) => setColumnModels((prev) => saveColumnModel(prev, saved))}
        onDelete={(id) => {
          setColumnModels((prev) => prev.filter((m) => m.id !== id));
          setConfigureId(null);
        }}
      />
    </div>
  );
}

function BoardUnavailable() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Empty className="max-w-sm border-0">
        <EmptyHeader>
          <EmptyTitle>Board needs a grouping field</EmptyTitle>
          <EmptyDescription>
            Enable board grouping on a single-select field via the column ⋯ menu in table view.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

function ListView({
  tasks,
  schema,
  secondaryFields,
}: {
  tasks: Task[];
  schema: readonly ColumnSchema[];
  secondaryFields: readonly ColumnSchema[];
}) {
  const titleSchema = schema.find((c) => c.id === TITLE_FIELD) as ColumnSchema;
  return (
    <ul className="divide-y divide-border/60">
      {tasks.map((task) => (
        <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
          <span className="min-w-48 flex-1 text-sm font-medium">
            <Cell task={task} schema={titleSchema} />
          </span>
          {secondaryFields.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Cell task={task} schema={c} />
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

function BoardView({
  tasks,
  schema,
  boardColumn,
  boardSchema,
  onSetBoardValue,
}: {
  tasks: Task[];
  schema: readonly ColumnSchema[];
  boardColumn: PmColumnModel;
  boardSchema: ColumnSchema;
  onSetBoardValue: (taskId: string, rawId: string) => void;
}) {
  const selectType = pmRegistry.require("select");
  const boardOptions = boardColumn.options ?? [];

  const { groups } = useMemo(
    () =>
      groupRowsByColumn(tasks, (t) => taskValue(t, boardColumn.id), selectType, boardSchema),
    [tasks, boardColumn.id, selectType, boardSchema],
  );

  const cardFields = schema.filter((c) => c.id !== TITLE_FIELD && c.id !== boardColumn.id);

  return (
    <div className="flex h-full gap-3 p-3">
      {groups.map((group) => (
        <div key={group.key} className="flex w-64 shrink-0 flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <span className="size-2 rounded-full" style={{ backgroundColor: group.color }} aria-hidden />
            <span className="text-xs font-semibold">{group.label}</span>
            <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px]">
              {group.rows.length}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {group.rows.map((task) => (
              <Card key={task.id} className="gap-0 py-0 shadow-none">
                <CardHeader className="gap-1 px-3 pt-3 pb-2">
                  <CardTitle className="text-sm leading-snug">{task.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 px-3 pb-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {cardFields.map((c) => (
                      <Cell key={c.id} task={task} schema={c} />
                    ))}
                  </div>
                  <Select
                    value={String(taskValue(task, boardColumn.id))}
                    onValueChange={(v) => onSetBoardValue(task.id, v)}
                  >
                    <SelectTrigger
                      size="sm"
                      className="h-7 text-xs"
                      aria-label={`Change ${boardColumn.label} for ${task.title}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {boardOptions.map((o) => (
                        <SelectItem key={String(o.id)} value={String(o.id)} className="text-xs">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            ))}
            {group.rows.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-2 py-3 text-center text-[11px] text-muted-foreground">
                No tasks in this stage
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineStrip({
  tasks,
  schema,
  statusOptions,
}: {
  tasks: Task[];
  schema: readonly ColumnSchema[];
  statusOptions: readonly SelectOption[];
}) {
  const timelineSchema = schema.find((c) => c.id === "timeline") as ColumnSchema | undefined;
  const type = timelineSchema ? pmRegistry.require(timelineSchema.type) : null;

  const bars = useMemo(() => {
    if (!timelineSchema || !type) return { rows: [], min: 0, span: 1 };
    const rows = tasks.map((t) => ({
      task: t,
      interval: cellInterval(taskValue(t, "timeline"), type, timelineSchema),
    }));
    const valid = rows.filter((r) => r.interval);
    if (valid.length === 0) return { rows, min: 0, span: 1 };
    const min = Math.min(...valid.map((r) => r.interval!.start.getTime()));
    const max = Math.max(...valid.map((r) => r.interval!.end.getTime()));
    return { rows, min, span: Math.max(1, max - min) };
  }, [tasks, type, timelineSchema]);

  return (
    <section className="shrink-0 border-t border-border bg-muted/20 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold">Timeline</span>
        <span className="text-[11px] text-muted-foreground">
          dateRange <code className="rounded bg-muted px-1">toInterval</code>
        </span>
      </div>
      <Separator className="mb-2" />
      <div className="flex flex-col gap-1">
        {bars.rows.map(({ task, interval }) => {
          const statusOpt = statusOptions.find((o) => o.id === task.status);
          const left = interval ? ((interval.start.getTime() - bars.min) / bars.span) * 100 : 0;
          const width = interval
            ? Math.max(2, ((interval.end.getTime() - interval.start.getTime()) / bars.span) * 100)
            : 0;
          return (
            <div key={task.id} className="flex items-center gap-2">
              <span className="w-44 shrink-0 truncate text-[11px] text-muted-foreground">{task.title}</span>
              <div className="relative h-4 flex-1 rounded bg-muted/50">
                {interval ? (
                  <div
                    className="absolute top-0 h-4 rounded"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: statusOpt?.color ?? "#94a3b8",
                    }}
                    title={`${interval.start.toLocaleDateString()} – ${interval.end.toLocaleDateString()}`}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
