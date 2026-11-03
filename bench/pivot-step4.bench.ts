import { bench, describe } from "vitest";

import { buildPivotModel, createPivotModelBuilder } from "../src/core/pivot/build-model";
import { pivotDrillThrough } from "../src/core/pivot/cube";
import { createPivotRowEncoding } from "../src/core/pivot/encode";
import type { PivotSpec } from "../src/core/pivot/types";
import { benchBaseSpec, benchCalcSpec, benchFilteredSpec, generateBenchCustomerRows } from "./dataset";

/**
 * `pnpm bench` — Excel parity step 4 (calculated measures, distinct count, show values as along a
 * field, subtotal rows, drill-through), in its own file so its rows never add memory pressure to the
 * other bench files. Each block repeats the base spec as the reference. Results: docs/pivot-performance.md.
 */
const opts = (n: number) =>
  n >= 500_000 ? { iterations: 5, time: 0, warmupIterations: 1 } : { iterations: 10, time: 500, warmupIterations: 2 };

const calcEverywhere: PivotSpec = {
  ...benchCalcSpec,
  rows: [{ field: "region" }, { field: "department", sortBy: { measure: "vsPlan" } }, { field: "line", topN: { measure: "vsPlan", count: 3, other: true } }],
  heat: { measure: "vsPlan", scope: "column" },
  kpis: [{ id: "vsPlan", measure: "vsPlan" }],
};
const distinctCustomers: PivotSpec = {
  ...benchBaseSpec,
  measures: [...benchBaseSpec.measures, { id: "customers", field: "customer", aggregate: "distinctCount" }],
  values: ["actual", "plan", "units", "customers"],
};
const distinctRegions: PivotSpec = {
  ...benchBaseSpec,
  rows: [{ field: "department" }, { field: "line" }],
  measures: [...benchBaseSpec.measures, { id: "regions", field: "region", aggregate: "distinctCount" }],
  values: ["actual", "regions"],
};
const withShowAs = (showAs: "runningTotal" | "differenceFrom", field: string): PivotSpec => ({
  ...benchBaseSpec,
  measures: benchBaseSpec.measures.map((m) => (m.id === "actual" ? { ...m, showAs, groupShowAs: showAs, showAsBase: { field } } : m)),
});

for (const n of [100_000, 500_000] as const) {
  const rows = generateBenchCustomerRows(n);
  describe(`${n.toLocaleString("en-US")} rows, step 4`, () => {
    bench("reference: base spec (cold)", () => {
      buildPivotModel(benchBaseSpec, rows);
    }, opts(n));

    bench("calculated measure actual / plan - 1 as a 4th value (cold)", () => {
      buildPivotModel(benchCalcSpec, rows);
    }, opts(n));

    bench("calculated measure as sortBy + Top 3 (Other) + heat + KPI (cold)", () => {
      buildPivotModel(calcEverywhere, rows);
    }, opts(n));

    bench("distinct count: 20k customers as a 4th value (cold)", () => {
      buildPivotModel(distinctCustomers, rows);
    }, opts(n));

    bench("distinct count: 6 regions by department → line (cold)", () => {
      buildPivotModel(distinctRegions, rows);
    }, opts(n));

    // View-only: show-as and subtotal placement reuse the cube (the usePivotGrid path).
    const viewBuilder = createPivotModelBuilder();
    const views: PivotSpec[] = [
      withShowAs("runningTotal", "month"),
      withShowAs("differenceFrom", "line"),
      { ...benchBaseSpec, rows: [{ field: "region", subtotal: "end" }, { field: "department", subtotal: "end" }, { field: "line" }] },
    ];
    let v = 0;
    bench("view-only: running total / difference from / subtotal rows (builder, cube reused)", () => {
      viewBuilder.build(views[v++ % views.length]!, rows);
    }, { ...opts(n), beforeAll: () => void viewBuilder.build(benchBaseSpec, rows), afterAll: () => viewBuilder.clear() });

    bench("running total along month (cold)", () => {
      buildPivotModel(withShowAs("runningTotal", "month"), rows);
    }, opts(n));

    // Drill-through on a reused encoding (what grid.drillThrough does): a leaf cell, and the grand
    // total of the filtered + Top N spec (first 1,000 records).
    let encoding = createPivotRowEncoding(rows);
    bench("drill-through: leaf cell North › Camp › Camp 1 · Nov (encoding reused)", () => {
      pivotDrillThrough(benchBaseSpec, rows, { path: ["North", "Camp", "Camp 1"], columnPath: ["Nov"] }, { encoding });
    }, { ...opts(n), beforeAll: () => void (encoding = createPivotRowEncoding(rows)) });

    bench("drill-through: grand total of filters + Top 5 (Other), limit 1,000 (encoding reused)", () => {
      pivotDrillThrough(benchFilteredSpec, rows, { path: [] }, { encoding });
    }, opts(n));
  });
}
