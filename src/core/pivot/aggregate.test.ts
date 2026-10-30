import { describe, expect, it } from "vitest";

import { aggregatePivotRows } from "./aggregate";
import { pivotHeatDomain, pivotHeatLevel } from "./heat";

const rows = [
  { v: 10, w: 1, n: 3, d: 2 },
  { v: "20", w: 3, n: 1, d: 2 },
  { v: null, w: 5, n: null, d: null },
];

describe("aggregatePivotRows", () => {
  it("built-ins skip non-numeric values", () => {
    expect(aggregatePivotRows(rows, "sum", "v")).toBe(30);
    expect(aggregatePivotRows(rows, "avg", "v")).toBe(15);
    expect(aggregatePivotRows(rows, "min", "v")).toBe(10);
    expect(aggregatePivotRows(rows, "max", "v")).toBe(20);
    expect(aggregatePivotRows(rows, "first", "v")).toBe(10);
    expect(aggregatePivotRows(rows, "last", "v")).toBe(20);
    expect(aggregatePivotRows(rows, "count", "v")).toBe(2);
    expect(aggregatePivotRows(rows, "count", undefined)).toBe(3);
    expect(aggregatePivotRows(rows, undefined, "v")).toBe(30);
  });

  it("returns null when nothing is numeric", () => {
    expect(aggregatePivotRows([{ v: null }], "sum", "v")).toBeNull();
    expect(aggregatePivotRows([], "avg", "v")).toBeNull();
  });

  it("weightedAvg and ratio", () => {
    expect(aggregatePivotRows(rows, { type: "weightedAvg", weightField: "w" }, "v")).toBe((10 + 60) / 4);
    expect(aggregatePivotRows(rows, { type: "ratio", numeratorField: "n", denominatorField: "d" }, undefined)).toBe(1);
    expect(
      aggregatePivotRows(rows, { type: "ratio", numeratorField: "n", denominatorField: "d", offset: -1 }, undefined),
    ).toBe(0);
    expect(
      aggregatePivotRows([{ n: 1, d: 0 }], { type: "ratio", numeratorField: "n", denominatorField: "d" }, undefined),
    ).toBeNull();
  });

  it("custom aggregators resolve by name", () => {
    const registry = { range: (vals: readonly number[]) => Math.max(...vals) - Math.min(...vals) };
    expect(aggregatePivotRows(rows, { type: "custom", name: "range" }, "v", registry)).toBe(10);
    expect(() => aggregatePivotRows(rows, { type: "custom", name: "nope" }, "v")).toThrow(/unknown custom aggregator/);
  });
});

describe("heat", () => {
  it("maps values to discrete levels", () => {
    expect(pivotHeatLevel(0, 0, 100, 9)).toBe(0);
    expect(pivotHeatLevel(100, 0, 100, 9)).toBe(8);
    expect(pivotHeatLevel(50, 0, 100, 9)).toBe(4);
    expect(pivotHeatLevel(500, 0, 100, 9)).toBe(8);
    expect(pivotHeatLevel(null, 0, 100, 9)).toBeUndefined();
    expect(pivotHeatLevel(5, 5, 5, 9)).toBe(0);
  });

  it("computes domains over finite values", () => {
    expect(pivotHeatDomain([3, null, -1, 7])).toEqual({ min: -1, max: 7 });
    expect(pivotHeatDomain([null])).toBeNull();
  });
});
