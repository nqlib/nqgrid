import { describe, expect, it } from "vitest";
import { aggregate, computePivot, type PivotConfig } from "./pivot";

interface Sale {
  region: string;
  category: string;
  quarter: string;
  revenue: number;
  units: number;
}

const DATA: Sale[] = [
  { region: "West", category: "Hardware", quarter: "Q1", revenue: 100, units: 4 },
  { region: "West", category: "Hardware", quarter: "Q2", revenue: 140, units: 5 },
  { region: "West", category: "Software", quarter: "Q1", revenue: 60, units: 2 },
  { region: "East", category: "Hardware", quarter: "Q1", revenue: 200, units: 8 },
  { region: "East", category: "Software", quarter: "Q2", revenue: 80, units: 3 },
];

describe("aggregate", () => {
  it("computes each aggregator", () => {
    expect(aggregate([2, 4, 6], "sum")).toBe(12);
    expect(aggregate([2, 4, 6], "avg")).toBe(4);
    expect(aggregate([2, 4, 6], "min")).toBe(2);
    expect(aggregate([2, 4, 6], "max")).toBe(6);
    expect(aggregate([2, 4, 6], "count")).toBe(3);
  });
  it("returns null for empty (except count)", () => {
    expect(aggregate([], "sum")).toBeNull();
    expect(aggregate([], "count")).toBe(0);
  });
});

describe("computePivot — cross-tab", () => {
  const config: PivotConfig<Sale> = {
    rows: [{ key: "region", get: (r) => r.region }],
    columns: [{ key: "quarter", get: (r) => r.quarter }],
    measures: [{ key: "revenue", get: (r) => r.revenue, agg: "sum" }],
  };
  const result = computePivot(DATA, config);

  it("generates columns from distinct column-dimension values × measures", () => {
    // quarters Q1, Q2 × 1 measure = 2 leaves
    expect(result.columnLeaves.map((l) => l.key)).toEqual(["Q1␟revenue", "Q2␟revenue"]);
  });

  it("aggregates the measure at each row×column intersection", () => {
    const west = result.rows.find((r) => r.path[0] === "West" && r.kind === "leaf")!;
    expect(west.cells["Q1␟revenue"]).toBe(160); // 100 hardware + 60 software
    expect(west.cells["Q2␟revenue"]).toBe(140);
    const east = result.rows.find((r) => r.path[0] === "East" && r.kind === "leaf")!;
    expect(east.cells["Q1␟revenue"]).toBe(200);
    expect(east.cells["Q2␟revenue"]).toBe(80);
  });

  it("emits a grand-total row summing every source row per column", () => {
    const grand = result.rows.find((r) => r.kind === "grandTotal")!;
    expect(grand.cells["Q1␟revenue"]).toBe(360); // 160 + 200
    expect(grand.cells["Q2␟revenue"]).toBe(220); // 140 + 80
  });
});

describe("computePivot — nested rows + subtotals", () => {
  const result = computePivot(DATA, {
    rows: [
      { key: "region", get: (r) => r.region },
      { key: "category", get: (r) => r.category },
    ],
    measures: [{ key: "revenue", get: (r) => r.revenue, agg: "sum" }],
  });

  it("emits a subtotal per outer group, computed from raw rows (not child cells)", () => {
    const sub = result.rows.find((r) => r.kind === "subtotal" && r.path[0] === "West")!;
    expect(sub.label).toBe("West total");
    expect(sub.cells["␟revenue"]).toBe(300); // 100 + 140 + 60
  });

  it("leaf rows carry the full row-dimension path", () => {
    const leaf = result.rows.find((r) => r.kind === "leaf" && r.path[0] === "West" && r.path[1] === "Hardware")!;
    expect(leaf.cells["␟revenue"]).toBe(240); // 100 + 140
    expect(leaf.depth).toBe(2);
  });

  it("orders children before their subtotal, grand total last", () => {
    const kinds = result.rows.map((r) => `${r.kind}:${r.path.join("/")}`);
    expect(kinds[kinds.length - 1]).toBe("grandTotal:");
    const westLeafIdx = kinds.indexOf("leaf:West/Hardware");
    const westSubIdx = kinds.indexOf("subtotal:West");
    expect(westLeafIdx).toBeLessThan(westSubIdx);
  });
});

describe("computePivot — multi-measure column header", () => {
  it("builds a measures header row and respects per-measure aggregators", () => {
    const result = computePivot(DATA, {
      rows: [{ key: "region", get: (r) => r.region }],
      columns: [{ key: "quarter", get: (r) => r.quarter }],
      measures: [
        { key: "revenue", get: (r) => r.revenue, agg: "sum", label: "Revenue" },
        { key: "units", get: (r) => r.units, agg: "max", label: "Peak units" },
      ],
    });
    // 2 quarters × 2 measures = 4 leaves
    expect(result.columnLeaves).toHaveLength(4);
    // header: quarter row (spans of 2 leaves each) + measures row
    expect(result.columnHeaderRows).toHaveLength(2);
    expect(result.columnHeaderRows[0]!.map((c) => `${c.label}:${c.span}`)).toEqual(["Q1:2", "Q2:2"]);
    const east = result.rows.find((r) => r.path[0] === "East" && r.kind === "leaf")!;
    expect(east.cells["Q1␟units"]).toBe(8); // max units East/Q1
  });
});
