import { bench, describe } from "vitest";

import { buildPivotModel } from "../src/core/pivot/build-model";
import type { PivotAggregate, PivotSpec } from "../src/core/pivot/types";
import { benchBaseSpec, benchDateSpec, generateBenchDateRows } from "./dataset";

/**
 * `pnpm bench` — planning features (batch B): measure-level filters and semi-additive aggregates,
 * each against the same spec without the feature. Results: docs/pivot-performance.md.
 */
const opts = (n: number) =>
  n >= 500_000 ? { iterations: 5, time: 0, warmupIterations: 1 } : { iterations: 10, time: 500, warmupIterations: 2 };

const filtered: PivotSpec = {
  ...benchBaseSpec,
  measures: benchBaseSpec.measures.map((m) => (m.id === "actual" || m.id === "plan" ? { ...m, filter: { field: "region", include: ["North", "South", "East"] } } : m)),
};
const unitsAs = (aggregate: PivotAggregate): PivotSpec => ({ ...benchDateSpec, measures: benchDateSpec.measures.map((m) => (m.id === "units" ? { ...m, aggregate } : m)) });

for (const n of [100_000, 500_000] as const) {
  const rows = generateBenchDateRows(n);
  describe(`${n.toLocaleString("en-US")} rows, planning`, () => {
    bench("reference: base spec (cold)", () => void buildPivotModel(benchBaseSpec, rows), opts(n));
    bench("measure filter on 2 of 3 values (cold)", () => void buildPivotModel(filtered, rows), opts(n));
    bench("reference: date columns, units avg (cold)", () => void buildPivotModel(unitsAs("avg"), rows), opts(n));
    bench("units closingBalance over orderDate (cold)", () => void buildPivotModel(unitsAs({ type: "closingBalance", timeField: "orderDate" }), rows), opts(n));
    bench("units averageOverTime over orderDate:yearMonth (cold)", () => void buildPivotModel(unitsAs({ type: "averageOverTime", timeField: "orderDate:yearMonth" }), rows), opts(n));
  });
}
