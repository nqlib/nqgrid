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

/** Calendar month (1–12) of each fiscal month in `BENCH_MONTHS`. */
const BENCH_MONTH_NUMBERS = [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/**
 * `generateBenchRows` plus two fiscal years: `year` (`FY25` / `FY26`), `quarter` (`Q1`–`Q4`, fiscal) and an
 * ISO `orderDate` (`2025-11-14`) in the record's fiscal month. The other fields are unchanged.
 */
export function generateBenchDateRows(count: number, seed = 11): PivotDataRow[] {
  return generateBenchRows(count, seed).map((r, i) => {
    const mi = i % 12;
    const fy = Math.floor(i / 12) % 2 === 0 ? 25 : 26;
    const m = BENCH_MONTH_NUMBERS[mi]!;
    const y = 2000 + fy - (m >= 11 ? 1 : 0);
    return {
      ...r,
      year: `FY${fy}`,
      quarter: `Q${Math.floor(mi / 3) + 1}`,
      orderDate: `${y}-${String(m).padStart(2, "0")}-${String(1 + ((i * 7) % 28)).padStart(2, "0")}`,
    };
  });
}

/** `benchBaseSpec` with 2 column fields: year → month (2 × 12 leaves, year subtotals, grand total). */
export const benchTwoColumnSpec: PivotSpec = {
  ...benchBaseSpec,
  columns: [{ field: "year" }, { field: "month", order: [...BENCH_MONTHS], keepEmpty: true }],
};

/** `benchBaseSpec` with 3 column fields: year → quarter → month (2 × 4 × 3 leaves, two subtotal levels). */
export const benchThreeColumnSpec: PivotSpec = {
  ...benchBaseSpec,
  columns: [{ field: "year" }, { field: "quarter" }, { field: "month", order: [...BENCH_MONTHS] }],
};

/** Date grouping from ISO strings: fiscal year → quarter of `orderDate` (fiscal year from November). */
export const benchDateSpec: PivotSpec = {
  ...benchBaseSpec,
  columns: [{ field: "orderDate:year" }, { field: "orderDate:quarter" }],
  fields: [{ field: "orderDate", type: "date", fiscalYearStartMonth: 11 }],
};

/**
 * `generateBenchRows` plus `customer` (20,000 distinct ids, derived from the index so the other
 * fields stay identical) for the distinct-count scenarios.
 */
export function generateBenchCustomerRows(count: number, seed = 11): PivotDataRow[] {
  return generateBenchRows(count, seed).map((r, i) => ({ ...r, customer: `C${(i * 7919) % 20_000}` }));
}

/** `benchBaseSpec` + a calculated measure (`actual / plan - 1`) shown as a fourth value. */
export const benchCalcSpec: PivotSpec = {
  ...benchBaseSpec,
  measures: [...benchBaseSpec.measures, { id: "vsPlan", calculate: "actual / plan - 1", format: { style: "percent", decimals: 1 } }],
  values: ["actual", "plan", "units", "vsPlan"],
};
