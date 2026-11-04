/**
 * ONE schema + ONE row set, fed to table / list / board — the proof that the
 * ColumnType contract makes them render modes of one engine, not three engines.
 *
 * Everything here is data. The engine never learns what "status" or "person" is:
 * `select` is a core plugin; `person` is registered locally below to show the
 * registry extends with zero engine edits (SKILL.md: "new types are registry
 * entries, never edits to engine core").
 */
import {
  createDefaultRegistry,
  type ColumnSchema,
  type ColumnType,
  type SelectOption,
} from "@nqlib/nqgrid/engine";

export interface Person {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export const TEAM: readonly Person[] = [
  { id: "ava", name: "Ava Chen", color: "#6366f1" },
  { id: "ben", name: "Ben Ortiz", color: "#0ea5e9" },
  { id: "cleo", name: "Cleo Park", color: "#14b8a6" },
  { id: "dane", name: "Dane Reyes", color: "#f59e0b" },
];

const TEAM_BY_ID = new Map(TEAM.map((p) => [p.id, p]));

/** A locally-registered `person` type. Stores an id, renders the name, chips by color. */
const personType: ColumnType<unknown, Person> = {
  name: "person",
  parse(raw) {
    const p = TEAM_BY_ID.get(String(raw));
    return p ?? { id: "", name: "Unassigned", color: "#94a3b8" };
  },
  format: (p) => p.name,
  style: (p) => ({ chipColor: p.color, chipBackground: p.color, chipBorder: p.color }),
  compareKey: (p) => p.name.toLowerCase(),
  editor: () => ({ control: "select" }),
};

/** Build the app registry: core plugins + the demo's person type. */
export const pmRegistry = createDefaultRegistry().register(personType);

export const DEFAULT_STATUS_OPTIONS: SelectOption[] = [
  { id: "backlog", label: "Backlog", order: 0, color: "#94a3b8" },
  { id: "in_progress", label: "In Progress", order: 1, color: "#3b82f6" },
  { id: "review", label: "In Review", order: 2, color: "#a855f7" },
  { id: "done", label: "Done", order: 3, color: "#22c55e" },
];

/** @deprecated Use DEFAULT_STATUS_OPTIONS — kept for imports that expect the old name. */
export const STATUS_OPTIONS = DEFAULT_STATUS_OPTIONS;

export function cloneStatusOptions(options: readonly SelectOption[]): SelectOption[] {
  return options.map((o) => ({ ...o }));
}

export function normalizeStatusOrders(options: SelectOption[]): SelectOption[] {
  return options.map((o, index) => ({ ...o, order: index }));
}

export const PRIORITY_OPTIONS: SelectOption[] = [
  { id: "low", label: "Low", order: 0, color: "#64748b" },
  { id: "med", label: "Medium", order: 1, color: "#eab308" },
  { id: "high", label: "High", order: 2, color: "#ef4444" },
];

/** Alias for column-model defaults. */
export const PRIORITY_OPTIONS_EXPORT = PRIORITY_OPTIONS;

/** The column id used by each render mode for its grouping/primary field. */
export const STATUS_FIELD = "status";
export const TITLE_FIELD = "title";

const TRAILING_COLUMNS: readonly ColumnSchema[] = [
  { id: "priority", label: "Priority", type: "select", options: PRIORITY_OPTIONS },
  { id: "assignee", label: "Assignee", type: "person" },
  { id: "effort", label: "Effort", type: "number", format: { suffix: " pt" } },
  { id: "timeline", label: "Timeline", type: "dateRange", format: { preset: "dateMedium" } },
];

/** Build the live schema — status column and its option colors are app configuration. */
export function buildPmSchema(
  statusVisible: boolean,
  statusOptions: readonly SelectOption[],
): ColumnSchema[] {
  const cols: ColumnSchema[] = [{ id: "title", label: "Task", type: "text" }];
  if (statusVisible) {
    cols.push({
      id: STATUS_FIELD,
      label: "Status",
      type: "select",
      options: statusOptions,
    });
  }
  for (const col of TRAILING_COLUMNS) {
    cols.push(col);
  }
  return cols;
}

/** Default schema snapshot (status column on). */
export const PM_SCHEMA: readonly ColumnSchema[] = buildPmSchema(true, DEFAULT_STATUS_OPTIONS);

export function statusSchemaFrom(
  schema: readonly ColumnSchema[],
  statusOptions: readonly SelectOption[],
): ColumnSchema {
  return (
    schema.find((c) => c.id === STATUS_FIELD) ?? {
      id: STATUS_FIELD,
      label: "Status",
      type: "select",
      options: statusOptions,
    }
  );
}

export type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string;
  effort: number;
  progress: number;
  budget: number;
  due: string;
  timeline: { start: string; end: string };
};

export const TASKS: Task[] = [
  { id: "t1", title: "Design the schema contract", status: "done", priority: "high", assignee: "ava", effort: 5, progress: 100, budget: 12000, due: "2026-06-05", timeline: { start: "2026-06-01", end: "2026-06-05" } },
  { id: "t2", title: "Registry + core plugins", status: "done", priority: "high", assignee: "ben", effort: 8, progress: 100, budget: 18000, due: "2026-06-10", timeline: { start: "2026-06-03", end: "2026-06-10" } },
  { id: "t3", title: "Virtualized row model", status: "in_progress", priority: "high", assignee: "ava", effort: 13, progress: 62, budget: 24000, due: "2026-06-20", timeline: { start: "2026-06-08", end: "2026-06-20" } },
  { id: "t4", title: "Selection + keyboard nav", status: "in_progress", priority: "med", assignee: "cleo", effort: 8, progress: 45, budget: 16000, due: "2026-06-22", timeline: { start: "2026-06-10", end: "2026-06-22" } },
  { id: "t5", title: "Board drag commits raw id", status: "review", priority: "med", assignee: "dane", effort: 5, progress: 88, budget: 9000, due: "2026-06-19", timeline: { start: "2026-06-15", end: "2026-06-19" } },
  { id: "t6", title: "Gantt toInterval seam", status: "review", priority: "low", assignee: "ben", effort: 3, progress: 70, budget: 6000, due: "2026-06-21", timeline: { start: "2026-06-18", end: "2026-06-21" } },
  { id: "t7", title: "List card renderer", status: "backlog", priority: "med", assignee: "cleo", effort: 5, progress: 0, budget: 11000, due: "2026-06-26", timeline: { start: "2026-06-22", end: "2026-06-26" } },
  { id: "t8", title: "Pivot / cross-tab analytics", status: "backlog", priority: "low", assignee: "dane", effort: 8, progress: 0, budget: 14000, due: "2026-07-02", timeline: { start: "2026-06-24", end: "2026-07-02" } },
  { id: "t9", title: "Conditional formatting rules", status: "backlog", priority: "high", assignee: "ava", effort: 13, progress: 12, budget: 22000, due: "2026-07-08", timeline: { start: "2026-06-28", end: "2026-07-08" } },
];

/** Accessor: read a task field by schema column id (raw value, the SSOT scalar). */
export function taskValue(task: Task, columnId: string): unknown {
  return (task as unknown as Record<string, unknown>)[columnId];
}

/** Commit a raw scalar back onto a task row (editors write ids, never labels). */
export function setTaskValue(task: Task, columnId: string, raw: unknown): Task {
  return { ...(task as unknown as Record<string, unknown>), [columnId]: raw } as Task;
}
