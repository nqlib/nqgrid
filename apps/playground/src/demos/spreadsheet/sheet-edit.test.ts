import { describe, expect, it } from "vitest";
import {
  canRedo,
  canUndo,
  coerceCellValue,
  commitCellValue,
  historyReducer,
  type HistoryState,
} from "./sheet-edit";
import type { OrderRow } from "./mock-data";

function makeRow(id: string, over: Partial<OrderRow> = {}): OrderRow {
  return {
    id,
    orderNo: `SO-${id}`,
    date: "2025-01-01",
    year: 2025,
    quarter: "Q1",
    month: "Jan",
    region: "North",
    country: "Canada",
    channel: "Online",
    category: "Hardware",
    product: "Edge Router",
    salesRep: "Ana Ortiz",
    status: "Open",
    units: 10,
    unitPrice: 100,
    revenue: 1000,
    cost: 600,
    margin: 400,
    marginPct: 40,
    ...over,
  };
}

describe("coerceCellValue", () => {
  it("coerces numeric strings to numbers", () => {
    expect(coerceCellValue("42", true)).toBe(42);
    expect(coerceCellValue(" 3.5 ", true)).toBe(3.5);
  });

  it("rejects non-numeric input in numeric columns instead of writing 0", () => {
    expect(coerceCellValue("abc", true)).toBeNull();
    expect(coerceCellValue("", true)).toBeNull();
    expect(coerceCellValue("1,2", true)).toBeNull();
    expect(coerceCellValue("12abc", true)).toBeNull();
  });

  it("accepts the number formats people type", () => {
    expect(coerceCellValue("1,234", true)).toBe(1234);
    expect(coerceCellValue("$5", true)).toBe(5);
    expect(coerceCellValue("€1.5", true)).toBe(1.5);
    expect(coerceCellValue("-$1,234.50", true)).toBe(-1234.5);
    expect(coerceCellValue("(12)", true)).toBe(-12);
    expect(coerceCellValue("12%", true)).toBeCloseTo(0.12);
    expect(coerceCellValue("1e3", true)).toBe(1000);
    expect(coerceCellValue(".5", true)).toBe(0.5);
  });

  it("passes text through unchanged for text columns", () => {
    expect(coerceCellValue("Hello", false)).toBe("Hello");
  });

  it("clears a text cell to empty string", () => {
    expect(coerceCellValue("", false)).toBe("");
  });
});

describe("commitCellValue", () => {
  const data: OrderRow[] = [makeRow("a"), makeRow("b")];

  it("writes a coerced number into a numeric column", () => {
    const next = commitCellValue(data, "b", "units", "55", true);
    expect(next).not.toBe(data);
    expect(next[1]!.units).toBe(55);
    expect(next[0]).toBe(data[0]); // untouched rows keep identity
  });

  it("writes a passthrough text value", () => {
    const next = commitCellValue(data, "a", "status", "Won", false);
    expect(next[0]!.status).toBe("Won");
  });

  it("clears a text cell to empty and keeps a numeric cell on invalid input", () => {
    expect(commitCellValue(data, "a", "country", "", false)[0]!.country).toBe("");
    expect(commitCellValue(data, "a", "units", "", true)).toBe(data);
    expect(commitCellValue(data, "a", "units", "abc", true)).toBe(data);
  });

  it("returns the same array when the row id is absent", () => {
    expect(commitCellValue(data, "missing", "units", "1", true)).toBe(data);
  });
});

describe("history reducer", () => {
  const v0 = [makeRow("a")];
  const v1 = [makeRow("a", { units: 1 })];
  const v2 = [makeRow("a", { units: 2 })];
  const base: HistoryState = { past: [], present: v0, future: [] };

  it("commit pushes present to past and clears future", () => {
    const s1 = historyReducer(base, { type: "commit", next: v1 });
    expect(s1.present).toBe(v1);
    expect(s1.past).toEqual([v0]);
    expect(s1.future).toEqual([]);
    expect(canUndo(s1)).toBe(true);
    expect(canRedo(s1)).toBe(false);
  });

  it("round-trips commit → undo → redo", () => {
    const s1 = historyReducer(base, { type: "commit", next: v1 });
    const s2 = historyReducer(s1, { type: "commit", next: v2 });
    const u1 = historyReducer(s2, { type: "undo" });
    expect(u1.present).toBe(v1);
    expect(canRedo(u1)).toBe(true);
    const u2 = historyReducer(u1, { type: "undo" });
    expect(u2.present).toBe(v0);
    expect(canUndo(u2)).toBe(false);
    const r1 = historyReducer(u2, { type: "redo" });
    expect(r1.present).toBe(v1);
    const r2 = historyReducer(r1, { type: "redo" });
    expect(r2.present).toBe(v2);
    expect(canRedo(r2)).toBe(false);
  });

  it("a new commit after undo clears the redo future", () => {
    const s1 = historyReducer(base, { type: "commit", next: v1 });
    const u1 = historyReducer(s1, { type: "undo" });
    expect(canRedo(u1)).toBe(true);
    const s2 = historyReducer(u1, { type: "commit", next: v2 });
    expect(s2.future).toEqual([]);
    expect(s2.present).toBe(v2);
  });

  it("undo / redo are no-ops on empty stacks", () => {
    expect(historyReducer(base, { type: "undo" })).toBe(base);
    expect(historyReducer(base, { type: "redo" })).toBe(base);
  });
});
