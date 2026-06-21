import type { RichSchemaColumnDef } from "@nqlib/nqgrid/advanced";
import { describe, expect, it } from "vitest";

import { routeDependencies } from "./dependency-route";
import { buildGanttModel } from "./gantt-model";

interface Task {
  id: string;
  title: string;
  status: "backlog" | "in_progress" | "done";
  assignee: string;
  span: { start: string; end: string };
  due?: string;
}

const statusMap = {
  backlog: { label: "Backlog", color: "#64748b" },
  in_progress: { label: "In Progress", backgroundColor: "#f59e0b" },
  done: { label: "Done", backgroundColor: "#10b981" },
} as const;

const schema: RichSchemaColumnDef<Task>[] = [
  { id: "title", name: "Task", kind: "text", accessorKey: "title" },
  { id: "status", name: "Status", kind: "status", accessorKey: "status", map: statusMap, choiceOrder: ["backlog", "in_progress", "done"] },
  { id: "assignee", name: "Owner", kind: "text", accessorKey: "assignee" },
  { id: "span", name: "Timeline", kind: "timeline", accessorKey: "span" },
];

const rows: Task[] = [
  { id: "t1", title: "Design", status: "done", assignee: "Maya", span: { start: "2026-05-01", end: "2026-05-05" } },
  { id: "t2", title: "Build", status: "in_progress", assignee: "Sam", span: { start: "2026-05-05", end: "2026-05-12" } },
  { id: "t3", title: "Ship", status: "backlog", assignee: "Maya", span: { start: "2026-05-12", end: "2026-05-12" } },
];

const getRowId = (r: Task) => r.id;

describe("buildGanttModel", () => {
  it("positions bars from the timeline column's interval", () => {
    const model = buildGanttModel({ rows, schema, roles: { labelColumnId: "title" }, getRowId });
    expect(model.items).toHaveLength(3);
    const t1 = model.items.find((i) => i.id === "t1")!;
    expect(t1.start.getTime()).toBe(new Date("2026-05-01").getTime());
    expect(t1.end.getTime()).toBe(new Date("2026-05-05").getTime());
    expect(t1.label).toBe("Design");
  });

  it("colors bars from the status column's chip color (style layer reuse)", () => {
    const model = buildGanttModel({
      rows,
      schema,
      roles: { labelColumnId: "title", colorColumnId: "status" },
      getRowId,
    });
    expect(model.items.find((i) => i.id === "t2")!.color).toBe("#f59e0b");
    expect(model.items.find((i) => i.id === "t1")!.color).toBe("#10b981");
  });

  it("treats a zero-width interval as a milestone", () => {
    const model = buildGanttModel({ rows, schema, roles: { labelColumnId: "title" }, getRowId });
    expect(model.items.find((i) => i.id === "t3")!.isMilestone).toBe(true);
  });

  it("groups into swimlanes via the lane column's compareKey", () => {
    const model = buildGanttModel({
      rows,
      schema,
      roles: { labelColumnId: "title", laneColumnId: "assignee" },
      getRowId,
    });
    expect(model.lanes.map((l) => l.id).sort()).toEqual(["Maya", "Sam"]);
    expect(model.items.filter((i) => i.laneId === "Maya")).toHaveLength(2);
  });

  it("orders status lanes by workflow order, not alphabetically", () => {
    const model = buildGanttModel({
      rows,
      schema,
      roles: { labelColumnId: "title", laneColumnId: "status" },
      getRowId,
    });
    // backlog(0) < in_progress(1) < done(2) — alphabetical would be backlog, done, in_progress.
    expect(model.lanes.map((l) => l.label)).toEqual(["Backlog", "In Progress", "Done"]);
  });

  it("derives a domain spanning all items", () => {
    const model = buildGanttModel({ rows, schema, roles: { labelColumnId: "title" }, getRowId });
    expect(model.domain!.start.getTime()).toBe(new Date("2026-05-01").getTime());
    expect(model.domain!.end.getTime()).toBe(new Date("2026-05-12").getTime());
  });

  it("throws a clear error when no timeline column exists", () => {
    const noTime: RichSchemaColumnDef<Task>[] = [{ id: "title", name: "Task", kind: "text", accessorKey: "title" }];
    expect(() => buildGanttModel({ rows, schema: noTime, roles: {}, getRowId })).toThrow(/timeline column/);
  });
});

describe("routeDependencies", () => {
  it("routes finish-to-start connectors between known boxes", () => {
    const boxes = [
      { id: "t1", x: 0, y: 0, width: 100, height: 24 },
      { id: "t2", x: 140, y: 36, width: 120, height: 24 },
    ];
    const paths = routeDependencies([{ from: "t1", to: "t2" }], boxes);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.d).toMatch(/^M 100 12 H/);
  });

  it("skips edges whose endpoints are missing", () => {
    const boxes = [{ id: "t1", x: 0, y: 0, width: 100, height: 24 }];
    expect(routeDependencies([{ from: "t1", to: "ghost" }], boxes)).toHaveLength(0);
  });
});
