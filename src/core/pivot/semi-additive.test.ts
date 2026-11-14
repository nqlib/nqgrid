import { describe, expect, it } from "vitest";

import { buildPivotModel, createPivotModelBuilder } from "./build-model";
import { pivotDrillThrough, pivotSpecDataKey } from "./cube";
import { setPivotMeasureFilter } from "./measures";
import { setPivotMeasureAggregate } from "./fields";
import type { PivotDataRow, PivotModel, PivotSpec } from "./types";

/** `{ "row label": { "column header": value } }` of a model (header path joined by `>`). */
function grid(model: PivotModel): Record<string, Record<string, number | null>> {
  const out: Record<string, Record<string, number | null>> = {};
  for (const row of model.rows) {
    const cells: Record<string, number | null> = {};
    row.cells.forEach((c, i) => {
      const col = model.columns[i]!;
      const path = col.headerPath.at(-1) === col.measureLabel ? col.headerPath : [...col.headerPath, col.measureId];
      cells[path.join(">")] = c.value;
    });
    out[row.kind === "subtotal" ? `${row.label} (subtotal)` : row.label] = cells;
  }
  return out;
}

/** Month-end balances (Jan–Jun 2026), records in reverse order so input order ≠ time order. */
function balances(): PivotDataRow[] {
  const out: PivotDataRow[] = [];
  const accounts = [
    { ACCOUNT: "Cash", GROUP: "Assets" },
    { ACCOUNT: "Receivables", GROUP: "Assets" },
    { ACCOUNT: "Payables", GROUP: "Liabilities" },
  ];
  for (const a of accounts) {
    for (let mo = 1; mo <= 6; mo++) {
      out.push({ ...a, PERIOD: `2026-${String(mo).padStart(2, "0")}-28`, BAL: a.ACCOUNT === "Cash" ? 100 * mo : a.ACCOUNT === "Receivables" ? 50 : 30 + mo });
    }
  }
  return out.reverse();
}

const closing = (timeField = "PERIOD") => ({ type: "closingBalance" as const, timeField });

describe("closingBalance / openingBalance", () => {
  const spec: PivotSpec = {
    version: 1,
    rows: [{ field: "GROUP" }, { field: "ACCOUNT" }],
    columns: [{ field: "PERIOD:yearQuarter" }, { field: "PERIOD:month" }],
    measures: [{ id: "bal", field: "BAL", aggregate: closing() }],
    totals: { rowTotal: true },
  };

  it("takes each account's latest period in the cell and adds accounts (analyst t5)", () => {
    const g = grid(buildPivotModel(spec, balances()));
    expect(g.Payables!["Q1 2026 Total>bal"]).toBe(33);
    expect(g.Assets!["Q1 2026>Jan>bal"]).toBe(150);
    expect(g.Cash!["Q1 2026 Total>bal"]).toBe(300);
    expect(g.Cash!["Total>bal"]).toBe(600);
    expect(g.Assets!["Q2 2026 Total>bal"]).toBe(650);
    expect(g["Grand Total"]!["Q1 2026 Total>bal"]).toBe(383);
    expect(g["Grand Total"]!["Total>bal"]).toBe(686);
  });

  it("openingBalance takes the earliest period", () => {
    const g = grid(buildPivotModel({ ...spec, measures: [{ id: "bal", field: "BAL", aggregate: { type: "openingBalance", timeField: "PERIOD" } }] }, balances()));
    expect(g.Payables!["Q2 2026 Total>bal"]).toBe(34);
    expect(g.Assets!["Total>bal"]).toBe(150);
  });

  it("collapsed groups and collapsed column groups show the same balances", () => {
    const g = grid(buildPivotModel({ ...spec, expanded: "none", columnsExpanded: "none" }, balances()));
    expect(g.Assets).toEqual({ "Q1 2026>bal": 350, "Q2 2026>bal": 650, "Total>bal": 650 });
    expect(g.Liabilities).toEqual({ "Q1 2026>bal": 33, "Q2 2026>bal": 36, "Total>bal": 36 });
  });

  it("sparse data: an account without a record in the last month counts with its latest one (per series)", () => {
    const rows = balances().filter((r) => !(r.ACCOUNT === "Receivables" && r.PERIOD === "2026-03-28"));
    const g = grid(buildPivotModel(spec, rows));
    expect(g.Assets!["Q1 2026>Mar>bal"]).toBe(300);
    expect(g.Assets!["Q1 2026 Total>bal"]).toBe(350); // Cash Mar 300 + Receivables Feb 50
    expect(g.Receivables!["Q1 2026 Total>bal"]).toBe(50);
  });

  it("time in rows: an account's months roll up to its latest month, accounts add up", () => {
    const rowsSpec: PivotSpec = {
      version: 1,
      rows: [{ field: "ACCOUNT", order: ["Cash", "Receivables", "Payables"] }, { field: "PERIOD:yearMonth" }],
      measures: [{ id: "bal", field: "BAL", aggregate: closing("PERIOD:yearMonth") }],
    };
    const model = buildPivotModel(rowsSpec, balances());
    const cash = model.rows.find((r) => r.kind === "group" && r.label === "Cash")!;
    expect(cash.cells[0]!.value).toBe(600);
    expect(model.grandTotal.cells[0]!.value).toBe(600 + 50 + 36);
  });

  it("records without a value or a time key are skipped (last non-blank)", () => {
    const rows = [...balances(), { ACCOUNT: "Cash", GROUP: "Assets", PERIOD: "2026-07-28", BAL: null }, { ACCOUNT: "Cash", GROUP: "Assets", PERIOD: null, BAL: 999 }];
    const g = grid(buildPivotModel({ ...spec, columns: { field: "PERIOD:year" } }, rows));
    expect(g.Cash!["2026>bal"]).toBe(600);
    expect(g.Cash!["(blank)>bal"]).toBeNull();
  });

  it("sign field, report filters, measure filters, show-as, calculated measures, sort by value, Top N and heat", () => {
    const rows: PivotDataRow[] = balances().map((r) => ({ ...r, SIGN: r.GROUP === "Liabilities" ? -1 : 1, SCENARIO: "Actual" }));
    rows.push({ ACCOUNT: "Cash", GROUP: "Assets", PERIOD: "2026-06-28", BAL: 1_000_000, SIGN: 1, SCENARIO: "Budget" });
    const s: PivotSpec = {
      version: 1,
      rows: [{ field: "GROUP", sortBy: { measure: "bal", direction: "asc" } }, { field: "ACCOUNT", topN: { measure: "bal", count: 1 } }],
      columns: { field: "PERIOD:yearQuarter" },
      filters: [{ field: "PERIOD:yearMonth", exclude: ["2026-06"] }],
      measures: [
        { id: "bal", field: "BAL", signField: "SIGN", aggregate: closing(), filter: { field: "SCENARIO", include: ["Actual"] } },
        { id: "share", field: "BAL", signField: "SIGN", aggregate: closing(), filter: { field: "SCENARIO", include: ["Actual"] }, showAs: "percentOfColumnTotal" },
        { id: "x2", calculate: "bal * 2" },
      ],
      heat: { measure: "bal" },
    };
    const model = buildPivotModel(s, rows);
    const g = grid(model);
    // Liabilities sort first (negative), Q2 = May (June filtered out), Top 1 account per group (Cash).
    expect(model.rows.map((r) => r.label)).toEqual(["Liabilities", "Payables", "Assets", "Cash", "Grand Total"]);
    expect(g.Payables!["Q2 2026>bal"]).toBe(-35);
    expect(g.Cash!["Q2 2026>bal"]).toBe(500);
    expect(g["Grand Total"]!["Q2 2026>bal"]).toBe(465);
    expect(g.Cash!["Q2 2026>share"]).toBeCloseTo(500 / 465);
    expect(g.Cash!["Q2 2026>x2"]).toBe(1000);
    expect(model.rows[1]!.cells[0]!.heat).toBeDefined();
  });

  it("drill-through lists the cell's records; the cube key changes with the time field", () => {
    const res = pivotDrillThrough(spec, balances(), { path: ["Assets", "Cash"], columnPath: ["2026-Q1"], measureId: "bal" });
    expect(res.total).toBe(3);
    expect(res.fields).toContain("PERIOD");
    expect(pivotSpecDataKey(spec)).not.toBe(pivotSpecDataKey({ ...spec, measures: [{ id: "bal", field: "BAL", aggregate: closing("PERIOD:yearMonth") }] }));
  });

  it("setPivotMeasureAggregate switches to and from a semi-additive aggregate", () => {
    const s: PivotSpec = { version: 1, rows: [{ field: "ACCOUNT" }], measures: [{ id: "bal", field: "BAL" }] };
    const next = setPivotMeasureAggregate(s, "bal", { type: "closingBalance", timeField: "PERIOD" }, { fields: [{ field: "BAL", label: "Balance", type: "measure" }] });
    expect(next.measures[0]).toEqual({ id: "bal", field: "BAL", aggregate: { type: "closingBalance", timeField: "PERIOD" }, label: "Closing balance of Balance" });
    expect(setPivotMeasureAggregate(next, "bal", { type: "closingBalance", timeField: "PERIOD" })).toBe(next);
    expect(setPivotMeasureAggregate(s, "bal", { type: "closingBalance", timeField: "" })).toBe(s);
    const back = setPivotMeasureAggregate(next, "bal", "sum", { fields: [{ field: "BAL", label: "Balance", type: "measure" }] });
    expect(back.measures[0]).toEqual({ id: "bal", field: "BAL", label: "Balance" });
  });
});

describe("averageOverTime", () => {
  const hc: PivotDataRow[] = [];
  for (const team of ["T1", "T2"]) for (let mo = 1; mo <= 3; mo++) hc.push({ DEPT: "Eng", TEAM: team, PERIOD: `2026-0${mo}-01`, FTE: team === "T1" ? 10 : 20 + mo });
  hc.push({ DEPT: "Ops", TEAM: "T3", PERIOD: "2026-01-01", FTE: 4 }, { DEPT: "Ops", TEAM: "T3", PERIOD: "2026-03-01", FTE: 6 });

  it("averages the per-period sums: department per quarter (31 + 32 + 33) / 3 = 32 (analyst t5)", () => {
    const spec: PivotSpec = {
      version: 1,
      rows: [{ field: "DEPT" }, { field: "TEAM" }],
      columns: [{ field: "PERIOD:yearQuarter" }, { field: "PERIOD:month" }],
      measures: [{ id: "fte", field: "FTE", aggregate: { type: "averageOverTime", timeField: "PERIOD" } }],
      totals: { rowTotal: true },
    };
    const g = grid(buildPivotModel(spec, hc));
    expect(g.Eng!["Q1 2026>Jan>fte"]).toBe(31);
    expect(g.Eng!["Q1 2026 Total>fte"]).toBe(32);
    expect(g.T2!["Total>fte"]).toBe(22);
    // Ops has no February record: the average runs over the months it has (4 + 6) / 2.
    expect(g.Ops!["Total>fte"]).toBe(5);
    // Grand total: (35 + 32 + 39) / 3 months.
    expect(g["Grand Total"]!["Total>fte"]).toBeCloseTo(106 / 3);
  });

  it("the time field can be a coarser derived date field (months of daily records)", () => {
    const daily: PivotDataRow[] = [
      { D: "A", DAY: "2026-01-01", V: 10 },
      { D: "A", DAY: "2026-01-02", V: 10 },
      { D: "A", DAY: "2026-02-01", V: 40 },
    ];
    const spec: PivotSpec = { version: 1, rows: [{ field: "D" }], measures: [{ id: "v", field: "V", aggregate: { type: "averageOverTime", timeField: "DAY:yearMonth" } }] };
    expect(buildPivotModel(spec, daily).grandTotal.cells[0]!.value).toBe(30);
  });
});

describe("measure filters (CALCULATE-style)", () => {
  const rows: PivotDataRow[] = [
    { LINE: "Revenue", SCENARIO: "Actual", PERIOD: "2026-01-15", AMOUNT: 110, CUSTOMER: "a" },
    { LINE: "Revenue", SCENARIO: "Budget", PERIOD: "2026-01-15", AMOUNT: 100, CUSTOMER: "a" },
    { LINE: "Revenue", SCENARIO: "Actual", PERIOD: "2025-01-15", AMOUNT: 90, CUSTOMER: "b" },
    { LINE: "COGS", SCENARIO: "Actual", PERIOD: "2026-01-15", AMOUNT: -40, CUSTOMER: "c" },
    { LINE: "COGS", SCENARIO: "Budget", PERIOD: "2026-01-15", AMOUNT: -35, CUSTOMER: "c" },
    { LINE: "Rent", SCENARIO: "Budget", PERIOD: "2026-01-15", AMOUNT: -10, CUSTOMER: "d" },
  ];
  const act = { field: "SCENARIO", include: ["Actual"] };
  const bud = { field: "SCENARIO", include: ["Budget"] };
  const spec: PivotSpec = {
    version: 1,
    rows: [{ field: "LINE" }],
    filters: [{ field: "PERIOD:year", include: ["2026"] }],
    measures: [
      { id: "actual", field: "AMOUNT", filter: act },
      { id: "budget", field: "AMOUNT", filter: bud },
      { id: "var", calculate: "actual - budget" },
      { id: "py", field: "AMOUNT", filter: [act, { field: "PERIOD:year", include: ["2025"] }] },
      { id: "n", aggregate: "count", filter: act },
      { id: "customers", field: "CUSTOMER", aggregate: "distinctCount", filter: bud },
    ],
  };

  it("aggregates each measure over its own records; rows come from every record", () => {
    const g = grid(buildPivotModel(spec, rows));
    expect(g.Revenue).toEqual({ actual: 110, budget: 100, var: 10, py: null, n: 1, customers: 1 });
    expect(g.COGS).toEqual({ actual: -40, budget: -35, var: -5, py: null, n: 1, customers: 1 });
    // A line with only budget records still shows (empty actual, count 0).
    expect(g.Rent).toEqual({ actual: null, budget: -10, var: null, py: null, n: 0, customers: 1 });
    expect(g["Grand Total"]).toEqual({ actual: 70, budget: 55, var: 15, py: null, n: 2, customers: 3 });
  });

  it("prior year needs the report filter to let 2025 through: the measure filter only narrows", () => {
    const g = grid(buildPivotModel({ ...spec, filters: [] }, rows));
    expect(g.Revenue!.py).toBe(90);
    expect(g.Revenue!.actual).toBe(200);
  });

  it("ratio, weighted average, min / max and custom aggregators honour the filter", () => {
    const s: PivotSpec = {
      version: 1,
      rows: [{ field: "LINE" }],
      measures: [
        { id: "r", aggregate: { type: "ratio", numeratorField: "AMOUNT", denominatorField: "AMOUNT" }, filter: act },
        { id: "mx", field: "AMOUNT", aggregate: "max", filter: bud },
        { id: "c", field: "AMOUNT", aggregate: { type: "custom", name: "n" }, filter: act },
      ],
    };
    const model = buildPivotModel(s, rows, { aggregators: { n: (values) => values.length } });
    const g = grid(model);
    expect(g.Revenue).toEqual({ r: 1, mx: 100, c: 2 });
    expect(g.Rent).toEqual({ r: null, mx: -10, c: 0 });
  });

  it("is part of the cube key, and the builder rebuilds when it changes", () => {
    const next = setPivotMeasureFilter(spec, "actual", { field: "SCENARIO", include: ["Budget"] });
    expect(pivotSpecDataKey(next)).not.toBe(pivotSpecDataKey(spec));
    const builder = createPivotModelBuilder();
    expect(grid(builder.build(spec, rows)).Revenue!.actual).toBe(110);
    expect(grid(builder.build(next, rows)).Revenue!.actual).toBe(100);
    expect(setPivotMeasureFilter(spec, "var", act)).toBe(spec);
    expect(setPivotMeasureFilter(spec, "actual", null).measures[0]).toEqual({ id: "actual", field: "AMOUNT" });
    expect(setPivotMeasureFilter(spec, "actual", [{ field: "SCENARIO" }]).measures[0]).toEqual({ id: "actual", field: "AMOUNT" });
  });

  it("drill-through with measureId lists only the records the measure counted", () => {
    expect(pivotDrillThrough(spec, rows, { path: ["Revenue"], measureId: "actual" }).total).toBe(1);
    expect(pivotDrillThrough(spec, rows, { path: ["Revenue"], measureId: "budget" }).records[0]).toMatchObject({ SCENARIO: "Budget" });
    // A calculated measure: records of any measure it references; no measureId: every record.
    expect(pivotDrillThrough(spec, rows, { path: ["Revenue"], measureId: "var" }).total).toBe(2);
    expect(pivotDrillThrough(spec, rows, { path: ["Revenue"] }).total).toBe(2);
  });

  it("reports filter items that match nothing", () => {
    const model = buildPivotModel({ ...spec, measures: [{ id: "a", field: "AMOUNT", filter: { field: "SCENARIO", include: ["actual"] } }] }, rows);
    expect(model.diagnostics).toEqual([
      expect.objectContaining({ code: "filterItemsNotFound", path: "measures[0].filter.include", items: ["actual"] }),
    ]);
  });
});
