import { describe, expect, it } from "vitest";
import {
  applyReplaceAll,
  applyReplaceFirst,
  findMatches,
  type FindReplaceColumn,
} from "./find-replace";
import type { OrderRow } from "./mock-data";

/** Minimal hand-built rows so assertions don't depend on the 2k fixture. */
function makeRow(over: Partial<OrderRow> & Pick<OrderRow, "id">): OrderRow {
  return {
    id: over.id,
    orderNo: over.orderNo ?? "SO-00000",
    date: over.date ?? "2025-01-01",
    year: over.year ?? 2025,
    quarter: over.quarter ?? "Q1",
    month: over.month ?? "Jan",
    region: over.region ?? "North",
    country: over.country ?? "Canada",
    channel: over.channel ?? "Online",
    category: over.category ?? "Hardware",
    product: over.product ?? "Edge Router",
    salesRep: over.salesRep ?? "Ana Ortiz",
    status: over.status ?? "Won",
    units: over.units ?? 10,
    unitPrice: over.unitPrice ?? 100,
    revenue: over.revenue ?? 1000,
    cost: over.cost ?? 500,
    margin: over.margin ?? 500,
    marginPct: over.marginPct ?? 50,
  };
}

const COLUMNS: FindReplaceColumn[] = [
  { key: "region", numeric: false },
  { key: "status", numeric: false },
  { key: "units", numeric: true },
];

const DATA: OrderRow[] = [
  makeRow({ id: "a", region: "North", status: "Won", units: 10 }),
  makeRow({ id: "b", region: "north pole", status: "Open", units: 25 }),
  makeRow({ id: "c", region: "South", status: "Won", units: 100 }),
];

describe("findMatches", () => {
  it("empty query returns no matches", () => {
    expect(findMatches(DATA, COLUMNS, "", { matchCase: false, wholeCell: false })).toHaveLength(0);
  });

  it("is case-insensitive by default (substring)", () => {
    // "north" matches "North" (a) and "north pole" (b).
    const m = findMatches(DATA, COLUMNS, "north", { matchCase: false, wholeCell: false });
    expect(m.map((x) => x.rowId).sort()).toEqual(["a", "b"]);
    expect(m.every((x) => x.key === "region")).toBe(true);
  });

  it("respects match-case", () => {
    const m = findMatches(DATA, COLUMNS, "North", { matchCase: true, wholeCell: false });
    expect(m).toHaveLength(1);
    expect(m[0]!.rowId).toBe("a");
  });

  it("whole-cell only matches exact values", () => {
    const sub = findMatches(DATA, COLUMNS, "North", { matchCase: false, wholeCell: false });
    expect(sub).toHaveLength(2); // North + north pole

    const whole = findMatches(DATA, COLUMNS, "North", { matchCase: false, wholeCell: true });
    expect(whole).toHaveLength(1);
    expect(whole[0]!.rowId).toBe("a");
  });

  it("counts matches across columns, including numeric cells as strings", () => {
    // "Won" appears in status for rows a and c.
    const won = findMatches(DATA, COLUMNS, "Won", { matchCase: false, wholeCell: false });
    expect(won).toHaveLength(2);
    // "10" matches units of row a (10), but also substring of row c units 100.
    const ten = findMatches(DATA, COLUMNS, "10", { matchCase: false, wholeCell: false });
    expect(ten.map((x) => x.rowId).sort()).toEqual(["a", "c"]);
  });
});

describe("applyReplaceAll", () => {
  it("empty query is a no-op (0 replaced)", () => {
    const { replaced } = applyReplaceAll(DATA, COLUMNS, "", "x", { matchCase: false, wholeCell: false });
    expect(replaced).toBe(0);
  });

  it("replaces substring text, leaving non-matches untouched", () => {
    const { next, replaced } = applyReplaceAll(
      DATA,
      [{ key: "region", numeric: false }],
      "North",
      "Northern",
      { matchCase: false, wholeCell: false },
    );
    expect(replaced).toBe(2);
    expect(next[0]!.region).toBe("Northern");
    expect(next[1]!.region).toBe("Northern pole");
    expect(next[2]!.region).toBe("South"); // untouched
  });

  it("whole-cell swaps the entire value", () => {
    const { next, replaced } = applyReplaceAll(
      DATA,
      [{ key: "status", numeric: false }],
      "Won",
      "Closed",
      { matchCase: false, wholeCell: true },
    );
    expect(replaced).toBe(2);
    expect(next[0]!.status).toBe("Closed");
    expect(next[1]!.status).toBe("Open"); // untouched
    expect(next[2]!.status).toBe("Closed");
  });

  it("coerces numeric columns to Number", () => {
    // Replace whole-cell units "10" -> "42" for row a.
    const { next, replaced } = applyReplaceAll(
      DATA,
      [{ key: "units", numeric: true }],
      "10",
      "42",
      { matchCase: false, wholeCell: true },
    );
    expect(replaced).toBe(1);
    expect(next[0]!.units).toBe(42);
    expect(typeof next[0]!.units).toBe("number");
  });

  it("skips non-finite numeric results", () => {
    // Whole-cell replace units "10" with non-numeric text -> skipped.
    const { next, replaced } = applyReplaceAll(
      DATA,
      [{ key: "units", numeric: true }],
      "10",
      "abc",
      { matchCase: false, wholeCell: true },
    );
    expect(replaced).toBe(0);
    expect(next[0]!.units).toBe(10); // unchanged
  });

  it("does not count cells whose value is unchanged", () => {
    const { replaced } = applyReplaceAll(
      DATA,
      [{ key: "region", numeric: false }],
      "North",
      "North",
      { matchCase: false, wholeCell: true },
    );
    expect(replaced).toBe(0);
  });
});

describe("applyReplaceFirst", () => {
  it("replaces only the first matching cell", () => {
    const { next, replaced } = applyReplaceFirst(
      DATA,
      [{ key: "region", numeric: false }],
      "North",
      "Northern",
      { matchCase: false, wholeCell: false },
    );
    expect(replaced).toBe(1);
    expect(next[0]!.region).toBe("Northern"); // row a changed
    expect(next[1]!.region).toBe("north pole"); // row b untouched
  });

  it("empty query is a no-op", () => {
    const { replaced } = applyReplaceFirst(DATA, COLUMNS, "", "x", {
      matchCase: false,
      wholeCell: false,
    });
    expect(replaced).toBe(0);
  });

  it("skips an invalid numeric write and advances to the next valid match", () => {
    // units "10" -> "abc" is non-finite for row a; with substring on region too,
    // restrict to units only so the first match (row a) is skipped, none left.
    const { next, replaced } = applyReplaceFirst(
      DATA,
      [{ key: "units", numeric: true }],
      "10",
      "abc",
      { matchCase: false, wholeCell: true },
    );
    expect(replaced).toBe(0);
    expect(next[0]!.units).toBe(10);
  });
});
