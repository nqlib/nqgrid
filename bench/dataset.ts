import type { PivotDataRow, PivotSpec } from "../src/core/pivot/types";

/**
 * Synthetic leaf-grain rows for the pivot benchmarks: region (6) → department (8) → line (6 per
 * department) × 12 fiscal months, 3 numeric measures. Deterministic (LCG), so runs are comparable.
 */
export const BENCH_MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"] as const;
const REGIONS = ["North", "South", "East", "West", "Central", "Online"] as const;
const DEPARTMENTS = ["Footwear", "Apparel", "Camp", "Packs", "Climb", "Water", "Bike", "Snow"] as const;
const LINES_PER_DEPARTMENT = 6;

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function generateBenchRows(count: number, seed = 11): PivotDataRow[] {
  const rand = lcg(seed);
  const rows: PivotDataRow[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const d = Math.floor(rand() * DEPARTMENTS.length);
    const actual = Math.round(1000 + rand() * 50_000);
    rows[i] = {
      region: REGIONS[Math.floor(rand() * REGIONS.length)],
      department: DEPARTMENTS[d],
      line: `${DEPARTMENTS[d]} ${1 + Math.floor(rand() * LINES_PER_DEPARTMENT)}`,
      month: BENCH_MONTHS[i % 12],
      actual,
      plan: Math.round(actual * (0.9 + rand() * 0.2)),
      units: 1 + Math.floor(rand() * 40),
    };
  }
  return rows;
}

const usd = { style: "currency", currency: "USD", compact: true } as const;

/** 3 row dims, a 12-key column dim, 3 value measures (+ row total), heat, header bars and KPIs. */
export const benchBaseSpec: PivotSpec = {
  version: 1,
  id: "bench",
  title: "Bench",
  rows: [{ field: "region" }, { field: "department" }, { field: "line" }],
  columns: { field: "month", order: [...BENCH_MONTHS], keepEmpty: true },
  measures: [
    { id: "actual", field: "actual", format: usd },
    { id: "plan", field: "plan", format: usd },
    { id: "units", field: "units", aggregate: "avg" },
    { id: "attainment", aggregate: { type: "ratio", numeratorField: "actual", denominatorField: "plan" } },
  ],
  values: ["actual", "plan", "units"],
  totals: { rowTotal: true },
  heat: { measure: "actual", scope: "group" },
  headerCharts: { measure: "actual", breakdown: true },
  kpis: [
    { id: "actual", measure: "actual", compareTo: "plan" },
    { id: "attainment", measure: "attainment" },
  ],
  kpiLevels: [0, 1],
};

/** `benchBaseSpec` + report filters, a label filter, facets, Top 5 lines per department (with Other) and sort by value. */
export const benchFilteredSpec: PivotSpec = {
  ...benchBaseSpec,
  rows: [
    { field: "region" },
    { field: "department", sortBy: { measure: "actual", direction: "desc" } },
    { field: "line", topN: { measure: "actual", count: 5, other: true } },
  ],
  filters: [
    { field: "region", exclude: ["Online"] },
    { field: "department", include: ["Footwear", "Apparel", "Camp", "Packs", "Climb", "Bike"] },
    { field: "month", match: { op: "notEquals", value: "Oct" } },
  ],
  facets: ["region", "department", "line", "month"],
};
