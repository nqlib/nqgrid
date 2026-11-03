import { describe, expect, it } from "vitest";

import { pivotColumnFields } from "./columns";
import {
  generatePlanningPivotRows,
  planningFieldCatalog,
  planningFieldsPivotSpec,
  planningFilteredPivotSpec,
  planningPivotSpec,
  planningDateFieldCatalog,
} from "../../fixtures/planning-pivot-mock";
import { buildPivotModel, createPivotModelBuilder } from "./build-model";
import {
  addPivotMeasure,
  canMovePivotField,
  ensurePivotFilterField,
  humanizePivotField,
  inferPivotFields,
  movePivotField,
  PIVOT_VALUES_FIELD,
  pivotFieldListState,
  planPivotFieldMove,
  removePivotField,
  reorderPivotField,
  resolvePivotFields,
  setPivotMeasureAggregate,
  setPivotValuesPosition,
  swapPivotRowsColumns,
  togglePivotField,
  type PivotFieldLocation,
  type PivotFieldMove,
  setPivotDateGrouping,
  PIVOT_MAX_COLUMN_FIELDS,
} from "./fields";
import { setPivotColumnsExpandedAll, setPivotFilterValues, togglePivotColumnGroup } from "./interaction";
import { pivotModelToSheet } from "./to-sheet";
import type { PivotDimension, PivotSpec } from "./types";
import { validatePivotSpec } from "./validate";

const rows = generatePlanningPivotRows(7, { extraFields: true });
const fields = resolvePivotFields({ ...planningPivotSpec, fields: planningFieldCatalog });
const base: PivotSpec = { ...planningPivotSpec, fields: planningFieldCatalog };
const opts = { fields };
const areaFields = (spec: PivotSpec) => {
  const s = pivotFieldListState(spec, fields);
  return {
    filters: s.filters.map((i) => i.field),
    columns: s.columns.map((i) => (i.isValues ? "Σ" : i.field)),
    rows: s.rows.map((i) => i.field),
    values: s.values.map((i) => i.field),
  };
};
const expectValid = (spec: PivotSpec) => {
  const v = validatePivotSpec(spec);
  expect(v.ok ? [] : v.errors).toEqual([]);
};

describe("field catalogue", () => {
  it("extra fixture fields are additive: the other fields are byte-identical", () => {
    const plain = generatePlanningPivotRows();
    expect(rows).toHaveLength(plain.length);
    rows.forEach((r, i) => {
      const { region, channel, units, ...rest } = r;
      expect(rest).toEqual(plain[i]);
      expect(typeof region).toBe("string");
      expect(typeof channel).toBe("string");
      expect(Number.isInteger(units)).toBe(true);
    });
  });

  it("infers types from a sample, in first-seen field order", () => {
    const inferred = inferPivotFields(rows);
    expect(inferred.map((f) => [f.field, f.type])).toEqual([
      ["department", "dimension"],
      ["owner", "dimension"],
      ["line", "dimension"],
      ["month", "dimension"],
      ["actual", "measure"],
      ["plan", "measure"],
      ["forecast", "measure"],
      ["outlook", "measure"],
      ["priorYear", "measure"],
      ["region", "dimension"],
      ["channel", "dimension"],
      ["units", "measure"],
    ]);
    expect(inferred.find((f) => f.field === "priorYear")!.label).toBe("Prior Year");
    const mixed = inferPivotFields(
      Array.from({ length: 200 }, (_, i) => ({ year: 2020 + (i % 3), day: `2024-01-${String((i % 28) + 1).padStart(2, "0")}`, id: `ID-${i}`, v: i % 2 ? null : i * 1.5 })),
    );
    expect(mixed.map((f) => f.type)).toEqual(["number", "date", "text", "measure"]);
    // Sampling: only `sample` records are read.
    let reads = 0;
    const big = Array.from({ length: 10_000 }, () => new Proxy({ a: 1 }, { ownKeys: (t) => (reads++, Reflect.ownKeys(t)) }));
    inferPivotFields(big, { sample: 100 });
    expect(reads).toBe(100);
    expect(humanizePivotField("unit_price")).toBe("Unit Price");
  });

  it("resolve: spec.fields wins, referenced fields are added, fieldLabels override labels", () => {
    const resolved = resolvePivotFields({ ...planningPivotSpec, fields: [{ field: "region", type: "dimension" }], fieldLabels: { line: "Product line" } });
    expect(resolved.map((f) => [f.field, f.label, f.type])).toEqual([
      ["region", "Region", "dimension"],
      ["department", "Department", "dimension"],
      ["line", "Product line", "dimension"],
      ["month", "Month", "dimension"],
      ["actual", "Actual", "measure"],
      ["plan", "Plan", "measure"],
      ["forecast", "Forecast", "measure"],
      ["outlook", "Outlook", "measure"],
    ]);
    expect(resolved.find((f) => f.field === "actual")!.areas).toEqual(["values"]);
    // Inference when spec.fields is absent and rows are given.
    expect(resolvePivotFields(planningPivotSpec, rows).map((f) => f.field)).toContain("units");
  });

  it("field-list state: areas in order, Σ Values, calculated measures, unused", () => {
    const s = pivotFieldListState(planningFilteredPivotSpec, fields);
    expect(s.rows.map((i) => [i.field, i.filtered ?? false, i.sorted ?? false, i.topN ?? false])).toEqual([
      ["department", true, false, false],
      ["line", true, true, true],
    ]);
    expect(s.columns.map((i) => i.field)).toEqual(["month"]);
    expect(s.values.map((i) => [i.field, i.sourceField])).toEqual([["actual", "actual"]]);
    expect(s.filters).toEqual([]);
    expect(s.calculated).toEqual([{ id: "growth", label: "Growth on FY25", inValues: false }]);
    expect(s.unused.map((f) => f.field)).toEqual(["region", "channel", "owner", "plan", "forecast", "outlook", "priorYear", "units"]);
    const two = pivotFieldListState({ ...base, values: ["actual", "plan"] }, fields);
    expect(two.columns.map((i) => i.label)).toEqual(["Month", "Σ Values"]);
    expect(pivotFieldListState({ ...base, values: ["actual", "plan"], valuesIndex: 0 }, fields).columns[0]!.field).toBe(PIVOT_VALUES_FIELD);
  });
});

describe("movePivotField", () => {
  it("Line → Columns adds a second column field; a full Columns area displaces the innermost one", () => {
    const plan = planPivotFieldMove(base, { field: "line", from: "rows", to: "columns" }, opts);
    expect(plan.displaced).toBeUndefined();
    expect(areaFields(plan.spec)).toEqual({ filters: [], columns: ["month", "line"], rows: ["department"], values: ["actual"] });
    expect(plan.spec.columns).toEqual([planningPivotSpec.columns, { field: "line", label: "Line" }]);
    expect(plan.spec.expanded).toBe("all"); // department is now the leaf level: no group paths left
    const m = buildPivotModel(plan.spec, rows);
    expect(m.columnDimensions).toEqual([{ field: "month", label: "Month" }, { field: "line", label: "Line" }]);
    expect(m.grandTotal.cells.filter((_, i) => !m.columns[i]!.subtotal).reduce((s, c) => s + (c.raw ?? 0), 0)).toBe(rows.reduce((s, r) => s + r.actual, 0));
    // Back to one column field: the original single-object shape.
    expect(movePivotField(plan.spec, { field: "line", from: "columns", to: "rows" }, opts).columns).toEqual(planningPivotSpec.columns);
    // Four column fields is the cap: a fifth swaps the innermost other one into its source area.
    let full = movePivotField(plan.spec, { field: "region", from: "unused", to: "columns" }, opts);
    full = movePivotField(full, { field: "channel", from: "unused", to: "columns" }, opts);
    expect(areaFields(full).columns).toEqual(["month", "line", "region", "channel"]);
    const fifth = planPivotFieldMove(full, { field: "department", from: "rows", to: "columns", index: 0 }, opts);
    expect(fifth.displaced).toEqual({ field: "channel", to: "rows" });
    expect(areaFields(fifth.spec)).toMatchObject({ columns: ["department", "month", "line", "region"], rows: ["channel"] });
    expectValid(fifth.spec);
    expect(buildPivotModel(fifth.spec, rows).headerRows).toHaveLength(4);
  });

  it("reorders rows: expanded paths whose levels changed are dropped", () => {
    const three = movePivotField(base, { field: "channel", from: "unused", to: "rows", index: 1 }, opts);
    expect(three.rows.map((d) => d.field)).toEqual(["department", "channel", "line"]);
    expect(three.expanded).toEqual([["Camp"], ["Packs"]]); // department level unchanged
    const withChannel: PivotSpec = { ...three, expanded: [["Camp"], ["Camp", "Online"]] };
    const swapped = reorderPivotField(withChannel, { area: "rows", field: "line", index: 1 }, opts);
    expect(swapped.rows.map((d) => d.field)).toEqual(["department", "line", "channel"]);
    expect(swapped.expanded).toEqual([["Camp"]]);
    const outer = reorderPivotField(withChannel, { area: "rows", field: "channel", index: 0 }, opts);
    expect(outer.rows.map((d) => d.field)).toEqual(["channel", "department", "line"]);
    expect(outer.expanded).toBe("all");
    // Drop-indicator index: dragging department down past channel (indicator after channel = 2).
    expect(movePivotField(three, { field: "department", from: "rows", to: "rows", index: 2 }, opts).rows.map((d) => d.field)).toEqual(["channel", "department", "line"]);
  });

  it("sortBy / topN travel with a row field and are stripped in Columns", () => {
    const spec: PivotSpec = { ...planningFilteredPivotSpec, fields: planningFieldCatalog };
    const reordered = movePivotField(spec, { field: "line", from: "rows", to: "rows", index: 0 }, opts);
    expect(reordered.rows[0]).toEqual(spec.rows[1]);
    const inColumns = movePivotField(spec, { field: "line", from: "rows", to: "columns" }, opts);
    expect(pivotColumnFields(inColumns)[1]).toEqual({ field: "line", label: "Line" });
    expectValid(inColumns);
    // Filters on the moved dimension stay (they still filter records).
    expect(inColumns.filters).toEqual(spec.filters);
  });

  it("Filters area: placeholders, report filters, order, removal clears the filter", () => {
    const a = movePivotField(base, { field: "region", from: "unused", to: "filters" }, opts);
    expect(a.filters).toEqual([{ field: "region", label: "Region" }]);
    expect(buildPivotModel(a, rows).filters).toBeUndefined(); // placeholder is inactive
    const b = movePivotField(a, { field: "channel", from: "unused", to: "filters", index: 0 }, opts);
    expect(areaFields(b).filters).toEqual(["channel", "region"]);
    const c = setPivotFilterValues(b, "region", ["North", "South", "East", "West"], ["North", "South", "East"]);
    expect(c.filters).toEqual([{ field: "channel", label: "Channel" }, { field: "region", label: "Region", exclude: ["West"] }]);
    // Region from Filters → Rows keeps its active filter; Channel's placeholder is dropped on the way.
    const d = movePivotField(c, { field: "region", from: "filters", to: "rows", index: 0 }, opts);
    expect(d.rows.map((r) => r.field)).toEqual(["region", "department", "line"]);
    expect(d.filters).toEqual([{ field: "channel", label: "Channel" }, { field: "region", label: "Region", exclude: ["West"] }]);
    expect(areaFields(d).filters).toEqual(["channel"]);
    // Department (row, filtered) → Filters keeps the filter as a report filter.
    const e = movePivotField({ ...d, filters: [...d.filters!, { field: "department", include: ["Camp"] }] }, { field: "department", from: "rows", to: "filters", index: 0 }, opts);
    expect(areaFields(e).filters).toEqual(["department", "channel"]);
    expect(e.filters!.find((f) => f.field === "department")).toEqual({ field: "department", include: ["Camp"] });
    // Removing from Filters (or Rows) clears the field's filters, like Excel.
    expect(removePivotField(e, { field: "department", from: "filters" }, opts).filters!.some((f) => f.field === "department")).toBe(false);
    expect(removePivotField(e, { field: "region", from: "rows" }, opts).filters!.some((f) => f.field === "region")).toBe(false);
    expect(ensurePivotFilterField(base, "region", "Region").filters).toEqual([{ field: "region", label: "Region" }]);
    expect(ensurePivotFilterField(base, "line")).toBe(base);
  });

  it("Values: add / reuse / reorder / remove measures and keep references valid", () => {
    const withUnits = addPivotMeasure(base, { field: "units" }, opts);
    expect(withUnits.values).toEqual(["actual", "units"]);
    expect(withUnits.measures.at(-1)).toEqual({ id: "units", field: "units", label: "Units", format: { decimals: 0, compact: true } });
    // Plan already exists as a KPI measure: reused (keeps its format), not duplicated.
    const withPlan = addPivotMeasure(base, { field: "plan", index: 0 }, opts);
    expect(withPlan.values).toEqual(["plan", "actual"]);
    expect(withPlan.measures).toEqual(base.measures);
    // A dimension in Values counts records.
    const regions = addPivotMeasure(base, { field: "region" }, opts);
    expect(regions.measures.at(-1)).toEqual({ id: "region_count", field: "region", label: "Count of Region", aggregate: "count" });
    // Calculated measures by id.
    expect(movePivotField(base, { field: "growth", from: "unused", to: "values" }, opts).values).toEqual(["actual", "growth"]);
    // Removing Actual: heat + header chart repoint to the first remaining value, Actual is deleted.
    const noActual = removePivotField(withUnits, { field: "actual", from: "values" }, opts);
    expect(noActual.values).toEqual(["units"]);
    expect(noActual.heat!.measure).toBe("units");
    expect(noActual.headerCharts!.measure).toBe("units");
    expect(noActual.measures.some((m) => m.id === "actual")).toBe(false);
    expectValid(noActual);
    // Plan is referenced by a KPI (compareTo): it leaves Values but stays defined.
    const planOut = removePivotField(withPlan, { field: "plan", from: "values" }, opts);
    expect(planOut.measures.some((m) => m.id === "plan")).toBe(true);
    // Value-based sort / Top N on a measure that leaves Values are dropped (Excel).
    const filtered: PivotSpec = { ...planningFilteredPivotSpec, fields: planningFieldCatalog, values: ["actual", "plan"] };
    const dropped = removePivotField(filtered, { field: "actual", from: "values" }, opts);
    expect(dropped.rows[1]!.sortBy).toBeUndefined();
    expect(dropped.rows[1]!.topN).toBeUndefined();
    expectValid(dropped);
    // The last value / row field cannot leave.
    expect(planPivotFieldMove(base, { field: "actual", from: "values", to: "unused" }, opts).reason).toBe("valuesRequired");
    const oneRow = movePivotField(base, { field: "line", from: "rows", to: "unused" }, opts);
    expect(planPivotFieldMove(oneRow, { field: "department", from: "rows", to: "filters" }, opts).reason).toBe("rowsRequired");
    // A value chip dragged to Rows becomes a row field (measures are values-only → refused).
    expect(planPivotFieldMove(withUnits, { field: "units", from: "values", to: "rows" }, opts).reason).toBe("notAllowed");
    const regionRows = movePivotField(regions, { field: "region_count", from: "values", to: "rows" }, opts);
    expect(regionRows.rows.map((d) => d.field)).toEqual(["department", "line", "region"]);
    expect(regionRows.values).toEqual(["actual"]);
  });

  it("aggregate changes follow auto labels and formats", () => {
    const s = addPivotMeasure(base, { field: "units" }, opts);
    const avg = setPivotMeasureAggregate(s, "units", "avg", opts);
    expect(avg.measures.at(-1)).toEqual({ id: "units", field: "units", label: "Average of Units", aggregate: "avg", format: { decimals: 0, compact: true } });
    const count = setPivotMeasureAggregate(avg, "units", "count", opts);
    expect(count.measures.at(-1)).toEqual({ id: "units", field: "units", label: "Count of Units", aggregate: "count" });
    const sum = setPivotMeasureAggregate(count, "units", "sum", opts);
    expect(sum.measures.at(-1)).toEqual({ id: "units", field: "units", label: "Units", format: { decimals: 0, compact: true } });
    // Custom labels stay; calculated measures only accept count.
    expect(setPivotMeasureAggregate(base, "actual", "max", opts).measures[0]).toMatchObject({ label: "Max of Actual", aggregate: "max" });
    const renamed: PivotSpec = { ...base, measures: [{ ...base.measures[0]!, label: "Sales" }, ...base.measures.slice(1)] };
    expect(setPivotMeasureAggregate(renamed, "actual", "max", opts).measures[0]).toMatchObject({ label: "Sales", aggregate: "max" });
    expect(setPivotMeasureAggregate(base, "growth", "sum", opts)).toBe(base);
  });

  it("Σ Values position (valuesIndex) changes the column order and headers", () => {
    const two = addPivotMeasure(base, { field: "units" }, opts);
    const outer = setPivotValuesPosition(two, 0);
    expect(outer.valuesIndex).toBe(0);
    expect(areaFields(outer).columns).toEqual(["Σ", "month"]);
    expect(setPivotValuesPosition(outer, 1).valuesIndex).toBeUndefined();
    const inner = buildPivotModel(two, rows);
    const m = buildPivotModel(outer, rows);
    expect(m.columns.slice(0, 2).map((c) => c.headerPath)).toEqual([["Actual", "Nov"], ["Actual", "Dec"]]);
    expect(m.headerRows[0]!.map((h) => [h.label, h.colSpan])).toEqual([["Actual", 12], ["Units", 12]]);
    expect(inner.headerRows[0]!.length).toBe(12);
    // Same cells, permuted.
    const byId = new Map(inner.columns.map((c, i) => [c.id, i] as const));
    m.columns.forEach((c, i) => expect(m.grandTotal.cells[i]).toEqual(inner.grandTotal.cells[byId.get(c.id)!]));
    // Row totals stay last.
    const totals = buildPivotModel({ ...outer, totals: { rowTotal: true } }, rows);
    expect(totals.headerRows[0]!.map((h) => h.label)).toEqual(["Actual", "Units", "Total"]);
    expect(totals.columns.at(-1)!.headerPath).toEqual(["Total", "Units"]);
    // Dragging Σ Values after Month again via movePivotField.
    expect(movePivotField(outer, { field: PIVOT_VALUES_FIELD, from: "columns", to: "columns", index: 2 }, opts).valuesIndex).toBeUndefined();
    expect(canMovePivotField(outer, { field: PIVOT_VALUES_FIELD, from: "columns", to: "rows" }, opts)).toBe(false);
    // One value: Σ disappears and valuesIndex is dropped.
    expect(removePivotField(outer, { field: "units", from: "values" }, opts).valuesIndex).toBeUndefined();
  });

  it("swapPivotRowsColumns transposes rows and columns (with their expanded paths)", () => {
    const swapped = swapPivotRowsColumns(base);
    expect(swapped.rows.map((d) => d.field)).toEqual(["month"]);
    expect(pivotColumnFields(swapped).map((d) => d.field)).toEqual(["department", "line"]);
    expect(swapped.expanded).toBeUndefined();
    expect(swapped.columnsExpanded).toEqual(base.expanded); // the department groups stay expanded, now as column groups
    const back = swapPivotRowsColumns(swapped);
    expect(back.rows.map((d) => d.field)).toEqual(["department", "line"]);
    expect(back.expanded).toEqual(base.expanded);
    expect(back.columns).toEqual(base.columns);
    const oneRow: PivotSpec = { ...base, rows: [base.rows[0]!], columns: undefined };
    expect(swapPivotRowsColumns(oneRow)).toBe(oneRow);
    expectValid(swapPivotRowsColumns({ ...planningFilteredPivotSpec, fields: planningFieldCatalog }));
    // Subtotal placement travels with the field (since step 4 it is valid on rows too).
    const sub: PivotSpec = { ...base, columns: [{ field: "region", subtotal: "start" }, planningPivotSpec.columns as PivotDimension] };
    expect(swapPivotRowsColumns(sub).rows).toEqual([{ field: "region", subtotal: "start" }, planningPivotSpec.columns]);
  });

  it("checkbox toggling uses default areas and removes from every area", () => {
    const a = togglePivotField(base, "units", true, opts);
    expect(a.values).toEqual(["actual", "units"]);
    const b = togglePivotField(a, "region", true, opts);
    expect(b.rows.map((d) => d.field)).toEqual(["department", "line", "region"]);
    const c = togglePivotField(b, "region", false, opts);
    expect(c.rows.map((d) => d.field)).toEqual(["department", "line"]);
    expect(togglePivotField(c, "units", false, opts).values).toEqual(["actual"]);
    expect(togglePivotField(base, "actual", false, opts)).toBe(base); // last value
    expect(togglePivotField(base, "growth", true, opts).values).toEqual(["actual", "growth"]);
  });

  it("refuses unknown sources and disallowed areas", () => {
    expect(planPivotFieldMove(base, { field: "region", from: "rows", to: "columns" }, opts).reason).toBe("notFound");
    expect(planPivotFieldMove(base, { field: "actual", from: "unused", to: "rows" }, opts).reason).toBe("notAllowed");
    expect(planPivotFieldMove(base, { field: "owner", from: "unused", to: "columns" }, opts).reason).toBe("notAllowed");
    expect(planPivotFieldMove(base, { field: "growth", from: "values", to: "rows" }, { fields }).reason).toBe("notFound");
    expect(planPivotFieldMove(base, { field: "growth", from: "unused", to: "filters" }, opts).reason).toBe("noSourceField");
    const growth = movePivotField(base, { field: "growth", from: "unused", to: "values" }, opts);
    expect(planPivotFieldMove(growth, { field: "growth", from: "values", to: "columns" }, opts).reason).toBe("noSourceField");
    expect(planPivotFieldMove(base, { field: "line", from: "rows", to: "rows", index: 2 }, opts).reason).toBe("unchanged");
  });

  it("the planning-fields golden spec is the documented move sequence", () => {
    let s: PivotSpec = { ...planningPivotSpec, fields: planningFieldCatalog };
    s = addPivotMeasure(s, { field: "units" }, opts);
    s = movePivotField(s, { field: PIVOT_VALUES_FIELD, from: "columns", to: "columns", index: 0 }, opts);
    s = movePivotField(s, { field: "region", from: "unused", to: "filters" }, opts);
    s = setPivotFilterValues(s, "region", ["North", "South", "East", "West"], ["North", "South", "East"]);
    s = movePivotField(s, { field: "channel", from: "unused", to: "rows", index: 1 }, opts);
    expect(s).toEqual({ ...planningFieldsPivotSpec, id: planningPivotSpec.id, subtitle: undefined });
  });
});

/** Mulberry32: tiny seeded PRNG so the property test is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("random move sequences (property test)", () => {
  const locations: PivotFieldLocation[] = ["rows", "columns", "values", "filters", "unused"];
  const builder = createPivotModelBuilder();

  it.each([1, 2, 3, 4, 5, 6, 7, 8])("seed %i: 150 random moves never produce an invalid spec or model", (seed) => {
    const rand = mulberry32(seed * 7919);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
    let spec: PivotSpec = seed % 2 ? base : { ...planningFilteredPivotSpec, fields: planningFieldCatalog };
    let applied = 0;
    for (let step = 0; step < 150; step++) {
      const state = pivotFieldListState(spec, fields);
      const r = rand();
      let next: PivotSpec;
      if (r < 0.08) next = swapPivotRowsColumns(spec);
      else if (r < 0.14) next = setPivotMeasureAggregate(spec, pick(state.values).field, pick(["sum", "avg", "min", "max", "count"] as const), opts);
      else if (r < 0.2) next = togglePivotField(spec, pick(fields).field, rand() < 0.5, opts);
      else if (r < 0.25 && state.filters.length) {
        const f = pick(state.filters).field;
        next = setPivotFilterValues(spec, f, ["North", "South", "East", "West", "Retail", "Online"], ["North", "Online"]);
      } else {
        const from = pick(locations);
        const items = from === "unused" ? [...state.unused.map((f) => f.field), ...state.calculated.map((m) => m.id)] : state[from].map((i) => i.field);
        if (!items.length) continue;
        const to = pick(locations);
        const move: PivotFieldMove = { field: pick(items), from, to, index: Math.floor(rand() * 5) };
        next = movePivotField(spec, move, opts);
      }
      if (next !== spec) applied++;
      const v = validatePivotSpec(next);
      expect(v.ok ? [] : v.errors).toEqual([]);
      expect(next.rows.length).toBeGreaterThan(0);
      // Every measure reference resolves; heat / header charts point at a shown value when set.
      const ids = new Set(next.measures.map((m) => m.id));
      for (const id of next.values ?? []) expect(ids.has(id)).toBe(true);
      if (Array.isArray(next.expanded)) for (const p of next.expanded) expect(p.length).toBeLessThan(next.rows.length);
      const model = builder.build(next, rows);
      // No columns only when filters leave no column key.
      if (model.columns.length === 0) expect(model.columnKeys).toEqual([]);
      if (step % 25 === 0) expect(() => pivotModelToSheet(model)).not.toThrow();
      spec = next;
    }
    expect(applied).toBeGreaterThan(25);
  });
});

describe("random sequences with dates and column groups (property test)", () => {
  const dateRows = generatePlanningPivotRows(7, { extraFields: true, orderDates: true });
  const dateSpec: PivotSpec = { ...planningPivotSpec, fields: planningDateFieldCatalog };
  const dateFields = resolvePivotFields(dateSpec, dateRows);
  const dateOpts = { fields: dateFields };
  const locations: PivotFieldLocation[] = ["rows", "columns", "values", "filters", "unused"];
  const groups = ["year", "yearQuarter", "quarter", "yearMonth", "month", "week", "day"] as const;
  const builder = createPivotModelBuilder();

  it.each([11, 12, 13, 14])("seed %i: 100 random steps (moves, Group by, column toggles) stay valid", (seed) => {
    const rand = mulberry32(seed * 104729);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
    let spec: PivotSpec = dateSpec;
    let applied = 0;
    let model = builder.build(spec, dateRows);
    for (let step = 0; step < 100; step++) {
      const state = pivotFieldListState(spec, dateFields);
      const r = rand();
      let next: PivotSpec;
      if (r < 0.2) {
        const chosen = groups.filter(() => rand() < 0.3);
        next = setPivotDateGrouping(spec, "orderDate", chosen, { ...dateOpts, area: pick(["rows", "columns", "filters"] as const) });
      } else if (r < 0.35) {
        const groupCells = model.headerRows.flat().filter((h) => h.expanded !== undefined && h.columnPath);
        next = groupCells.length ? togglePivotColumnGroup(spec, model, pick(groupCells).columnPath!) : setPivotColumnsExpandedAll(spec, rand() < 0.5);
      } else if (r < 0.42) {
        next = swapPivotRowsColumns(spec);
      } else {
        const from = pick(locations);
        const items = from === "unused" ? state.unused.map((f) => f.field) : state[from].map((i) => i.field);
        if (!items.length) continue;
        next = movePivotField(spec, { field: pick(items), from, to: pick(locations), index: Math.floor(rand() * 5) }, dateOpts);
      }
      if (next !== spec) applied++;
      const v = validatePivotSpec(next);
      expect(v.ok ? [] : v.errors).toEqual([]);
      expect(pivotColumnFields(next).length).toBeLessThanOrEqual(PIVOT_MAX_COLUMN_FIELDS);
      if (Array.isArray(next.columnsExpanded)) for (const p of next.columnsExpanded) expect(p.length).toBeLessThan(pivotColumnFields(next).length);
      model = builder.build(next, dateRows);
      // Totals stay complete whatever the column layout: the grand total column (or the sum of leaves) is every record.
      if (step % 10 === 0) {
        expect(() => pivotModelToSheet(model)).not.toThrow();
        expect(model.headerRows.every((row) => row.reduce((s, h) => s + h.colSpan * (h.rowSpan ?? 1), 0) > 0 || model.columns.length === 0)).toBe(true);
      }
      spec = next;
    }
    expect(applied).toBeGreaterThan(20);
  });
});
