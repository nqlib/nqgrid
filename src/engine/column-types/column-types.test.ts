import { describe, expect, it } from "vitest";
import { createDefaultRegistry } from "./registry";
import { compareCells, cellInterval, renderCell } from "./pipeline";
import { groupRowsByColumn, sortRowsByColumn } from "./view-modes";
import { isTypeError, type ColumnSchema, type SelectOption } from "./contract";

const STATUS_OPTIONS: SelectOption[] = [
  { id: "backlog", label: "Backlog", order: 0, color: "#94a3b8" },
  { id: "in_progress", label: "In Progress", order: 1, color: "#3b82f6" },
  { id: "done", label: "Done", order: 2, color: "#22c55e" },
];

const statusSchema: ColumnSchema = {
  id: "status",
  label: "Status",
  type: "select",
  options: STATUS_OPTIONS,
};

const registry = createDefaultRegistry();

describe("registry", () => {
  it("provides the five core types", () => {
    expect(registry.names().sort()).toEqual(
      ["date", "dateRange", "number", "select", "text"].sort(),
    );
  });
  it("require throws on unknown type", () => {
    expect(() => registry.require("nope")).toThrow(/no column type/);
  });
});

describe("select / status — the litmus test", () => {
  const select = registry.require("select");

  it("stores id, renders label (id-in / label-out)", () => {
    const out = renderCell("in_progress", select, statusSchema);
    expect(out.display).toBe("In Progress");
    expect(out.error).toBeUndefined();
  });

  it("carries the option color as style data, not a class", () => {
    const out = renderCell("done", select, statusSchema);
    expect(out.style.chipBackground).toBe("#22c55e");
  });

  it("sorts by workflow order, NOT alphabetically", () => {
    // Alphabetical would be Backlog < Done < In Progress; order must win.
    const sorted = sortRowsByColumn(
      [{ s: "done" }, { s: "backlog" }, { s: "in_progress" }],
      (r) => r.s,
      select,
      statusSchema,
    );
    expect(sorted.map((r) => r.s)).toEqual(["backlog", "in_progress", "done"]);
  });

  it("flags an unknown option as a parse error", () => {
    const parsed = select.parse("ghost", statusSchema);
    expect(isTypeError(parsed)).toBe(true);
  });
});

describe("board / grouped-list placement", () => {
  const select = registry.require("select");

  it("groups in option order and keeps empty option columns", () => {
    const result = groupRowsByColumn(
      [{ s: "done" }, { s: "done" }, { s: "backlog" }],
      (r) => r.s,
      select,
      statusSchema,
    );
    expect(result.groups.map((g) => g.label)).toEqual(["Backlog", "In Progress", "Done"]);
    expect(result.groups.map((g) => g.rows.length)).toEqual([1, 0, 2]); // In Progress empty but present
  });
});

describe("number formatting & sort key", () => {
  const number = registry.require("number");
  const currency: ColumnSchema = {
    id: "amt",
    label: "Amount",
    type: "number",
    format: { style: "currency", currency: "USD", maximumFractionDigits: 0 },
  };

  it("formats currency from raw, sorts numerically", () => {
    expect(renderCell(1234, number, currency).display).toBe("$1,234");
    expect(compareCells(10, 9, number, currency)).toBeGreaterThan(0); // 10 > 9 numerically, not "10" < "9"
  });
});

describe("date / dateRange — the toInterval seam for gantt", () => {
  const date = registry.require("date");
  const dateRange = registry.require("dateRange");
  const dateSchema: ColumnSchema = { id: "due", label: "Due", type: "date" };
  const rangeSchema: ColumnSchema = { id: "tl", label: "Timeline", type: "dateRange" };

  it("date yields a zero-width interval", () => {
    const iv = cellInterval("2026-03-01", date, dateSchema);
    expect(iv?.start.getTime()).toBe(iv?.end.getTime());
  });

  it("dateRange yields a real span and sorts by start", () => {
    const iv = cellInterval({ start: "2026-03-01", end: "2026-03-10" }, dateRange, rangeSchema);
    expect(iv && iv.end.getTime() > iv.start.getTime()).toBe(true);
    expect(
      compareCells(
        { start: "2026-03-01", end: "2026-03-10" },
        { start: "2026-04-01", end: "2026-04-02" },
        dateRange,
        rangeSchema,
      ),
    ).toBeLessThan(0);
  });

  it("number type has no toInterval (gantt ignores it)", () => {
    expect(cellInterval(5, registry.require("number"), { id: "n", label: "N", type: "number" })).toBeNull();
  });
});
