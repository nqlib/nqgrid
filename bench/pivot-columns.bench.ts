import { bench, describe } from "vitest";

import { buildPivotModel, createPivotModelBuilder } from "../src/core/pivot/build-model";
import { togglePivotColumnGroup } from "../src/core/pivot/interaction";
import type { PivotModel, PivotSpec } from "../src/core/pivot/types";
import { benchDateSpec, benchThreeColumnSpec, benchTwoColumnSpec, generateBenchDateRows } from "./dataset";

/**
 * `pnpm bench` — step 3 scenarios (several column fields, date grouping, column-group toggles), in their own file
 * so their rows never add memory pressure to `pivot.bench.ts`. Results: docs/pivot-performance.md.
 */
const opts = (n: number) =>
  n >= 500_000 ? { iterations: 5, time: 0, warmupIterations: 1 } : { iterations: 10, time: 500, warmupIterations: 2 };

// Step 3: several column fields, date grouping and column-group toggles. Separate rows with `year`,
// `quarter` and an ISO `orderDate` (same other fields), built only for these scenarios.
for (const n of [100_000, 500_000] as const) {
  const rows = generateBenchDateRows(n);
  describe(`${n.toLocaleString("en-US")} rows, column hierarchy / dates`, () => {
    bench("2 column fields: year → month (2 × 12, cold)", () => {
      buildPivotModel(benchTwoColumnSpec, rows);
    }, opts(n));

    bench("3 column fields: year → quarter → month (2 × 4 × 3, cold)", () => {
      buildPivotModel(benchThreeColumnSpec, rows);
    }, opts(n));

    bench("date grouping from ISO strings: orderDate year → quarter (cold: parse + encode + aggregate)", () => {
      buildPivotModel(benchDateSpec, rows);
    }, opts(n));

    // Encoding reused: the builder keeps the parsed days and date codes, so a slicer click re-aggregates only.
    const dateBuilder = createPivotModelBuilder({ maxCubes: 1 });
    dateBuilder.build(benchDateSpec, rows);
    const dateSteps = ["Camp", "Packs", "Bike"].map((d): PivotSpec => ({ ...benchDateSpec, filters: [{ field: "department", include: [d] }] }));
    let ds = 0;
    bench("date grouping, encoding reused: slicer click (builder, dates parsed once)", () => {
      dateBuilder.build(dateSteps[ds++ % dateSteps.length]!, rows);
    }, opts(n));
    // Same slicer clicks on raw year / quarter fields: the cost of the date path beyond plain keys.
    const plainBuilder = createPivotModelBuilder({ maxCubes: 1 });
    const plainSpec: PivotSpec = { ...benchDateSpec, columns: [{ field: "year" }, { field: "quarter" }], fields: undefined };
    plainBuilder.build(plainSpec, rows);
    const plainSteps = dateSteps.map((s): PivotSpec => ({ ...plainSpec, filters: s.filters }));
    let ps = 0;
    bench("same slicer clicks on raw year / quarter keys (builder, encoding reused)", () => {
      plainBuilder.build(plainSteps[ps++ % plainSteps.length]!, rows);
    }, opts(n));

    // Collapse / expand a fiscal year: view-only, the cube is reused.
    const toggleBuilder = createPivotModelBuilder();
    let toggleSpec: PivotSpec = benchThreeColumnSpec;
    let toggleModel: PivotModel = toggleBuilder.build(toggleSpec, rows);
    bench("toggle a column group: collapse / expand FY25 (builder, cube reused)", () => {
      toggleSpec = togglePivotColumnGroup(toggleSpec, toggleModel, ["FY25"]);
      toggleModel = toggleBuilder.build(toggleSpec, rows);
    }, opts(n));
  });
}
