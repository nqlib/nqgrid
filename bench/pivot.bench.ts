import { bench, describe } from "vitest";

import { buildPivotModel, createPivotModelBuilder } from "../src/core/pivot/build-model";
import { addPivotMeasure, movePivotField } from "../src/core/pivot/fields";
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

    // Field list drops (step 2): the spec move plus the one rebuild it triggers. `maxCubes: 1` keeps
    // alternating layouts from hitting the cube cache, so every iteration re-aggregates. The builders
    // warm up in `beforeAll` and are cleared in `afterAll`, so their caches do not add memory
    // pressure to the other scenarios.
    const moveBuilder = createPivotModelBuilder({ maxCubes: 1 });
    let moveSpec: PivotSpec = benchBaseSpec;
    let m = 0;
    bench("move field: Line ↔ Columns (movePivotField + rebuild, encoding reused)", () => {
      // Line → Columns swaps Month into Rows; Month → Columns swaps Line back.
      const move = m++ % 2 === 0 ? ({ field: "line", from: "rows", to: "columns" } as const) : ({ field: "month", from: "rows", to: "columns" } as const);
      moveSpec = movePivotField(moveSpec, move);
      moveBuilder.build(moveSpec, rows);
    }, {
      ...opts(n),
      beforeAll: () => {
        moveSpec = benchBaseSpec;
        m = 0;
        moveBuilder.build(moveSpec, rows);
      },
      afterAll: () => moveBuilder.clear(),
    });

    const measureBuilder = createPivotModelBuilder({ maxCubes: 1 });
    let a = 0;
    bench("add measure: Units (sum) into Values (addPivotMeasure + rebuild)", () => {
      const next = a++ % 2 === 0 ? addPivotMeasure(benchBaseSpec, { field: "units", aggregate: "sum" }) : benchBaseSpec;
      measureBuilder.build(next, rows);
    }, {
      ...opts(n),
      beforeAll: () => {
        a = 0;
        measureBuilder.build(benchBaseSpec, rows);
      },
      afterAll: () => measureBuilder.clear(),
    });
  });
}
