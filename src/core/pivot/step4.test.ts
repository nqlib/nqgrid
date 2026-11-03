import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import { generatePlanningPivotRows, planningCalcPivotSpec } from "../../fixtures/planning-pivot-mock";
import { buildPivotModel, createPivotModelBuilder, pivotCellDrillTarget, PIVOT_GRAND_TOTAL_ROW_ID, pivotSubtotalRowId } from "./build-model";
import { PIVOT_OTHER_KEY, pivotDrillThrough } from "./cube";
import { movePivotField, pivotFieldListState, removePivotField, setPivotMeasureAggregate } from "./fields";
import {
  checkPivotCalculatedMeasure,
  planPivotCalculatedMeasure,
  removePivotMeasure,
  setPivotCalculatedMeasure,
  setPivotMeasureShowAs,
  setPivotSubtotal,
} from "./measures";
import { pivotModelToSheet } from "./to-sheet";
import type { PivotDataRow, PivotModel, PivotSpec } from "./types";
import { PIVOT_SPEC_JSON_SCHEMA } from "./schema";
import { validatePivotSpec } from "./validate";

const data = [
  { dept: "Camp", line: "Tents", month: "Nov", sales: 300, plan: 200, customer: "a" },
  { dept: "Camp", line: "Tents", month: "Dec", sales: 400, plan: 400, customer: "b" },
  { dept: "Camp", line: "Chairs", month: "Nov", sales: 100, plan: 100, customer: "a" },
  { dept: "Camp", line: "Chairs", month: "Dec", sales: 50, plan: 0, customer: "" },
  { dept: "Footwear", line: "Boots", month: "Nov", sales: 600, plan: 500, customer: "c" },
  { dept: "Footwear", line: "Boots", month: "Dec", sales: 200, plan: 250, customer: "a" },
  { dept: "Footwear", line: "Socks", month: "Dec", sales: 70, plan: 70, customer: null },
];

const base: PivotSpec = {
  version: 1,
  rows: [{ field: "dept" }, { field: "line" }],
  columns: { field: "month", order: ["Nov", "Dec"] },
  measures: [
    { id: "sales", field: "sales" },
    { id: "plan", field: "plan" },
  ],
  values: ["sales"],
};

const row = (m: PivotModel, path: string) => m.rows.find((r) => r.path.join(">") === path && r.kind !== "subtotal")!;
const values = (r: { cells: readonly { value: number | null }[] }) => r.cells.map((c) => c.value);

describe("calculated measures", () => {
  const spec: PivotSpec = {
    ...base,
    measures: [...base.measures, { id: "vs", calculate: "sales / plan - 1" }, { id: "gap", calculate: "sales - plan" }, { id: "double", calculate: "gap * 2" }],
    values: ["vs", "double"],
    totals: { rowTotal: true },
  };

  it("evaluate over aggregated bucket values (Excel semantics), never summing ratios", () => {
    const m = buildPivotModel(spec, data);
    // Columns: Nov vs, Nov double, Dec vs, Dec double, total vs, total double.
    const tents = row(m, "Camp>Tents");
    expect(tents.cells[0]!.value).toBeCloseTo(0.5);
    expect(tents.cells[3]!.value).toBe(0);
    expect(tents.cells[4]!.value).toBeCloseTo(700 / 600 - 1);
    // Chairs Dec: plan 0 → division by zero → blank.
    expect(row(m, "Camp>Chairs").cells[2]).toMatchObject({ value: null, text: "" });
    // Camp total: sum(sales) / sum(plan) - 1 over all its records.
    expect(row(m, "Camp").cells[4]!.value).toBeCloseTo(850 / 700 - 1);
    expect(m.grandTotal.cells[4]!.value).toBeCloseTo(1720 / 1520 - 1);
    // A calculated measure over another one.
    expect(m.grandTotal.cells[5]!.value).toBe((1720 - 1520) * 2);
    // No records in a bucket → blank even for constants.
    const socks = row(m, "Footwear>Socks");
    expect(socks.cells[0]!.value).toBeNull();
  });

  it("feed showAs, heat, header charts, KPIs, sort by value and Top N", () => {
    const m = buildPivotModel(
      {
        ...spec,
        rows: [{ field: "dept" }, { field: "line", sortBy: { measure: "gap", direction: "desc" }, topN: { measure: "gap", count: 1, other: true } }],
        measures: [...spec.measures.slice(0, 4), { id: "gapShare", calculate: "sales - plan", showAs: "percentOfColumnTotal" }],
        values: ["gap", "gapShare"],
        heat: { measure: "gap", scope: "all" },
        headerCharts: { measure: "gap" },
        kpis: [{ id: "k", measure: "vs", compareTo: "gap" }],
      },
      data,
    );
    expect(m.rows.filter((r) => r.kind === "leaf").map((r) => r.path.join(">"))).toEqual(["Camp>Tents", `Camp>${PIVOT_OTHER_KEY}`, "Footwear>Boots", `Footwear>${PIVOT_OTHER_KEY}`]);
    expect(m.headerSeries!.points.map((p) => p.value)).toEqual([200, 0]);
    expect(m.kpis[0]!.value).toBeCloseTo(1720 / 1520 - 1);
    expect(row(m, "Camp>Tents").cells[0]!.heat).toBeDefined();
    // percentOfColumnTotal of a calculated measure: its value over the grand total's.
    expect(row(m, "Camp>Tents").cells[1]!.value).toBeCloseTo(100 / 200);
  });

  it("validation: grammar, unknown references, cycles, field / aggregate conflicts", () => {
    const bad = (measures: PivotSpec["measures"]) => {
      const r = validatePivotSpec({ ...base, measures, values: [measures[0]!.id] });
      return r.ok ? [] : r.errors;
    };
    expect(bad([{ id: "x", calculate: "sales +" }, ...base.measures])).toEqual(["measures[0].calculate: unexpected end of expression (at 7)"]);
    expect(bad([{ id: "x", calculate: "salez * 2" }, ...base.measures])).toEqual(['measures[0].calculate: unknown measure "salez" (at 0)']);
    expect(bad([{ id: "x", calculate: "y + 1" }, { id: "y", calculate: "x * 2" }, ...base.measures])).toEqual(["measures[0].calculate: reference cycle x → y → x"]);
    expect(bad([{ id: "x", calculate: "x" }, ...base.measures])).toEqual(["measures[0].calculate: reference cycle x → x"]);
    expect(bad([{ id: "x", calculate: "sales", field: "sales" }, ...base.measures])).toEqual(["measures[0]: calculate cannot be combined with field or aggregate"]);
    expect(bad([{ id: "x", calculate: "constructor" }, ...base.measures])[0]).toMatch(/reserved/);
    expect(bad([{ id: "x", calculate: "eval(sales)" }, ...base.measures])[0]).toMatch(/unknown function "eval"/);
    expect(() => buildPivotModel({ ...base, measures: [{ id: "x", calculate: "x" }], values: ["x"] }, data, { validate: false })).toThrow(/cycle/);
  });

  it("helpers: add / update / check / remove, field-list state, kept when unchecked", () => {
    expect(checkPivotCalculatedMeasure(base, "sales / plann")).toMatchObject({ code: "unknownReference", position: 8 });
    const plan = planPivotCalculatedMeasure(base, { label: "Margin %", calculate: "sales / plan - 1", format: { style: "percent" } });
    expect(plan).toMatchObject({ changed: true, measureId: "margin" });
    expect(plan.spec.values).toEqual(["sales", "margin"]);
    expect(validatePivotSpec(plan.spec).ok).toBe(true);
    const updated = setPivotCalculatedMeasure(plan.spec, { id: "margin", calculate: "sales - plan" });
    expect(updated.measures.find((m) => m.id === "margin")).toEqual({ id: "margin", label: "Margin %", calculate: "sales - plan", format: { style: "percent" } });
    expect(planPivotCalculatedMeasure(base, { id: "sales", calculate: "plan" }).error?.code).toBe("idTaken");
    expect(planPivotCalculatedMeasure(plan.spec, { id: "other", calculate: "margin + 1" }).changed).toBe(true);
    const cyc = setPivotCalculatedMeasure(plan.spec, { id: "other", calculate: "margin + 1" });
    expect(planPivotCalculatedMeasure(cyc, { id: "margin", calculate: "other" }).error?.code).toBe("cycle");
    // Field list: listed as calculated with its expression; unchecking keeps it in `measures`.
    const state = pivotFieldListState(plan.spec);
    expect(state.calculated).toEqual([{ id: "margin", label: "Margin %", inValues: true, calculate: "sales / plan - 1" }]);
    expect(state.values[1]).toMatchObject({ field: "margin", calculated: true, calculate: "sales / plan - 1" });
    const unchecked = removePivotField(plan.spec, { field: "margin", from: "values" });
    expect(unchecked.values).toEqual(["sales"]);
    expect(unchecked.measures.map((m) => m.id)).toEqual(["sales", "plan", "margin"]);
    // A measure a calculated one references stays when it leaves Values.
    const both = { ...plan.spec, values: ["plan", "margin"] };
    expect(removePivotField(both, { field: "plan", from: "values" }).measures.map((m) => m.id)).toEqual(["sales", "plan", "margin"]);
    // removePivotMeasure: refused while referenced, otherwise deletes everywhere.
    expect(removePivotMeasure(plan.spec, "plan")).toBe(plan.spec);
    expect(removePivotMeasure(plan.spec, "margin").measures.map((m) => m.id)).toEqual(["sales", "plan"]);
    expect(setPivotMeasureAggregate(plan.spec, "margin", "count")).toBe(plan.spec);
  });
});

describe("distinct count", () => {
  const spec: PivotSpec = {
    ...base,
    measures: [...base.measures, { id: "customers", field: "customer", aggregate: "distinctCount" }],
    values: ["customers"],
    totals: { rowTotal: true },
  };

  it("counts distinct non-blank keys per bucket; totals are distinct over their records", () => {
    const m = buildPivotModel(spec, data);
    expect(values(row(m, "Camp>Tents"))).toEqual([1, 1, 2]);
    expect(values(row(m, "Camp>Chairs"))).toEqual([1, 0, 1]); // "" is blank
    expect(values(row(m, "Camp"))).toEqual([1, 1, 2]); // Nov: a (Tents) + a (Chairs) = 1, not 2
    expect(values(row(m, "Footwear>Socks"))).toEqual([null, 0, 0]); // null customer
    expect(values(m.grandTotal)).toEqual([2, 2, 3]);
  });

  it("respects filters, column groups and date fields; the field list offers it", () => {
    const filtered = buildPivotModel({ ...spec, filters: [{ field: "line", exclude: ["Tents"] }] }, data);
    expect(values(filtered.grandTotal)).toEqual([2, 1, 2]);
    const nested = buildPivotModel({ ...spec, columns: [{ field: "dept" }, { field: "month" }], rows: [{ field: "line" }] }, data);
    // Group column "Camp" counts distinct customers of all Camp records (a, b) = 2.
    const camp = nested.columns.findIndex((c) => c.subtotal && c.columnKey === "Camp");
    expect(nested.grandTotal.cells[camp]!.value).toBe(2);
    const dates = [
      { day: "2026-01-03", who: "x" },
      { day: "2026-01-20", who: "x" },
      { day: "2026-02-01", who: "y" },
    ];
    const dm = buildPivotModel({ version: 1, rows: [{ field: "day:yearMonth" }], measures: [{ id: "n", field: "who", aggregate: "distinctCount" }] }, dates);
    expect(dm.rows.map((r) => r.cells[0]!.value)).toEqual([1, 1, 2]);
    expect(setPivotMeasureAggregate({ ...base, measures: [{ id: "c", field: "customer", format: { decimals: 1 } }], values: ["c"] }, "c", "distinctCount").measures[0]).toEqual({
      id: "c",
      field: "customer",
      aggregate: "distinctCount",
      label: "Distinct Count of Customer",
    });
  });
});

describe("row subtotal positions", () => {
  it("start (default), end (subtotal rows) and none; collapsed groups keep their totals", () => {
    const end = buildPivotModel({ ...base, rows: [{ field: "dept", subtotal: "end" }, { field: "line" }], expanded: [["Camp"]] }, data);
    expect(end.rows.map((r) => `${r.kind}:${r.label}`)).toEqual([
      "group:Camp",
      "leaf:Tents",
      "leaf:Chairs",
      "subtotal:Camp Total",
      "group:Footwear",
      "grandTotal:Grand Total",
    ]);
    expect(end.rows[0]).toMatchObject({ subtotal: "end", cells: [{ value: null, raw: null, text: "" }, { value: null, raw: null, text: "" }] });
    expect(end.rows[3]).toMatchObject({ id: pivotSubtotalRowId(["Camp"]), depth: 0, path: ["Camp"], cells: [{ value: 400 }, { value: 450 }] });
    expect(end.rows[4]!.subtotal).toBeUndefined(); // collapsed → shows its totals
    expect(values(end.rows[4]!)).toEqual([600, 270]);
    // Spans cover the subtotal row; the sheet keeps it out of the merge and labels it in the group column.
    expect(end.spans[0]![0]).toEqual({ rowIndex: 0, span: 4, path: ["Camp"] });
    const sheet = pivotModelToSheet(end);
    expect(sheet.merges).toContainEqual({ row: 1, col: 0, rowSpan: 3, colSpan: 1 });
    expect(sheet.cells[4]!.slice(0, 2).map((c) => c.v)).toEqual(["Camp Total", null]);

    const none = buildPivotModel({ ...base, rows: [{ field: "dept", subtotal: "none" }, { field: "line" }], totals: { subtotalLabel: "Σ {label}" } }, data);
    expect(none.rows.some((r) => r.kind === "subtotal")).toBe(false);
    expect(none.rows.filter((r) => r.kind === "group").every((r) => r.subtotal === "none" && r.cells.every((c) => c.text === ""))).toBe(true);
    const labelled = buildPivotModel({ ...base, rows: [{ field: "dept", subtotal: "end" }, { field: "line" }], totals: { subtotalLabel: "Σ {label}" } }, data);
    expect(labelled.rows.filter((r) => r.kind === "subtotal").map((r) => r.label)).toEqual(["Σ Camp", "Σ Footwear"]);
    // Ignored on the innermost row field; view-only (the cube is reused).
    expect(buildPivotModel({ ...base, rows: [{ field: "dept" }, { field: "line", subtotal: "end" }] }, data).rows.map((r) => r.kind)).toEqual(["group", "leaf", "leaf", "group", "leaf", "leaf", "grandTotal"]);
  });

  it("setPivotSubtotal writes non-defaults only, for rows and columns", () => {
    const a = setPivotSubtotal(base, "dept", "end");
    expect(a.rows[0]).toEqual({ field: "dept", subtotal: "end" });
    expect(setPivotSubtotal(a, "dept", "start").rows[0]).toEqual({ field: "dept" });
    expect(setPivotSubtotal(base, "dept", "start")).toBe(base);
    const cols: PivotSpec = { ...base, rows: [{ field: "line" }], columns: [{ field: "dept" }, { field: "month" }] };
    expect(setPivotSubtotal(cols, "dept", "start").columns).toEqual([{ field: "dept", subtotal: "start" }, { field: "month" }]);
    expect(setPivotSubtotal(cols, "dept", "end")).toBe(cols);
    // A row field with subtotal: "end" keeps it when moved into Columns.
    expect(movePivotField(a, { field: "dept", from: "rows", to: "columns", index: 0 }).columns).toEqual([{ field: "dept", subtotal: "end" }, base.columns]);
  });
});

describe("show values as: differences, running totals, ranks", () => {
  const sales = (showAs: PivotSpec["measures"][number]["showAs"], showAsBase: PivotSpec["measures"][number]["showAsBase"], extra: object = {}): PivotSpec => ({
    ...base,
    measures: [{ id: "sales", field: "sales", showAs, showAsBase, ...extra }, base.measures[1]!],
    totals: { rowTotal: true },
  });

  it("differenceFrom along a column field: previous / next / named item; first item and the base itself blank", () => {
    const prev = buildPivotModel(sales("differenceFrom", { field: "month" }), data);
    expect(values(row(prev, "Camp>Tents"))).toEqual([null, 100, null]); // total column is outside the field
    expect(prev.rows[0]!.cells[1]!.showAs).toBe("differenceFrom");
    const next = buildPivotModel(sales("differenceFrom", { field: "month", position: "next" }), data);
    expect(values(row(next, "Camp>Tents"))).toEqual([-100, null, null]);
    const named = buildPivotModel(sales("percentDifferenceFrom", { field: "month", item: "Dec" }), data);
    expect(values(row(named, "Camp>Tents"))[0]).toBeCloseTo(300 / 400 - 1);
    expect(values(row(named, "Camp>Tents"))[1]).toBeNull();
    // Missing base (no Nov for Socks) → blank; a base value of 0 → blank for the percent kind.
    expect(values(row(prev, "Footwear>Socks"))).toEqual([null, null, null]);
    const missingItem = buildPivotModel(sales("differenceFrom", { field: "month", item: "Jan" }), data);
    expect(values(missingItem.grandTotal)).toEqual([null, null, null]);
  });

  it("along a row field: siblings within the parent; deeper rows map by their relative path; rows above it are blank", () => {
    const m = buildPivotModel(sales("differenceFrom", { field: "line" }), data);
    expect(values(row(m, "Camp>Chairs"))).toEqual([100 - 300, 50 - 400, 150 - 700]);
    expect(values(row(m, "Camp>Tents"))).toEqual([null, null, null]);
    expect(values(row(m, "Camp"))).toEqual([null, null, null]);
    const byDept = buildPivotModel(sales("differenceFrom", { field: "dept" }, { groupShowAs: "differenceFrom" }), data);
    expect(values(row(byDept, "Footwear"))).toEqual([600 - 400, 270 - 450, 870 - 850]);
    // Footwear>Boots vs Camp>Boots: no such line → blank.
    expect(values(row(byDept, "Footwear>Boots"))).toEqual([null, null, null]);
  });

  it("running totals and % running totals; ranks with ties", () => {
    const run = buildPivotModel(sales("runningTotal", { field: "month" }), data);
    expect(values(row(run, "Camp>Tents"))).toEqual([300, 700, 700]); // total column: the value itself
    expect(values(row(run, "Footwear>Socks"))).toEqual([null, 70, 70]); // no Nov data: blank
    const pct = buildPivotModel(sales("percentRunningTotal", { field: "line" }, { groupShowAs: "percentRunningTotal" }), data);
    expect(values(row(pct, "Camp>Tents"))[2]).toBeCloseTo(700 / 850);
    expect(values(row(pct, "Camp>Chairs"))[2]).toBe(1);
    expect(values(row(pct, "Camp"))).toEqual([1, 1, 1]); // above the field: 100 %
    expect(row(pct, "Camp>Tents").cells[2]!.text).toBe("82%");
    const tie = [...data, { dept: "Camp", line: "Mats", month: "Nov", sales: 100, plan: 1, customer: "z" }];
    const rank = buildPivotModel(sales("rankDescending", { field: "line" }), tie);
    expect(["Camp>Tents", "Camp>Chairs", "Camp>Mats"].map((p) => row(rank, p).cells[0]!.value)).toEqual([1, 2, 2]);
    expect(row(rank, "Camp>Tents").cells[0]!.text).toBe("1");
    const asc = buildPivotModel(sales("rankAscending", { field: "line" }), tie);
    expect(["Camp>Tents", "Camp>Chairs", "Camp>Mats"].map((p) => row(asc, p).cells[0]!.value)).toEqual([3, 1, 1]);
    expect(pivotModelToSheet(asc).cells[2]![2]!.numFmt).toBe("0");
  });

  it("validation and setPivotMeasureShowAs; bases leaving the layout reset to plain values", () => {
    const missing = validatePivotSpec({ ...base, measures: [{ id: "sales", field: "sales", showAs: "runningTotal" }] });
    expect(missing.ok ? [] : missing.errors).toEqual(["measures[0].showAsBase is required by its showAs / groupShowAs"]);
    const wrong = validatePivotSpec({ ...base, measures: [{ id: "sales", field: "sales", showAs: "runningTotal", showAsBase: { field: "customer" } }] });
    expect(wrong.ok ? [] : wrong.errors).toEqual(['measures[0].showAsBase.field "customer" is not a row or column field']);
    const s = setPivotMeasureShowAs(base, "sales", "differenceFrom", { field: "month", position: "previous" });
    expect(s.measures[0]).toEqual({ id: "sales", field: "sales", showAs: "differenceFrom", showAsBase: { field: "month", position: "previous" } });
    expect(setPivotMeasureShowAs(base, "sales", "differenceFrom", { field: "customer" })).toBe(base);
    expect(setPivotMeasureShowAs(s, "sales", "value").measures[0]).toEqual({ id: "sales", field: "sales" });
    expect(setPivotMeasureShowAs(base, "sales", "percentOfParentRow", null, { scope: "group" }).measures[0]).toEqual({ id: "sales", field: "sales", groupShowAs: "percentOfParentRow" });
    const moved = movePivotField(s, { field: "month", from: "columns", to: "unused" });
    expect(moved.measures[0]).toEqual({ id: "sales", field: "sales" });
    expect(validatePivotSpec(moved).ok).toBe(true);
  });
});

describe("drill-through", () => {
  const spec: PivotSpec = { ...base, totals: { rowTotal: true } };
  const recs = (m: PivotModel, rows: readonly PivotDataRow[], s: PivotSpec, rowPath: string, col: number) => {
    const r = rowPath === "" ? m.grandTotal : m.rows.find((x) => x.path.join(">") === rowPath)!;
    return pivotDrillThrough(s, rows, pivotCellDrillTarget(m, r, col));
  };

  it("leaf, group, total cells and the row-total column", () => {
    const m = buildPivotModel(spec, data);
    const leaf = recs(m, data, spec, "Camp>Tents", 0);
    expect(leaf.records).toEqual([data[0]]);
    expect(leaf).toMatchObject({ total: 1, truncated: false, indices: [0], fields: ["dept", "line", "month", "sales"] });
    expect(recs(m, data, spec, "Camp", 2).indices).toEqual([0, 1, 2, 3]);
    expect(recs(m, data, spec, "", 1).indices).toEqual([1, 3, 5, 6]);
    expect(recs(m, data, spec, "", 2).total).toBe(data.length);
    expect(pivotDrillThrough(spec, data, { path: ["Nope"] }).total).toBe(0);
    expect(pivotDrillThrough(spec, data, { path: ["Camp"] }, { limit: 2, offset: 1 })).toMatchObject({ indices: [1, 2], total: 4, truncated: true });
    // A group's subtotal row has the group's path: same records.
    const end = buildPivotModel({ ...spec, rows: [{ field: "dept", subtotal: "end" }, { field: "line" }] }, data);
    const sub = end.rows.find((r) => r.kind === "subtotal")!;
    expect(pivotDrillThrough(spec, data, pivotCellDrillTarget(end, sub, 2)).total).toBe(sub.sourceRowCount);
    expect(end.grandTotal.id).toBe(PIVOT_GRAND_TOTAL_ROW_ID);
  });

  it("filters, Top N (Other / cut keys), date grouping, nested columns and calculated measure fields", () => {
    const s: PivotSpec = {
      ...spec,
      rows: [{ field: "dept" }, { field: "line", topN: { measure: "sales", count: 1, other: true } }],
      filters: [{ field: "month", exclude: ["Dec"] }],
      measures: [...base.measures, { id: "vs", calculate: "sales / plan" }],
    };
    const m = buildPivotModel(s, data);
    const other = m.rows.find((r) => r.path[1] === PIVOT_OTHER_KEY && r.path[0] === "Camp")!;
    const d = pivotDrillThrough(s, data, { ...pivotCellDrillTarget(m, other, 0), measureId: "vs" });
    expect(d.indices).toEqual([2]); // Chairs Nov (Dec excluded by the filter)
    expect(d.fields).toEqual(["dept", "line", "month", "sales", "plan"]);
    expect(d.total).toBe(other.sourceRowCount);
    const cut: PivotSpec = { ...s, rows: [{ field: "dept" }, { field: "line", topN: { measure: "sales", count: 1 } }] };
    expect(pivotDrillThrough(cut, data, { path: ["Camp", "Chairs"] }).total).toBe(0);
    expect(pivotDrillThrough(cut, data, { path: ["Camp"] }).indices).toEqual([0]);

    const dates = [
      { day: "2025-12-03", v: 1, r: "N" },
      { day: "2026-01-20", v: 2, r: "S" },
      { day: "2026-02-01", v: 3, r: "N" },
    ];
    const ds: PivotSpec = { version: 1, rows: [{ field: "r" }], columns: [{ field: "day:year" }, { field: "day:month" }], measures: [{ id: "v", field: "v" }] };
    const dm = buildPivotModel(ds, dates);
    const col = dm.columns.findIndex((c) => c.columnPath?.join("/") === "2026/02");
    expect(pivotDrillThrough(ds, dates, pivotCellDrillTarget(dm, dm.rows.find((r) => r.label === "N")!, col)).records).toEqual([dates[2]]);
    const yearCol = dm.columns.findIndex((c) => c.subtotal && c.columnKey === "2026");
    expect(pivotDrillThrough(ds, dates, pivotCellDrillTarget(dm, dm.grandTotal, yearCol)).total).toBe(2);
    expect(pivotDrillThrough(ds, dates, { path: [] }).fields).toEqual(["r", "day", "v"]);
    // The builder reuses its encoding.
    const builder = createPivotModelBuilder();
    builder.build(ds, dates);
    expect(builder.drillThrough(ds, dates, { path: ["S"] }).indices).toEqual([1]);
  });

  it("matches sourceRowCount for every planning-calc row", () => {
    const rows = generatePlanningPivotRows(7, { extraFields: true, orderDates: true });
    const m = buildPivotModel(planningCalcPivotSpec, rows);
    for (const r of m.rows) expect(pivotDrillThrough(planningCalcPivotSpec, rows, { path: r.path }, { limit: 0 }).total).toBe(r.sourceRowCount);
  });
});

describe("JSON Schema (additive v1)", () => {
  const validateSchema = new Ajv2020({ allErrors: true }).compile(PIVOT_SPEC_JSON_SCHEMA);
  it("accepts the step-4 shapes", () => {
    for (const spec of [
      planningCalcPivotSpec,
      { ...base, measures: [...base.measures, { id: "c", field: "customer", aggregate: "distinctCount" }] },
      { ...base, rows: [{ field: "dept", subtotal: "end" }, { field: "line" }] },
      { ...base, measures: [{ id: "sales", field: "sales", showAs: "differenceFrom", showAsBase: { field: "month", item: "Nov" } }] },
    ]) {
      expect(validateSchema(spec), JSON.stringify(validateSchema.errors)).toBe(true);
      expect(validatePivotSpec(spec).ok).toBe(true);
    }
  });
  it.each(Object.entries({
    "calculate with field": { ...base, measures: [{ id: "x", calculate: "1", field: "sales" }] },
    "calculate with aggregate": { ...base, measures: [{ id: "x", calculate: "1", aggregate: "sum" }] },
    "empty calculate": { ...base, measures: [{ id: "x", calculate: "" }] },
    "distinctCount without field": { ...base, measures: [{ id: "x", aggregate: "distinctCount" }] },
    "bad showAs": { ...base, measures: [{ id: "x", field: "sales", showAs: "differenceFromPrevious" }] },
    "bad showAsBase position": { ...base, measures: [{ id: "x", field: "sales", showAs: "differenceFrom", showAsBase: { field: "month", position: "first" } }] },
  }))("rejects %s in both validators", (_name, spec) => {
    expect(validateSchema(spec)).toBe(false);
    expect(validatePivotSpec(spec).ok).toBe(false);
  });
});
