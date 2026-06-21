import { describe, expect, it } from "vitest";

import { buildRichColumnFromDef } from "./build-rich-column";
import { richCompareKey } from "./rich-compare-key";
import { findTimelineColumn, richToInterval } from "./rich-interval";
import type { RichSchemaColumnDef, StatusRichColumn, TimelineRichColumn } from "./rich-schema";
import { parseTimelineRaw } from "./rich-value-format";

type Row = { status: string; budget: number; due: string; span: { start: string; end: string } };

const statusMap = {
  backlog: { label: "Backlog" },
  in_progress: { label: "In Progress" },
  review: { label: "Review" },
  done: { label: "Done" },
} as const;

const statusDef: StatusRichColumn<Row> = {
  id: "status",
  name: "Status",
  kind: "status",
  accessorKey: "status",
  map: statusMap,
  choiceOrder: ["backlog", "in_progress", "review", "done"],
};

describe("richCompareKey", () => {
  it("orders status by workflow order, NOT alphabetically", () => {
    // Alphabetical would put "Backlog" < "Done" < "In Progress" < "Review".
    // Workflow order must be backlog(0) < in_progress(1) < review(2) < done(3).
    expect(richCompareKey(statusDef, "backlog")).toBe(0);
    expect(richCompareKey(statusDef, "in_progress")).toBe(1);
    expect(richCompareKey(statusDef, "review")).toBe(2);
    expect(richCompareKey(statusDef, "done")).toBe(3);
    expect(Number(richCompareKey(statusDef, "done"))).toBeGreaterThan(
      Number(richCompareKey(statusDef, "in_progress")),
    );
  });

  it("sorts unknown status values after every defined option", () => {
    expect(richCompareKey(statusDef, "mystery")).toBe(4);
  });

  it("uses numeric keys for number columns", () => {
    const def: RichSchemaColumnDef<Row> = { id: "b", name: "Budget", kind: "number", accessorKey: "budget" };
    expect(richCompareKey(def, 240_000)).toBe(240_000);
    expect(richCompareKey(def, undefined)).toBe(Number.POSITIVE_INFINITY);
  });

  it("normalizes percent ratio vs hundred to the same scale", () => {
    const ratio: RichSchemaColumnDef<Row> = {
      id: "p",
      name: "P",
      kind: "number",
      accessorKey: "budget",
      format: { style: "percent", valueScale: "ratio" },
    };
    expect(richCompareKey(ratio, 0.5)).toBe(50);
  });

  it("uses timestamps for date columns", () => {
    const def: RichSchemaColumnDef<Row> = { id: "d", name: "Due", kind: "date", accessorKey: "due" };
    expect(richCompareKey(def, "2026-05-01")).toBe(new Date("2026-05-01").getTime());
  });
});

describe("parseTimelineRaw", () => {
  it("reads { start, end } objects", () => {
    const iv = parseTimelineRaw({ start: "2026-05-01", end: "2026-05-10" });
    expect(iv?.start.getTime()).toBe(new Date("2026-05-01").getTime());
    expect(iv?.end.getTime()).toBe(new Date("2026-05-10").getTime());
  });

  it("reads [start, end] tuples", () => {
    const iv = parseTimelineRaw(["2026-05-01", "2026-05-10"]);
    expect(iv?.end.getTime()).toBe(new Date("2026-05-10").getTime());
  });

  it("treats a single date as a zero-width milestone", () => {
    const iv = parseTimelineRaw("2026-05-01");
    expect(iv?.start.getTime()).toBe(iv?.end.getTime());
  });

  it("orders a reversed pair so width is never negative", () => {
    const iv = parseTimelineRaw({ start: "2026-05-10", end: "2026-05-01" });
    expect(iv!.start.getTime()).toBeLessThan(iv!.end.getTime());
  });
});

describe("richToInterval (the time-axis seam)", () => {
  it("returns an interval for timeline columns", () => {
    const def: TimelineRichColumn<Row> = { id: "span", name: "Span", kind: "timeline", accessorKey: "span" };
    const iv = richToInterval(def, { start: "2026-05-01", end: "2026-05-10" });
    expect(iv).not.toBeNull();
    expect(iv!.start.getTime()).toBeLessThan(iv!.end.getTime());
  });

  it("returns a milestone (start === end) for date columns", () => {
    const def: RichSchemaColumnDef<Row> = { id: "due", name: "Due", kind: "date", accessorKey: "due" };
    const iv = richToInterval(def, "2026-05-01");
    expect(iv!.start.getTime()).toBe(iv!.end.getTime());
  });

  it("returns null for non-time columns (table ignores the seam)", () => {
    const def: RichSchemaColumnDef<Row> = { id: "b", name: "Budget", kind: "number", accessorKey: "budget" };
    expect(richToInterval(def, 1)).toBeNull();
  });
});

describe("findTimelineColumn", () => {
  it("prefers a timeline column over a date column", () => {
    const cols: RichSchemaColumnDef<Row>[] = [
      { id: "due", name: "Due", kind: "date", accessorKey: "due" },
      { id: "span", name: "Span", kind: "timeline", accessorKey: "span" },
    ];
    expect(findTimelineColumn(cols)?.id).toBe("span");
  });

  it("falls back to a date column", () => {
    const cols: RichSchemaColumnDef<Row>[] = [
      { id: "b", name: "Budget", kind: "number", accessorKey: "budget" },
      { id: "due", name: "Due", kind: "date", accessorKey: "due" },
    ];
    expect(findTimelineColumn(cols)?.id).toBe("due");
  });
});

describe("buildRichColumnFromDef wires a compareKey sortingFn", () => {
  it("attaches a sortingFn that orders status by workflow order", () => {
    const col = buildRichColumnFromDef<Row>(statusDef);
    const sortingFn = col.sortingFn as (a: unknown, b: unknown, id: string) => number;
    const mkRow = (status: string) => ({ getValue: () => status });
    // "done" must sort AFTER "backlog" by order, even though "d" < "b" alphabetically.
    expect(sortingFn(mkRow("done"), mkRow("backlog"), "status")).toBe(1);
    expect(sortingFn(mkRow("backlog"), mkRow("done"), "status")).toBe(-1);
  });
});
