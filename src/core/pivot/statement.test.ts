import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import { generateStatementPivotRows, statementPivotSpec } from "../../fixtures/statement-pivot-mock";
import { buildPivotModel, createPivotModelBuilder, pivotModelFromCube } from "./build-model";
import { buildPivotCube, pivotDrillThrough, pivotSpecDataKey } from "./cube";
import { movePivotField, setPivotMeasureAggregate } from "./fields";
import { setPivotMeasureShowAs, setPivotMeasureSignField } from "./measures";
import { PIVOT_SPEC_JSON_SCHEMA } from "./schema";
import { pivotModelToSheet } from "./to-sheet";
import type { PivotDataRow, PivotMeasure, PivotModel, PivotSpec } from "./types";
import { validatePivotSpec } from "./validate";

/** P&L-shaped records: two sections, the Revenue line under both in `dup` mode. */
const rows: PivotDataRow[] = [
  { s: "GM", l: "Revenue", m: "Jan", v: 1000, sign: 1, d: "a" },
  { s: "GM", l: "COGS", m: "Jan", v: 600, sign: -1, d: "a" },
  { s: "OPEX", l: "Rent", m: "Jan", v: 250, sign: "-1", d: "b" },
  { s: "GM", l: "Revenue", m: "Feb", v: 500, sign: 1, d: "b" },
  { s: "GM", l: "COGS", m: "Feb", v: 400, sign: -1, d: "a" },
  { s: "OPEX", l: "Rent", m: "Feb", v: 300, sign: "-1", d: "a" },
];

const base = (measures: PivotMeasure[], extra: Partial<PivotSpec> = {}): PivotSpec => ({
  version: 1,
  rows: [{ field: "s", subtotal: "end" }, { field: "l" }],
  columns: { field: "m" },
  measures,
  totals: { rowTotal: true },
  ...extra,
});

/** `label → cell texts` of every body row (subtotal rows prefixed with `=`). */
const table = (model: PivotModel) =>
  Object.fromEntries(model.rows.map((r) => [`${r.kind === "subtotal" ? "=" : r.kind === "group" ? "#" : ""}${r.label}`, r.cells.map((c) => c.text)]));

describe("percentOf (Excel % Of)", () => {
  const amount: PivotMeasure = { id: "amt", field: "v", signField: "sign" };

  it("parent scope: siblings of the same parent only, the base item is 100 %, groups and totals empty", () => {
    const model = buildPivotModel(
      base([amount, { id: "pct", field: "v", signField: "sign", showAs: "percentOf", showAsBase: { field: "l", item: "Revenue" } }], { values: ["pct"] }),
      rows,
    );
    expect(table(model)).toEqual({
      "#GM": ["", "", ""],
      Revenue: ["100%", "100%", "100%"],
      COGS: ["-60%", "-80%", "-67%"],
      "=GM Total": ["", "", ""],
      "#OPEX": ["", "", ""],
      Rent: ["", "", ""],
      "=OPEX Total": ["", "", ""],
      "Grand Total": ["", "", ""],
    });
    expect(model.rows[1]!.cells[0]!.showAs).toBe("percentOf");
  });

  it("along a column field: value / the base column of the same row (Excel sibling semantics)", () => {
    const spec: PivotSpec = {
      version: 1,
      rows: [{ field: "l" }],
      columns: { field: "m" },
      measures: [{ id: "pct", field: "v", showAs: "percentOf", showAsBase: { field: "m", item: "Jan" } }],
      totals: { rowTotal: true },
    };
    const model = buildPivotModel(spec, rows);
    expect(table(model)).toEqual({
      Revenue: ["100%", "50%", ""],
      COGS: ["100%", "67%", ""],
      Rent: ["100%", "120%", ""],
      "Grand Total": ["100%", "65%", ""],
    });
  });

  it('scope "all": every row (groups, subtotals, grand total) against the base item across parents, per column', () => {
    const spec = base(
      [amount, { id: "pct", field: "v", signField: "sign", showAs: "percentOf", showAsBase: { field: "l", item: "Revenue", scope: "all" }, percentFormat: { style: "percent", decimals: 1 } }],
      { rows: [{ field: "s" }, { field: "l" }], values: ["amt", "pct"], valuesIndex: 0 },
    );
    const model = buildPivotModel(spec, rows);
    expect(model.columns.map((c) => c.headerPath.join(" "))).toEqual(["amt Jan", "amt Feb", "pct Jan", "pct Feb", "Total amt", "Total pct"]);
    expect(table(model)).toEqual({
      "#GM": ["400", "100", "40.0%", "20.0%", "500", "33.3%"],
      Revenue: ["1,000", "500", "100.0%", "100.0%", "1,500", "100.0%"],
      COGS: ["-600", "-400", "-60.0%", "-80.0%", "-1,000", "-66.7%"],
      "#OPEX": ["-250", "-300", "-25.0%", "-60.0%", "-550", "-36.7%"],
      Rent: ["-250", "-300", "-25.0%", "-60.0%", "-550", "-36.7%"],
      "Grand Total": ["150", "-200", "15.0%", "-40.0%", "-50", "-3.3%"],
    });
  });

  it('scope "all" merges the item across parents (sum, avg, min); distinct counts there are empty', () => {
    const dup = [...rows, { s: "OPEX", l: "Revenue", m: "Jan", v: 200, sign: 1, d: "c" }];
    const measures: PivotMeasure[] = [
      { id: "sum", field: "v", showAs: "percentOf", showAsBase: { field: "l", item: "Revenue", scope: "all" } },
      { id: "avg", field: "v", aggregate: "avg", showAs: "percentOf", showAsBase: { field: "l", item: "Revenue", scope: "all" } },
      { id: "min", field: "v", aggregate: "min", showAs: "percentOf", showAsBase: { field: "l", item: "Revenue", scope: "all" } },
      { id: "dc", field: "d", aggregate: "distinctCount", showAs: "percentOf", showAsBase: { field: "l", item: "Revenue", scope: "all" } },
    ];
    const spec: PivotSpec = { version: 1, rows: [{ field: "s" }, { field: "l" }], measures };
    const model = buildPivotModel(spec, dup);
    const grand = model.grandTotal.cells.map((c) => c.value);
    // Revenue everywhere: sum 1700, avg (1000+500+200)/3, min 200; grand: sum 3250, avg 3250/7, min 200.
    expect(grand[0]).toBeCloseTo(3250 / 1700, 12);
    expect(grand[1]).toBeCloseTo(3250 / 7 / (1700 / 3), 12);
    expect(grand[2]).toBeCloseTo(200 / 200, 12);
    expect(grand[3]).toBeNull();
    // With the item under one parent only, the node itself is the base: distinct counts work
    // (Revenue has departments a, b; so has everything).
    const single = buildPivotModel(spec, rows);
    expect(single.grandTotal.cells[3]!.value).toBe(1);
    expect(single.rows.find((r) => r.label === "COGS")!.cells[3]!.value).toBe(0.5);
  });

  it('scope "all" respects filters; a missing or zero base is empty', () => {
    const spec = base([{ id: "pct", field: "v", signField: "sign", showAs: "percentOf", showAsBase: { field: "l", item: "Revenue", scope: "all" } }], {
      rows: [{ field: "s" }, { field: "l" }],
    });
    const filtered = buildPivotModel({ ...spec, filters: [{ field: "l", exclude: ["Revenue"] }] }, rows);
    expect(filtered.rows.every((r) => r.cells.every((c) => c.value === null))).toBe(true);
    const zero = buildPivotModel(spec, rows.map((r) => (r.l === "Revenue" ? { ...r, v: 0 } : r)));
    expect(zero.grandTotal.cells.every((c) => c.value === null)).toBe(true);
    const unknown = buildPivotModel({ ...spec, measures: [{ ...spec.measures[0]!, showAsBase: { field: "l", item: "Nope", scope: "all" } }] }, rows);
    expect(unknown.grandTotal.cells.every((c) => c.value === null)).toBe(true);
  });

  it('differenceFrom / percentDifferenceFrom accept scope "all" too', () => {
    const b = { field: "l", item: "Revenue", scope: "all" } as const;
    const spec: PivotSpec = {
      version: 1,
      rows: [{ field: "s" }, { field: "l" }],
      measures: [
        { id: "diff", field: "v", showAs: "differenceFrom", showAsBase: b },
        { id: "pdiff", field: "v", showAs: "percentDifferenceFrom", showAsBase: b },
      ],
    };
    const model = buildPivotModel(spec, rows);
    expect(table(model)).toEqual({
      "#GM": ["1,000", "67%"],
      Revenue: ["0", "0%"],
      COGS: ["-500", "-33%"],
      "#OPEX": ["-950", "-63%"],
      Rent: ["-950", "-63%"],
      "Grand Total": ["1,550", "103%"],
    });
  });

  it("is view-only: the cube is reused and pivotModelFromCube gives the same model", () => {
    const plain = base([amount]);
    const pct = setPivotMeasureShowAs(plain, "amt", "percentOf", { field: "l", item: "Revenue", scope: "all" });
    expect(pct).not.toBe(plain);
    expect(pivotSpecDataKey(pct)).toBe(pivotSpecDataKey(plain));
    const cube = buildPivotCube(plain, rows);
    expect(pivotModelFromCube(cube, pct)).toEqual(buildPivotModel(pct, rows));
  });

  it("formats as a percent and exports the percent numFmt to the sheet", () => {
    const model = buildPivotModel(statementPivotSpec, generateStatementPivotRows());
    const sheet = pivotModelToSheet(model);
    const pctCol = model.columns.findIndex((c) => c.measureId === "pctRevenue");
    const revenue = sheet.cells.find((r) => r[0]!.v === "  Revenue")!;
    expect(model.columns[pctCol]!.excelPercentNumFmt).toBe("#,##0.0%;(#,##0.0%)");
    expect(revenue[1 + pctCol]).toMatchObject({ v: 1, numFmt: "#,##0.0%;(#,##0.0%)" });
  });
});

describe("validation and helpers", () => {
  const errors = (spec: unknown) => {
    const r = validatePivotSpec(spec);
    return r.ok ? [] : r.errors;
  };
  const spec = base([{ id: "amt", field: "v" }]);
  const withMeasure = (m: Record<string, unknown>) => ({ ...spec, measures: [{ id: "amt", field: "v", ...m }] });

  it("percentOf needs an item; scope must be parent | all; all needs an item, a row field and an item kind", () => {
    expect(errors(withMeasure({ showAs: "percentOf", showAsBase: { field: "l" } }))).toEqual(["measures[0].showAsBase.item is required by percentOf"]);
    expect(errors(withMeasure({ showAs: "percentOf" }))).toEqual(["measures[0].showAsBase is required by its showAs / groupShowAs"]);
    expect(errors(withMeasure({ showAs: "percentOf", showAsBase: { field: "l", item: "Revenue", scope: "global" } }))).toEqual([
      'measures[0].showAsBase.scope must be "parent" | "all"',
    ]);
    expect(errors(withMeasure({ showAs: "differenceFrom", showAsBase: { field: "l", scope: "all" } }))).toEqual(['measures[0].showAsBase.scope "all" needs showAsBase.item']);
    expect(errors(withMeasure({ showAs: "percentOf", showAsBase: { field: "m", item: "Jan", scope: "all" } }))).toEqual([
      'measures[0].showAsBase.scope "all" needs a row field (got column field "m")',
    ]);
    expect(errors(withMeasure({ showAs: "runningTotal", showAsBase: { field: "l", item: "Revenue", scope: "all" } }))).toEqual([
      'measures[0].showAsBase.scope "all" applies to percentOf / differenceFrom / percentDifferenceFrom only',
    ]);
    expect(errors(withMeasure({ showAs: "percentOf", showAsBase: { field: "l", item: "Revenue", scope: "all" } }))).toEqual([]);
  });

  it("signField: a non-empty string, not with counts, custom aggregates or calculated measures", () => {
    expect(errors(withMeasure({ signField: "sign" }))).toEqual([]);
    expect(errors(withMeasure({ signField: "" }))).toEqual(["measures[0].signField must be a non-empty string"]);
    expect(errors(withMeasure({ aggregate: "count", signField: "sign" }))).toEqual([
      'measures[0].signField is not supported with aggregate "count" (it signs values; counts have none)',
    ]);
    expect(errors(withMeasure({ aggregate: "distinctCount", signField: "sign" }))).toHaveLength(1);
    expect(errors(withMeasure({ aggregate: { type: "custom", name: "x" }, signField: "sign" }))).toHaveLength(1);
    expect(errors({ ...spec, measures: [{ id: "amt", field: "v" }, { id: "c", calculate: "amt * 2", signField: "sign" }] })).toEqual([
      "measures[1]: signField cannot be combined with calculate (sign the measures it references)",
    ]);
  });

  it("JSON Schema: accepts the new shapes, rejects bad scopes and signField on calculated measures", () => {
    const validateSchema = new Ajv2020({ allErrors: true }).compile(PIVOT_SPEC_JSON_SCHEMA);
    for (const ok of [statementPivotSpec, withMeasure({ showAs: "percentOf", showAsBase: { field: "l", item: "Revenue" } }), withMeasure({ signField: "sign" })]) {
      expect(validateSchema(ok), JSON.stringify(validateSchema.errors)).toBe(true);
    }
    expect(validateSchema({ ...spec, rows: [{ field: "s", subtotalLabel: "{label}" }, { field: "l" }] })).toBe(true);
    for (const bad of [
      withMeasure({ showAs: "percentOf", showAsBase: { field: "l", item: "Revenue", scope: "global" } }),
      withMeasure({ signField: "" }),
      { ...spec, measures: [{ id: "amt", field: "v" }, { id: "c", calculate: "amt", signField: "sign" }] },
      { ...spec, rows: [{ field: "s", subtotalLabel: 1 }] },
    ]) {
      expect(validateSchema(bad)).toBe(false);
      expect(validatePivotSpec(bad).ok).toBe(false);
    }
  });

  it("subtotalLabel must be a string", () => {
    expect(errors({ ...spec, rows: [{ field: "s", subtotalLabel: 1 }, { field: "l" }] })).toEqual(["rows[0].subtotalLabel must be a string"]);
  });

  it("setPivotMeasureShowAs: percentOf needs an item, scope all a row field; running totals drop scope", () => {
    expect(setPivotMeasureShowAs(spec, "amt", "percentOf", { field: "l" })).toBe(spec);
    expect(setPivotMeasureShowAs(spec, "amt", "percentOf", { field: "m", item: "Jan", scope: "all" })).toBe(spec);
    const ok = setPivotMeasureShowAs(spec, "amt", "percentOf", { field: "l", item: "Revenue", scope: "all" });
    expect(ok.measures[0]).toEqual({ id: "amt", field: "v", showAs: "percentOf", showAsBase: { field: "l", item: "Revenue", scope: "all" } });
    const run = setPivotMeasureShowAs(spec, "amt", "runningTotal", { field: "l", scope: "all" });
    expect(run.measures[0]!.showAsBase).toEqual({ field: "l" });
    expect(validatePivotSpec(ok).ok && validatePivotSpec(run).ok).toBe(true);
  });

  it("a global base whose field moves to Columns resets the measure to plain values", () => {
    const pct = setPivotMeasureShowAs(spec, "amt", "percentOf", { field: "l", item: "Revenue", scope: "all" });
    const moved = movePivotField(pct, { field: "l", from: "rows", to: "columns", index: 0 });
    expect(moved.measures[0]).toEqual({ id: "amt", field: "v" });
    expect(validatePivotSpec(moved).ok).toBe(true);
  });

  it("setPivotMeasureSignField / setPivotMeasureAggregate keep the spec valid", () => {
    const signed = setPivotMeasureSignField(spec, "amt", "sign");
    expect(signed.measures[0]).toEqual({ id: "amt", field: "v", signField: "sign" });
    expect(setPivotMeasureSignField(signed, "amt", "sign")).toBe(signed);
    expect(setPivotMeasureSignField(signed, "amt", null).measures[0]).toEqual({ id: "amt", field: "v" });
    const counted = setPivotMeasureAggregate(signed, "amt", "count");
    expect(counted.measures[0]!.signField).toBeUndefined();
    expect(setPivotMeasureSignField(counted, "amt", "sign")).toBe(counted);
  });
});

describe("signField", () => {
  const signedRows: PivotDataRow[] = [
    { k: "a", v: 10, w: 1, s: 1, den: 4 },
    { k: "a", v: 4, w: 3, s: -1, den: 4 },
    { k: "b", v: "6", w: 1, s: "-1", den: 2 },
    { k: "b", v: 2, w: 1, s: null, den: 2 },
    { k: "b", v: 3, w: 1, s: "x", den: 2 },
  ];
  const value = (measure: Omit<PivotMeasure, "id">) => {
    const model = buildPivotModel({ version: 1, rows: [{ field: "k" }], measures: [{ id: "x", ...measure }] }, signedRows);
    return [...model.rows.filter((r) => r.kind === "leaf").map((r) => r.cells[0]!.value), model.grandTotal.cells[0]!.value];
  };

  it("multiplies each value by its sign before aggregation (missing / non-numeric sign = 1)", () => {
    expect(value({ field: "v", signField: "s" })).toEqual([6, -1, 5]);
    expect(value({ field: "v", signField: "s", aggregate: "avg" })).toEqual([3, -1 / 3, 1]);
    expect(value({ field: "v", signField: "s", aggregate: "min" })).toEqual([-4, -6, -6]);
    expect(value({ field: "v", signField: "s", aggregate: "max" })).toEqual([10, 3, 10]);
    expect(value({ field: "v", signField: "s", aggregate: "first" })).toEqual([10, -6, 10]);
    expect(value({ field: "v", signField: "s", aggregate: "last" })).toEqual([-4, 3, 3]);
    // Weighted average: the value is signed, the weight is not.
    expect(value({ field: "v", signField: "s", aggregate: { type: "weightedAvg", weightField: "w" } })).toEqual([(10 - 12) / 4, -1 / 3, (10 - 12 - 6 + 2 + 3) / 7]);
    // Ratio: the numerator is signed, the denominator is not.
    expect(value({ signField: "s", aggregate: { type: "ratio", numeratorField: "v", denominatorField: "den" } })).toEqual([6 / 8, -1 / 6, 5 / 14]);
  });

  it("costs nothing to the cache key of unsigned measures, and is part of it when set", () => {
    const plain: PivotSpec = { version: 1, rows: [{ field: "k" }], measures: [{ id: "x", field: "v" }] };
    expect(pivotSpecDataKey(plain)).toBe(JSON.stringify([[["k", null, null, null, null, null]], null, [["x", "v", null]], [], []]));
    const signed = setPivotMeasureSignField(plain, "x", "s");
    expect(pivotSpecDataKey(signed)).not.toBe(pivotSpecDataKey(plain));
    const builder = createPivotModelBuilder();
    expect(builder.build(plain, signedRows).grandTotal.cells[0]!.value).toBe(25);
    expect(builder.build(signed, signedRows).grandTotal.cells[0]!.value).toBe(5);
    expect(builder.build(plain, signedRows).grandTotal.cells[0]!.value).toBe(25);
  });

  it("drill-through returns raw records and lists the sign field", () => {
    const spec: PivotSpec = { version: 1, rows: [{ field: "k" }], measures: [{ id: "x", field: "v", signField: "s" }] };
    const result = pivotDrillThrough(spec, signedRows, { path: ["a"], measureId: "x" });
    expect(result.records).toEqual(signedRows.slice(0, 2));
    expect(result.fields).toEqual(["k", "v", "s"]);
  });
});

describe("per-level subtotal labels", () => {
  it("rows[i].subtotalLabel and columns[i].subtotalLabel override totals.subtotalLabel for their level", () => {
    const spec: PivotSpec = {
      version: 1,
      rows: [{ field: "s", subtotal: "end", subtotalLabel: "{label}" }, { field: "d", subtotal: "end" }, { field: "l" }],
      columns: [{ field: "d2", subtotalLabel: "Σ {label}" }, { field: "m" }],
      measures: [{ id: "amt", field: "v" }],
      totals: { subtotalLabel: "Total {label}" },
    };
    const model = buildPivotModel(spec, rows.map((r) => ({ ...r, d2: r.m === "Jan" ? "H1" : "H1" })));
    expect(model.rows.filter((r) => r.kind === "subtotal").map((r) => r.label)).toEqual(["Total a", "Total b", "GM", "Total b", "Total a", "OPEX"]);
    expect(model.columns.filter((c) => c.subtotal).map((c) => c.columnLabel)).toEqual(["Σ H1"]);
  });
});

describe("financial statement recipe (docs/pivot-recipes.md)", () => {
  // The exact spec and figures printed in the recipe; keep the doc in sync with this test.
  const model = buildPivotModel(statementPivotSpec, generateStatementPivotRows());
  const pick = (label: string, kind?: string) => {
    const row = model.rows.find((r) => r.label === label && (kind === undefined || r.kind === kind))!;
    const at = (path: string) => row.cells[model.columns.findIndex((c) => c.headerPath.join(" › ") === path)]!.text;
    return [at("Amount › Jan"), at("Amount › Feb"), at("Amount › Dec"), at("FY 2026 › Amount"), at("% of Revenue › Jan"), at("FY 2026 › % of Revenue")];
  };

  it("rows in statement order with section subtotals and Operating income", () => {
    expect(model.rows.map((r) => `${r.kind}:${r.label}`)).toEqual([
      "group:Gross margin",
      "leaf:Revenue",
      "leaf:COGS",
      "subtotal:Gross margin",
      "group:Operating expenses",
      "leaf:Salaries",
      "leaf:Rent",
      "leaf:Marketing",
      "subtotal:Operating expenses",
      "grandTotal:Operating income",
    ]);
  });

  it("figures shown in the recipe's result table", () => {
    expect(pick("Revenue")).toEqual(["1,000", "1,100", "2,100", "18,600", "100.0%", "100.0%"]);
    expect(pick("COGS")).toEqual(["(600)", "(660)", "(1,260)", "(11,160)", "(60.0%)", "(60.0%)"]);
    expect(pick("Gross margin", "subtotal")).toEqual(["400", "440", "840", "7,440", "40.0%", "40.0%"]);
    expect(pick("Salaries")).toEqual(["(180)", "(180)", "(180)", "(2,160)", "(18.0%)", "(11.6%)"]);
    expect(pick("Rent")).toEqual(["(50)", "(50)", "(50)", "(600)", "(5.0%)", "(3.2%)"]);
    expect(pick("Marketing")).toEqual(["(20)", "(25)", "(75)", "(570)", "(2.0%)", "(3.1%)"]);
    expect(pick("Operating expenses", "subtotal")).toEqual(["(250)", "(255)", "(305)", "(3,330)", "(25.0%)", "(17.9%)"]);
    expect(pick("Operating income")).toEqual(["150", "185", "535", "4,110", "15.0%", "22.1%"]);
    // Section heading rows stay blank (their totals are on the subtotal rows).
    expect(model.rows[0]!.cells.every((c) => c.text === "")).toBe(true);
  });

  it('"Limits" workaround: a cumulative column (groupShowAs runningTotal along SECTION) gives cascading totals', () => {
    const spec: PivotSpec = {
      ...statementPivotSpec,
      columns: undefined,
      measures: [
        ...statementPivotSpec.measures,
        { id: "cumulative", label: "Cumulative", field: "AMOUNT", signField: "SIGN", groupShowAs: "runningTotal", showAsBase: { field: "SECTION" }, format: { decimals: 0, negative: "parentheses" } },
      ],
      values: ["amount", "cumulative"],
      totals: { grandTotalLabel: "Operating income" },
    };
    const cumulative = buildPivotModel(spec, generateStatementPivotRows());
    const text = Object.fromEntries(cumulative.rows.map((r) => [`${r.kind}:${r.label}`, r.cells.map((c) => c.text)]));
    expect(text["subtotal:Gross margin"]).toEqual(["7,440", "7,440"]);
    expect(text["subtotal:Operating expenses"]).toEqual(["(3,330)", "4,110"]);
    expect(text["leaf:Rent"]).toEqual(["(600)", "(600)"]);
    expect(text["grandTotal:Operating income"]).toEqual(["4,110", "4,110"]);
  });
});
