import { bench, describe } from "vitest";

import { buildPivotModel, createPivotModelBuilder } from "../src/core/pivot/build-model";
import type { PivotMeasure, PivotShowAsBase, PivotSpec } from "../src/core/pivot/types";
import { benchBaseSpec, generateBenchSignedRows } from "./dataset";

/**
 * `pnpm bench` — financial statements: `signField` and `percentOf` with `showAsBase.scope: "all"`
 * (docs/pivot-recipes.md), against the base spec as the reference. Own file and rows (with a sign
 * column). Results: docs/pivot-performance.md.
 */
const opts = (n: number) =>
  n >= 500_000 ? { iterations: 5, time: 0, warmupIterations: 1 } : { iterations: 10, time: 500, warmupIterations: 2 };

const mapMeasures = (f: (m: PivotMeasure) => PivotMeasure): PivotSpec => ({ ...benchBaseSpec, measures: benchBaseSpec.measures.map(f) });
const signed = (signField: string) => mapMeasures((m) => (m.id === "actual" || m.id === "plan" ? { ...m, signField } : m));
/** % of the line "Camp 1" (under every region, so the global base merges 6 nodes). */
const percentOf = (scope: "parent" | "all"): PivotSpec => {
  const showAsBase: PivotShowAsBase = { field: "line", item: "Camp 1", scope };
  return mapMeasures((m) => (m.id === "actual" ? { ...m, showAs: "percentOf", groupShowAs: "percentOf", showAsBase } : m));
};

for (const n of [100_000, 500_000] as const) {
  const rows = generateBenchSignedRows(n);
  describe(`${n.toLocaleString("en-US")} rows, statements`, () => {
    bench("reference: base spec (cold)", () => {
      buildPivotModel(benchBaseSpec, rows);
    }, opts(n));

    bench("signField on 2 measures, numeric sign (cold)", () => {
      buildPivotModel(signed("sign"), rows);
    }, opts(n));

    bench('signField on 2 measures, string sign "-1" (cold)', () => {
      buildPivotModel(signed("signText"), rows);
    }, opts(n));

    bench('percentOf line "Camp 1", scope all (cold)', () => {
      buildPivotModel(percentOf("all"), rows);
    }, opts(n));

    bench('percentOf line "Camp 1", scope parent (cold)', () => {
      buildPivotModel(percentOf("parent"), rows);
    }, opts(n));

    // View-only: switching to % of (either scope) reuses the cube (the usePivotGrid path).
    const viewBuilder = createPivotModelBuilder();
    const views = [benchBaseSpec, percentOf("all"), percentOf("parent")];
    let v = 0;
    bench("view-only: values / % of scope all / % of scope parent (builder, cube reused)", () => {
      viewBuilder.build(views[v++ % views.length]!, rows);
    }, { ...opts(n), beforeAll: () => void viewBuilder.build(benchBaseSpec, rows), afterAll: () => viewBuilder.clear() });
  });
}
