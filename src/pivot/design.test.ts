import { describe, expect, it } from "vitest";

import { buildPivotModel } from "../core/pivot/build-model";
import { pivotDivergingHeatLevel, pivotScaledHeatLevel } from "../core/pivot/heat";
import type { PivotModel, PivotSpec } from "../core/pivot/types";
import { validatePivotSpec } from "../core/pivot/validate";
import { generatePlanningPivotRows, planningPivotSpec } from "../fixtures/planning-pivot-mock";
import { pivotCellDesigns, pivotClampColumnWidth, pivotClampRowHeight, pivotHeatPaletteStep, pivotRowDesignKind } from "./design";
import { pivotHeaderLayout, pivotMeasureOrder, pivotMoveMeasure, pivotOrderMeasures } from "./header-layout";
import { pivotTableGeometry } from "./layout";

const rows = generatePlanningPivotRows();
const threeMeasures: PivotSpec = { ...planningPivotSpec, values: ["actual", "plan", "growth"], heat: null, headerCharts: null };
/** Month › Σ Values (innermost): one run of 3 measure headers per month. */
const inner = buildPivotModel(threeMeasures, rows);
/** Σ Values › Month (outermost): one run of 3 measure headers over all months. */
const outer = buildPivotModel({ ...threeMeasures, valuesIndex: 0 }, rows);
/** No column field: the measures are the only header row. */
const flat = buildPivotModel({ ...threeMeasures, columns: undefined }, rows);

const leafRows = (m: PivotModel) => m.rows.flatMap((r, i) => (r.kind === "leaf" ? [i] : []));

describe("diverging heat levels (core)", () => {
  it("middle level at the midpoint, lower below, higher above; at least one step off the middle", () => {
    expect(pivotDivergingHeatLevel(0, -10, 10, 0, 9)).toBe(4);
    expect(pivotDivergingHeatLevel(-10, -10, 10, 0, 9)).toBe(0);
    expect(pivotDivergingHeatLevel(10, -10, 10, 0, 9)).toBe(8);
    expect(pivotDivergingHeatLevel(0.01, -10, 10, 0, 9)).toBe(5);
    expect(pivotDivergingHeatLevel(-0.01, -10, 10, 0, 9)).toBe(3);
    expect(pivotDivergingHeatLevel(null, -10, 10, 0, 9)).toBeUndefined();
    expect(pivotDivergingHeatLevel(150, 50, 200, 100, 5)).toBe(3);
  });

  it("symmetric data range: both sides use the larger distance from the midpoint", () => {
    // Data -2 … 10 around 0: -2 is a fifth of the reach, so one step below the middle.
    expect(pivotScaledHeatLevel(-2, { min: -2, max: 10 }, 9, "diverging", 0, true)).toBe(3);
    expect(pivotScaledHeatLevel(-2, { min: -2, max: 10 }, 9, "diverging", 0, false)).toBe(0);
    expect(pivotScaledHeatLevel(5, { min: 0, max: 10 }, 9, "sequential")).toBe(4);
  });

  it("spec.heat.scale reaches the model and validates", () => {
    const spec: PivotSpec = { ...planningPivotSpec, heat: { measure: "actual", scale: "diverging", midpoint: 1_000_000 } };
    const m = buildPivotModel(spec, rows);
    expect(m.heat).toMatchObject({ scale: "diverging", midpoint: 1_000_000, levels: 9 });
    expect(validatePivotSpec(spec).ok).toBe(true);
    const errorsOf = (s: unknown) => JSON.stringify(validatePivotSpec(s));
    expect(errorsOf({ ...spec, heat: { scale: "rainbow" } })).toContain("heat.scale");
    expect(errorsOf({ ...spec, heat: { midpoint: "0" } })).toContain("heat.midpoint");
    // Sequential specs keep the 0.4.0 model shape.
    expect(buildPivotModel(planningPivotSpec, rows).heat).toEqual({ measureId: "actual", scope: "all", levels: 9, applyTo: "leaf" });
  });
});

describe("pivotCellDesigns", () => {
  it("heat: one spec per measure, levels over the displayed leaf values", () => {
    const d = pivotCellDesigns(inner, { heat: [{ measure: "actual" }, { measure: "plan", levels: 5 }] });
    const actualCols = inner.columns.flatMap((c, i) => (c.measureId === "actual" ? [i] : []));
    const planCols = inner.columns.flatMap((c, i) => (c.measureId === "plan" ? [i] : []));
    const growthCols = inner.columns.flatMap((c, i) => (c.measureId === "growth" ? [i] : []));
    const leaf = leafRows(inner);
    const actualLevels = leaf.flatMap((r) => actualCols.map((c) => d[r]?.[c]?.heat?.level));
    expect(Math.min(...(actualLevels as number[]))).toBe(0);
    expect(Math.max(...(actualLevels as number[]))).toBe(8);
    expect(leaf.flatMap((r) => planCols.map((c) => d[r]?.[c]?.heat?.levels))).toEqual(leaf.flatMap(() => planCols.map(() => 5)));
    expect(leaf.some((r) => growthCols.some((c) => d[r]?.[c]?.heat))).toBe(false);
    // Group rows and the grand total get no heat by default.
    inner.rows.forEach((row, r) => {
      if (row.kind !== "leaf") expect(d[r]?.some((x) => x?.heat)).toBeFalsy();
    });
  });

  it("heat undefined: the model's own heat; [] : none", () => {
    const m = buildPivotModel(planningPivotSpec, rows);
    const own = pivotCellDesigns(m, {});
    const r = m.rows.findIndex((row) => row.cells.some((c) => c.heat !== undefined));
    const c = m.rows[r]!.cells.findIndex((cell) => cell.heat !== undefined);
    expect(own[r]![c]!.heat).toEqual({ level: m.rows[r]!.cells[c]!.heat, levels: 9, step: m.rows[r]!.cells[c]!.heat, scale: "sequential" });
    expect(pivotCellDesigns(m, { heat: [] }).flat().some(Boolean)).toBe(false);
  });

  it("heat scopes: column / row domains, fixed domain, diverging step", () => {
    const byColumn = pivotCellDesigns(inner, { heat: { measure: "actual", scope: "column" } });
    const col = inner.columns.findIndex((c) => c.measureId === "actual");
    const levels = leafRows(inner).map((r) => byColumn[r]?.[col]?.heat?.level);
    expect(levels).toContain(0);
    expect(levels).toContain(8);
    const byRow = pivotCellDesigns(inner, { heat: { measure: "actual", scope: "row" } });
    const first = leafRows(inner)[0]!;
    const rowLevels = inner.columns.flatMap((c, i) => (c.measureId === "actual" ? [byRow[first]![i]?.heat?.level] : []));
    expect(Math.min(...(rowLevels as number[]))).toBe(0);
    expect(Math.max(...(rowLevels as number[]))).toBe(8);
    const fixed = pivotCellDesigns(inner, { heat: { measure: "actual", domain: [0, 1e12] } });
    expect(leafRows(inner).every((r) => (fixed[r]?.[col]?.heat?.level ?? 0) === 0)).toBe(true);
    const div = pivotCellDesigns(inner, { heat: { measure: "growth", scale: "diverging", levels: 5 } });
    const steps = new Set(div.flat().map((x) => x?.heat?.step).filter((s) => s !== undefined));
    expect([...steps].every((s) => [0, 3, 4, 5, 8].includes(s!))).toBe(true);
    expect(div.flat().find((x) => x?.heat)?.heat?.scale).toBe("diverging");
    expect(pivotHeatPaletteStep(2, 5)).toBe(4);
  });

  it("bars: fractions of a domain that includes 0; negatives to the left or hidden", () => {
    const model: PivotModel = {
      ...flat,
      rows: flat.rows.map((row, i) => ({ ...row, cells: row.cells.map((c, ci) => (ci === 1 ? { ...c, value: [-50, 100, 50, 0][i % 4]! } : c)) })),
    };
    const leaf = leafRows(model);
    const left = pivotCellDesigns(model, { bars: [{ measure: "plan", applyTo: "all" }] });
    const values = model.rows.map((r) => r.cells[1]!.value);
    model.rows.forEach((row, r) => {
      const bar = left[r]?.[1]?.bar;
      if (row.kind === "grandTotal" || values[r] === 0) return expect(bar).toBeUndefined();
      const near = (b: typeof bar, start: number, width: number, negative: boolean) => {
        expect(b!.start).toBeCloseTo(start, 9);
        expect(b!.width).toBeCloseTo(width, 9);
        expect(b!.negative).toBe(negative);
      };
      if (values[r] === 100) near(bar, 1 / 3, 2 / 3, false);
      if (values[r] === -50) near(bar, 0, 1 / 3, true);
    });
    const hide = pivotCellDesigns(model, { bars: [{ measure: "plan", applyTo: "all", negative: "hide" }] });
    model.rows.forEach((_, r) => {
      if (values[r] === -50) expect(hide[r]?.[1]?.bar).toBeUndefined();
      if (values[r] === 50) expect(hide[r]?.[1]?.bar).toEqual({ start: 0, width: 0.5, negative: false });
    });
    const domain = pivotCellDesigns(model, { bars: [{ measure: "plan", domain: [0, 200] }] });
    const hundred = leaf.find((r) => values[r] === 100)!;
    expect(domain[hundred]![1]!.bar).toEqual({ start: 0, width: 0.5, negative: false });
  });
});

describe("measure order", () => {
  it("finds one run per column group (Σ innermost) and one run over the months (Σ outermost)", () => {
    expect(pivotHeaderLayout(inner).runs.size).toBe(12);
    expect([...pivotHeaderLayout(outer).runs.values()].map((r) => r.map((c) => c.cell.measureId))).toEqual([["actual", "plan", "growth"]]);
    expect(pivotHeaderLayout(flat).runs.size).toBe(1);
    // Every column has exactly one bottom header cell.
    for (const m of [inner, outer, flat]) {
      const leafs = pivotHeaderLayout(m).rows.flat().flatMap((c) => (c.leafColumn === null ? [] : [c.leafColumn]));
      expect(leafs.sort((a, b) => a - b)).toEqual(m.columns.map((_, i) => i));
    }
  });

  it("reorders measures inside every group; months keep the model order", () => {
    const m = pivotOrderMeasures(inner, ["growth", "actual"]);
    expect(pivotMeasureOrder(m)).toEqual(["growth", "actual", "plan"]);
    expect(m.columns.slice(0, 6).map((c) => c.id)).toEqual(["c:Nov:growth", "c:Nov:actual", "c:Nov:plan", "c:Dec:growth", "c:Dec:actual", "c:Dec:plan"]);
    expect(m.headerRows[0]!.map((h) => h.label)).toEqual(inner.headerRows[0]!.map((h) => h.label));
    expect(m.headerRows[1]!.slice(0, 3).map((h) => h.measureId)).toEqual(["growth", "actual", "plan"]);
    // Cells follow their columns.
    const r = leafRows(inner)[0]!;
    const byId = (model: PivotModel) => new Map(model.columns.map((c, i) => [c.id, model.rows[r]!.cells[i]!.text]));
    expect(byId(m)).toEqual(byId(inner));
    expect(m.grandTotal.cells[0]).toBe(inner.grandTotal.cells[inner.columns.findIndex((c) => c.id === "c:Nov:growth")]);
  });

  it("Σ outermost moves whole measure blocks; unchanged orders return the model itself", () => {
    const m = pivotOrderMeasures(outer, ["plan"]);
    expect(pivotMeasureOrder(m)).toEqual(["plan", "actual", "growth"]);
    expect(m.headerRows[0]!.map((h) => h.measureId)).toEqual(["plan", "actual", "growth"]);
    expect(m.columns.slice(0, 12).every((c) => c.measureId === "plan")).toBe(true);
    expect(pivotOrderMeasures(outer, ["actual", "plan", "growth"])).toBe(outer);
    expect(pivotOrderMeasures(outer, undefined)).toBe(outer);
    expect(pivotOrderMeasures(outer, ["nope"])).toBe(outer);
  });

  it("pivotMoveMeasure clamps at the ends", () => {
    expect(pivotMoveMeasure(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    const order = ["a", "b"];
    expect(pivotMoveMeasure(order, "a", -1)).toBe(order);
    expect(pivotMoveMeasure(order, "x", 1)).toBe(order);
  });
});

describe("pivotTableGeometry (export)", () => {
  it("per-column widths, frozen counts and cell levels", () => {
    const g = pivotTableGeometry(inner, { valueWidths: { "c:Nov:actual": 120 }, valueWidth: 90, dimensionWidths: [200, 150] });
    expect(g.valueWidths![0]).toBe(120);
    expect(g.valueWidths![1]).toBe(90);
    expect(g.columnWidths!.slice(0, 3)).toEqual([200, 150, 120]);
    expect(g.width).toBe(350 + 120 + 90 * (inner.columns.length - 1));
    expect(g.frozenRows).toBe(inner.headerRows.length);
    expect(g.frozenColumns).toBe(2);
    expect(g.cells).toBeUndefined();
    const off = pivotTableGeometry(inner, { freezeHeader: false, freezeDimensions: false, heat: { measure: "actual" }, bars: [{ measure: "plan" }] });
    expect([off.frozenRows, off.frozenColumns]).toEqual([0, 0]);
    expect(off.cells).toEqual(pivotCellDesigns(inner, { heat: { measure: "actual" }, bars: [{ measure: "plan" }] }));
  });
});

describe("limits and kinds", () => {
  it("clamps sizes and maps row kinds", () => {
    expect([pivotClampColumnWidth(10), pivotClampColumnWidth(5000), pivotClampColumnWidth(99.6)]).toEqual([48, 800, 100]);
    expect([pivotClampRowHeight(1), pivotClampRowHeight(500)]).toEqual([20, 96]);
    expect(["leaf", "calculated", "group", "subtotal", "grandTotal"].map((kind) => pivotRowDesignKind({ kind } as never))).toEqual(["leaf", "leaf", "subtotal", "subtotal", "total"]);
  });
});

describe("review fixes", () => {
  it("diverging palette steps keep the middle level on step 4 for any levels", () => {
    for (const levels of [2, 3, 4, 5, 8, 9, 10]) {
      const middle = Math.floor(levels / 2);
      expect(pivotHeatPaletteStep(middle, levels, "diverging")).toBe(4);
      for (let l = 0; l < middle; l++) expect(pivotHeatPaletteStep(l, levels, "diverging")).toBeLessThan(4);
      for (let l = middle + 1; l < levels; l++) expect(pivotHeatPaletteStep(l, levels, "diverging")).toBeGreaterThan(4);
      expect(pivotHeatPaletteStep(0, levels, "diverging")).toBe(0);
      if (levels - 1 > middle) expect(pivotHeatPaletteStep(levels - 1, levels, "diverging")).toBe(8);
    }
  });

  it("fractional uniform widths are a product, as in 0.4.0", () => {
    const g = pivotTableGeometry(inner, { valueWidth: 84.1 });
    expect(g.width).toBe(208 + 172 + 84.1 * inner.columns.length);
  });
});

