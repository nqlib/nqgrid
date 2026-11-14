import { bench, describe } from "vitest";

import { buildPivotModel, createPivotModelBuilder } from "../src/core/pivot/build-model";
import type { PivotSpec } from "../src/core/pivot/types";
import { benchBaseSpec, generateBenchRows } from "./dataset";

/**
 * `pnpm bench` — calculated items (batch C): 4 items (2 on region, 2 on department, 14 item rows) against the base
 * spec, cold and view-only. Results: docs/pivot-performance.md.
 */
const opts = (n: number) =>
  n >= 500_000 ? { iterations: 5, time: 0, warmupIterations: 1 } : { iterations: 10, time: 500, warmupIterations: 2 };

const withItems = (includeInTotals = false): PivotSpec => ({
  ...benchBaseSpec,
  rows: [
    {
      field: "region",
      calculatedItems: [
        { key: "North + South", formula: "[North] + [South]", after: "South" },
        { key: "North share", formula: "[North] / ([North] + [South] + [East] + [West])", after: "North + South", format: { style: "percent", decimals: 1 } },
      ],
    },
    {
      field: "department",
      calculatedItems: [
        { key: "Camp + Packs", formula: "[Camp] + [Packs]", after: "Packs", ...(includeInTotals ? { includeInTotals: true } : {}) },
        { key: "Footwear - Apparel", formula: "[Footwear] - [Apparel]" },
      ],
    },
    { field: "line" },
  ],
});

for (const n of [100_000, 500_000] as const) {
  const rows = generateBenchRows(n);
  describe(`${n.toLocaleString("en-US")} rows, calculated items`, () => {
    bench("reference: base spec (cold)", () => void buildPivotModel(benchBaseSpec, rows), opts(n));
    bench("4 calculated items, 14 item rows (cold)", () => void buildPivotModel(withItems(), rows), opts(n));
    bench("items, one with includeInTotals (cold)", () => void buildPivotModel(withItems(true), rows), opts(n));
    // Adding / editing an item is view-only: the builder reuses the cube.
    const builder = createPivotModelBuilder();
    const views = [benchBaseSpec, withItems(), withItems(true)];
    let v = 0;
    bench("view-only: none / items / includeInTotals (builder, cube reused)", () => void builder.build(views[v++ % views.length]!, rows), {
      ...opts(n),
      beforeAll: () => void builder.build(benchBaseSpec, rows),
      afterAll: () => builder.clear(),
    });
  });
}
