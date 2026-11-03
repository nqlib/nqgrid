import { bench, describe } from "vitest";

import { buildPivotModel, createPivotModelBuilder } from "../src/core/pivot/build-model";
import type { PivotSpec } from "../src/core/pivot/types";
import { benchBaseSpec, benchFilteredSpec, generateBenchRows } from "./dataset";

/**
 * `pnpm bench` — `buildPivotModel` on synthetic leaf rows (region → department → line × 12 months,
 * 3 value measures + row total, heat, header bars, KPIs). Results: docs/pivot-performance.md.
 */
const SIZES = [10_000, 100_000, 500_000] as const;
const opts = (n: number) =>
  n >= 500_000 ? { iterations: 5, time: 0, warmupIterations: 1 } : { iterations: 10, time: 500, warmupIterations: 2 };

for (const n of SIZES) {
  const rows = generateBenchRows(n);
  describe(`${n.toLocaleString("en-US")} rows`, () => {
    bench("base (cold: encode + aggregate + model)", () => {
      buildPivotModel(benchBaseSpec, rows);
    }, opts(n));

    const filtersOnly: PivotSpec = { ...benchBaseSpec, filters: benchFilteredSpec.filters };
    bench("filters only: same 3 filters as the baseline's rows.filter (cold)", () => {
      buildPivotModel(filtersOnly, rows);
    }, opts(n));

    bench("filters + label filter + 4 facets + top 5 (Other) + sortBy (cold)", () => {
      buildPivotModel(benchFilteredSpec, rows);
    }, opts(n));

    // usePivotGrid path: one builder per grid; the first build is outside the measured function.
    const viewBuilder = createPivotModelBuilder();
    viewBuilder.build(benchFilteredSpec, rows);
    const views: PivotSpec[] = [
      { ...benchFilteredSpec, expanded: "none" },
      { ...benchFilteredSpec, expanded: [["North"], ["North", "Camp"]], heat: { measure: "actual", scope: "column" } },
      { ...benchFilteredSpec, expanded: "all" },
    ];
    let v = 0;
    bench("view-only change: expand / collapse / heat scope (builder, cube reused)", () => {
      viewBuilder.build(views[v++ % views.length]!, rows);
    }, opts(n));

    const filterBuilder = createPivotModelBuilder({ maxCubes: 1 });
    filterBuilder.build(benchFilteredSpec, rows);
    const filterSteps = ["Camp", "Packs", "Bike"].map((d): PivotSpec => ({
      ...benchFilteredSpec,
      filters: [...benchFilteredSpec.filters!.slice(0, 1), { field: "department", include: [d] }, ...benchFilteredSpec.filters!.slice(2)],
    }));
    let f = 0;
    bench("filter change: slicer click (builder, encoding reused, re-aggregate)", () => {
      filterBuilder.build(filterSteps[f++ % filterSteps.length]!, rows);
    }, opts(n));
  });
}
