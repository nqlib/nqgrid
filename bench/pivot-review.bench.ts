import { bench, describe } from "vitest";

import { createPivotModelBuilder } from "../src/core/pivot/build-model";
import { buildPivotCube } from "../src/core/pivot/cube";
import { createPivotRowEncoding } from "../src/core/pivot/encode";
import type { PivotSpec, PivotShowAs } from "../src/core/pivot/types";
import { benchBaseSpec, generateBenchRows } from "./dataset";

/**
 * `pnpm bench` — performance review scenarios (docs/pivot-performance.md, "Performance review"), in
 * their own file and rows: "show values as" along a field with many items (was O(items²) per
 * sibling group) and cubes with very many row nodes (one accumulator block per node).
 */
const opts = { iterations: 5, time: 0, warmupIterations: 1 };

// 100k records, region → customer with 1,000 customers per region (6,006 body rows × 39 columns).
const rows = generateBenchRows(100_000).map((r, i) => ({ ...r, customer: `C${(i * 7919) % 1000}` }));
const byCustomer: PivotSpec = { ...benchBaseSpec, rows: [{ field: "region" }, { field: "customer" }], heat: undefined, headerCharts: undefined, kpis: undefined };
const along = (showAs: PivotShowAs): PivotSpec => ({
  ...byCustomer,
  measures: byCustomer.measures.map((m) => (m.id === "actual" ? { ...m, showAs, groupShowAs: showAs, showAsBase: { field: "customer" } } : m)),
});

describe("100,000 rows, show values as along 1,000 customers per region (view only, cube reused)", () => {
  const builder = createPivotModelBuilder();
  for (const showAs of ["value", "runningTotal", "rankDescending", "differenceFrom"] as const) {
    const spec = showAs === "value" ? byCustomer : along(showAs);
    let k = 0;
    bench(`${showAs} along customer`, () => {
      builder.build({ ...spec, title: String(k++) }, rows);
    }, { ...opts, beforeAll: () => void builder.build(byCustomer, rows) });
  }
});

// 200k records, region → department → line → customer (20,000 ids): about 190,000 leaves.
const manyRows = generateBenchRows(200_000).map((r, i) => ({ ...r, customer: `C${(i * 7919) % 20_000}` }));
const manyLeaves: PivotSpec = { ...benchBaseSpec, rows: [...benchBaseSpec.rows, { field: "customer" }] };

describe("200,000 rows, ~190,000 row nodes (cube, encoding reused)", () => {
  let encoding = createPivotRowEncoding(manyRows);
  bench("region → department → line → customer", () => {
    buildPivotCube(manyLeaves, manyRows, { encoding });
  }, { ...opts, beforeAll: () => void (encoding = createPivotRowEncoding(manyRows)) });
});
