import { describe, expect, it } from "vitest";

import { generatePlanningPivotRows, planningPivotSpec } from "../../fixtures/planning-pivot-mock";
import { buildPivotModel, createPivotModelBuilder } from "./build-model";
import type { PivotSpec } from "./types";

const spec = (extra: Partial<PivotSpec> = {}): PivotSpec => ({ version: 1, rows: [{ field: "k" }], measures: [{ id: "s", field: "v" }], ...extra });
const codes = (rows: readonly Record<string, unknown>[], s: PivotSpec = spec()) => (buildPivotModel(s, rows).diagnostics ?? []).map((d) => d.code);

describe("model.diagnostics", () => {
  it("is absent on clean data (golden planning rows)", () => {
    expect(buildPivotModel(planningPivotSpec, generatePlanningPivotRows()).diagnostics).toBeUndefined();
    expect(buildPivotModel(spec(), []).diagnostics).toBeUndefined();
  });

  it("reports measure values that are not numbers (accounting formats are not parsed), with counts and samples", () => {
    const rows = [
      { k: "a", v: 1234.5 },
      { k: "b", v: "1,234.50" },
      { k: "c", v: "(500)" },
      { k: "d", v: "$12" },
      { k: "e", v: "5%" },
      { k: "f", v: true },
      { k: "g", v: "0x10" },
      { k: "h", v: "" },
      { k: "i", v: null },
      { k: "j", v: " 7 " },
      { k: "k", v: "-1e3" },
    ];
    const m = buildPivotModel(spec(), rows);
    expect(m.diagnostics).toHaveLength(1);
    const d = m.diagnostics![0]!;
    expect(d).toMatchObject({ code: "unparsedNumbers", field: "v", path: "measures[0].field", count: 6 });
    expect(d.samples).toEqual([
      { row: 1, value: '"1,234.50"' },
      { row: 2, value: '"(500)"' },
      { row: 3, value: '"$12"' },
      { row: 4, value: '"5%"' },
      { row: 5, value: "true" },
    ]);
    expect(d.message).toContain("6 values of \"v\" (measures[0].field) are not numbers and left out of every total");
    // Radix literals no longer parse ("0x10" was 16); padded and exponent strings still do.
    expect(m.grandTotal.cells[0]!.value).toBe(1234.5 + 7 - 1000);
  });

  it("reports fields no record has, filter items and base items that match nothing", () => {
    const rows = [{ k: "X", v: 1 }, { k: "Y", v: 2 }];
    expect(codes(rows, spec({ measures: [{ id: "s", field: "vv" }] }))).toEqual(["missingField"]);
    const typo = buildPivotModel(spec({ filters: [{ field: "regionn", include: ["North"] }] }), rows);
    expect(typo.diagnostics).toEqual([
      expect.objectContaining({ code: "missingField", field: "regionn", path: "filters[0].field", count: 2 }),
    ]);
    const item = buildPivotModel(spec({ filters: [{ field: "k", include: ["x", "Y"], exclude: ["Z"] }] }), rows);
    expect(item.diagnostics?.map((d) => [d.code, d.path, d.items])).toEqual([
      ["filterItemsNotFound", "filters[0].include", ["x"]],
      ["filterItemsNotFound", "filters[0].exclude", ["Z"]],
    ]);
    const base = buildPivotModel(spec({ measures: [{ id: "s", field: "v", showAs: "percentOf", showAsBase: { field: "k", item: "Revenue " } }] }), rows);
    expect(base.diagnostics?.map((d) => [d.code, d.path])).toEqual([["baseItemNotFound", "measures[0].showAsBase.item"]]);
  });

  it("reports keys of mixed types and dates that do not parse", () => {
    const mixed = buildPivotModel(spec(), [{ k: 2024, v: 1 }, { k: "2024", v: 2 }, { k: 1, v: 3 }, { k: "1.0", v: 4 }]);
    expect(mixed.diagnostics).toEqual([expect.objectContaining({ code: "mixedKeyTypes", count: 2, types: ["number", "string"] })]);
    const dates = buildPivotModel(
      { version: 1, rows: [{ field: "d:month" }], measures: [{ id: "n", aggregate: "count" }] },
      [{ d: "2026-01-02" }, { d: "31/12/2026" }, { d: "31/12/2026" }, { d: "2026-02-30" }, { d: null }, {}],
    );
    expect(dates.diagnostics).toEqual([expect.objectContaining({ code: "invalidDates", field: "d", path: "rows[0].field", count: 3 })]);
    expect(dates.diagnostics![0]!.samples).toEqual([
      { row: 1, value: '"31/12/2026"' },
      { row: 3, value: '"2026-02-30"' },
    ]);
  });

  it("stays bounded: one entry per field and problem, at most 5 samples", () => {
    const rows = Array.from({ length: 10_000 }, (_, i) => ({ k: `k${i % 7}`, v: i % 2 ? "n/a" : i, w: "x" }));
    const m = buildPivotModel(spec({ measures: [{ id: "s", field: "v" }, { id: "t", field: "v", aggregate: "max" }, { id: "w", field: "w" }] }), rows);
    expect(m.diagnostics?.map((d) => [d.code, d.field, d.count, d.samples?.length])).toEqual([
      ["unparsedNumbers", "v", 5000, 5],
      ["unparsedNumbers", "w", 10_000, 5],
    ]);
    expect(JSON.stringify(m.diagnostics).length).toBeLessThan(2000);
  });

  it("follows the builder's cached cubes and view-only changes", () => {
    const rows = [{ k: "X", v: "1,5" }, { k: "Y", v: 2 }];
    const builder = createPivotModelBuilder();
    const a = builder.build(spec(), rows);
    expect(a.diagnostics?.map((d) => d.code)).toEqual(["unparsedNumbers"]);
    const b = builder.build(spec({ expanded: "none", measures: [{ id: "s", field: "v", showAs: "percentOf", showAsBase: { field: "k", item: "Z" } }] }), rows);
    expect(b.diagnostics?.map((d) => d.code)).toEqual(["unparsedNumbers", "baseItemNotFound"]);
  });
});
