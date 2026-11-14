import { describe, expect, it } from "vitest";

import { fpaBalancePivotSpec, fpaPivotSpec, generateFpaPivotRows } from "../../fixtures/fpa-pivot-mock";
import { buildPivotModel } from "./build-model";
import { pivotDrillThrough } from "./cube";
import type { PivotModel, PivotSpec } from "./types";

/**
 * The FP&A recipes of `docs/pivot-recipes.md` ("Budget vs actual (long format)", "Balance sheet",
 * "Headcount"): the tables printed there are asserted here, cell by cell.
 */
const rows = generateFpaPivotRows();

/** Printed text of `labels` rows in the columns whose header path is in `headers`. */
function table(model: PivotModel, headers: readonly string[]): Record<string, string[]> {
  const cols = headers.map((h) => {
    const i = model.columns.findIndex((c) => c.headerPath.join(" > ") === h);
    if (i < 0) throw new Error(`no column ${h}: ${model.columns.map((c) => c.headerPath.join(" > ")).join(", ")}`);
    return i;
  });
  const out: Record<string, string[]> = {};
  for (const r of model.rows) {
    if (r.kind === "group" && r.subtotal === "end") continue;
    out[r.label] = cols.map((i) => r.cells[i]!.text);
  }
  return out;
}

describe("recipe: budget vs actual (long format)", () => {
  const model = buildPivotModel(fpaPivotSpec, rows);

  it("H1: actual, budget, variance and Var % from one long table (USD thousands)", () => {
    expect(table(model, ["H1 > Actual", "H1 > Budget", "H1 > Var", "H1 > Var %"])).toEqual({
      "Product revenue": ["$645.8", "$615.0", "$30.8", "5.0%"],
      "Services revenue": ["$228.0", "$240.0", "($12.0)", "(5.0%)"],
      Revenue: ["$873.8", "$855.0", "$18.8", "2.2%"],
      COGS: ["($303.5)", "($276.8)", "($26.8)", "(9.7%)"],
      "Cost of sales": ["($303.5)", "($276.8)", "($26.8)", "(9.7%)"],
      Salaries: ["($306.0)", "($300.0)", "($6.0)", "(2.0%)"],
      Rent: ["($60.0)", "($60.0)", "$0.0", "0.0%"],
      "Operating expenses": ["($366.0)", "($360.0)", "($6.0)", "(1.7%)"],
      "Operating income": ["$204.2", "$218.3", "($14.0)", "(6.4%)"],
    });
  });

  it("by quarter: YTD actual (running total) and prior-year actual (measure filter on PERIOD:year)", () => {
    expect(table(model, ["Q1 > Actual", "Q1 > PY actual", "Q2 > Actual", "Q2 > YTD actual", "Q2 > PY actual"])).toMatchObject({
      "Product revenue": ["$318.2", "$273.0", "$327.6", "$645.8", "$282.0"],
      "Operating income": ["$99.6", "$88.7", "$104.6", "$204.2", "$93.6"],
    });
  });

  it("real values stay unscaled; drill-through of a filtered measure lists only its records", () => {
    const income = model.grandTotal.cells[model.columns.findIndex((c) => c.headerPath.join(" > ") === "H1 > Actual")]!;
    const expected = rows.filter((r) => r.KIND === "flow" && r.SCENARIO === "Actual" && r.PERIOD.startsWith("2026")).reduce((s, r) => s + r.AMOUNT * r.SIGN, 0);
    expect(income.value).toBe(expected);
    expect(income.value).toBe(204_246);
    const drill = pivotDrillThrough(fpaPivotSpec, rows, { path: ["Revenue", "Product revenue"], columnPath: ["Q1"], measureId: "budget" });
    expect(drill.total).toBe(3);
    expect(drill.records.every((r) => r.SCENARIO === "Budget" && String(r.PERIOD).startsWith("2026"))).toBe(true);
  });

  it("without measure filters the same layout adds Actual + Budget + prior year (the trap the filters remove)", () => {
    const naive: PivotSpec = { ...fpaPivotSpec, measures: fpaPivotSpec.measures.map((m) => ({ ...m, filter: undefined })) };
    const m = buildPivotModel(naive, rows);
    const h1 = m.columns.findIndex((c) => c.headerPath.join(" > ") === "H1 > Actual");
    expect(m.grandTotal.cells[h1]!.value).toBeGreaterThan(2 * model.grandTotal.cells[h1]!.value!);
  });
});

describe("recipe: balance sheet (closingBalance)", () => {
  const model = buildPivotModel(fpaBalancePivotSpec, rows);

  it("Q1 (collapsed) is the March balance, Q2 and H1 the June balance; liabilities net off", () => {
    const cols = ["Q1 2026 > Balance", "Q2 2026 > Apr > Balance", "Q2 2026 > May > Balance", "Q2 2026 > Jun > Balance", "Q2 2026 Total > Balance", "H1 2026 > Balance"];
    expect(table(model, cols)).toMatchObject({
      Cash: ["$230.0", "$240.0", "$250.0", "$260.0", "$260.0", "$260.0"],
      Receivables: ["$80.0", "$80.0", "$80.0", "$80.0", "$80.0", "$80.0"],
      Assets: ["$310.0", "$320.0", "$330.0", "$340.0", "$340.0", "$340.0"],
      Payables: ["($66.0)", "($68.0)", "($70.0)", "($72.0)", "($72.0)", "($72.0)"],
      Liabilities: ["($66.0)", "($68.0)", "($70.0)", "($72.0)", "($72.0)", "($72.0)"],
      "Net assets · total FTE": ["$244.0", "$252.0", "$260.0", "$268.0", "$268.0", "$268.0"],
    });
  });

  it("summing the balances instead (aggregate sum) would triple Q1", () => {
    const summed: PivotSpec = { ...fpaBalancePivotSpec, measures: fpaBalancePivotSpec.measures.map((m) => (m.id === "balance" ? { ...m, aggregate: "sum" } : m)) };
    const m = buildPivotModel(summed, rows);
    const q1 = m.columns.findIndex((c) => c.headerPath.join(" > ") === "Q1 2026 > Balance");
    expect(m.rows.find((r) => r.label === "Cash")!.cells[q1]!.value).toBe(210_000 + 220_000 + 230_000);
  });
});

describe("recipe: headcount (averageOverTime)", () => {
  const model = buildPivotModel(fpaBalancePivotSpec, rows);

  it("average of the monthly FTE sums: Engineering Q1 = (31 + 32 + 33) / 3", () => {
    expect(table(model, ["Q1 2026 > FTE", "Q2 2026 > Jun > FTE", "Q2 2026 Total > FTE", "H1 2026 > FTE"])).toMatchObject({
      Engineering: ["32.0", "36.0", "35.0", "33.5"],
      Sales: ["12.0", "12.0", "12.0", "12.0"],
      Headcount: ["44.0", "48.0", "47.0", "45.5"],
    });
  });
});
