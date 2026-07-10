import { describe, expect, it } from "vitest";
import { computePivot } from "./pivot";
import {
  collectPivotExpandableGroupKeys,
  filterVisiblePivotRows,
  isPivotGroupHeaderRow,
  isPivotRowVisible,
  pivotGroupKey,
} from "./pivot-row-outline";

const DATA = [
  { region: "West", category: "Hardware", revenue: 100 },
  { region: "West", category: "Software", revenue: 200 },
  { region: "East", category: "Hardware", revenue: 50 },
] as const;

describe("pivot row outline", () => {
  const result = computePivot([...DATA], {
    rows: [
      { key: "region", get: (r) => r.region },
      { key: "category", get: (r) => r.category },
    ],
    measures: [{ key: "revenue", get: (r) => r.revenue, agg: "sum" }],
  });

  const rowFieldCount = 2;
  const allKeys = new Set(collectPivotExpandableGroupKeys(result.rows, rowFieldCount));

  it("collects outer row-dimension group keys", () => {
    expect(allKeys.has("West")).toBe(true);
    expect(allKeys.has("East")).toBe(true);
    expect(allKeys.size).toBe(2);
  });

  it("hides leaf rows when an outer group is collapsed", () => {
    const expanded = new Set(allKeys);
    expanded.delete("West");

    const westLeaf = result.rows.find(
      (r) => r.kind === "leaf" && r.path[0] === "West" && r.path[1] === "Hardware",
    )!;
    const westSub = result.rows.find(
      (r) => r.kind === "subtotal" && r.path[0] === "West",
    )!;

    expect(isPivotRowVisible(westLeaf, expanded, rowFieldCount)).toBe(false);
    expect(isPivotRowVisible(westSub, expanded, rowFieldCount)).toBe(true);
  });

  it("filterVisiblePivotRows keeps grand total and collapsed subtotals", () => {
    const expanded = new Set<string>();
    const visible = filterVisiblePivotRows(result.rows, expanded, rowFieldCount);
    const kinds = visible.map((r) => r.kind);
    expect(kinds.filter((k) => k === "subtotal")).toHaveLength(2);
    expect(kinds.filter((k) => k === "leaf")).toHaveLength(0);
    expect(kinds[kinds.length - 1]).toBe("grandTotal");
  });

  it("marks the first row in each outer group as a header", () => {
    const expanded = new Set(allKeys);
    const visible = filterVisiblePivotRows(result.rows, expanded, rowFieldCount);
    const westLeaf = visible.find((r) => r.kind === "leaf" && r.path[0] === "West")!;
    const westLeafIdx = visible.indexOf(westLeaf);
    const prev = westLeafIdx > 0 ? visible[westLeafIdx - 1] : undefined;
    expect(isPivotGroupHeaderRow(westLeaf, prev, 0)).toBe(true);
    expect(pivotGroupKey(westLeaf.path, 0)).toBe("West");
  });

  it("uses collapsed subtotal as the group header row", () => {
    const expanded = new Set(allKeys);
    expanded.delete("West");
    const visible = filterVisiblePivotRows(result.rows, expanded, rowFieldCount);
    const westSub = visible.find((r) => r.kind === "subtotal" && r.path[0] === "West")!;
    expect(isPivotGroupHeaderRow(westSub, undefined, 0)).toBe(true);
  });
});

describe("pivot row outline — three row dimensions", () => {
  const DATA3 = [
    { region: "West", category: "Hardware", product: "Router", revenue: 10 },
    { region: "West", category: "Hardware", product: "Switch", revenue: 20 },
    { region: "West", category: "Software", product: "App", revenue: 30 },
  ] as const;

  const result = computePivot([...DATA3], {
    rows: [
      { key: "region", get: (r) => r.region },
      { key: "category", get: (r) => r.category },
      { key: "product", get: (r) => r.product },
    ],
    measures: [{ key: "revenue", get: (r) => r.revenue, agg: "sum" }],
  });

  it("hides inner leaves when a nested group is collapsed", () => {
    const expanded = new Set(collectPivotExpandableGroupKeys(result.rows, 3));
    expanded.delete(pivotGroupKey(["West", "Hardware"], 1));

    const routerLeaf = result.rows.find(
      (r) => r.kind === "leaf" && r.path[2] === "Router",
    )!;
    const hardwareSub = result.rows.find(
      (r) => r.kind === "subtotal" && r.path[1] === "Hardware",
    )!;

    expect(isPivotRowVisible(routerLeaf, expanded, 3)).toBe(false);
    expect(isPivotRowVisible(hardwareSub, expanded, 3)).toBe(true);
  });
});
