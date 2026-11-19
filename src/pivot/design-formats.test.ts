import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildPivotModel } from "../core/pivot/build-model";
import type { PivotSpec } from "../core/pivot/types";
import { generatePlanningPivotRows, planningPivotSpec } from "../fixtures/planning-pivot-mock";
import { pivotCellFormats, type PivotDesignChangeInfo, type PivotTableDesign } from "./design";
import { pivotDesignProps } from "./design-props";
import { pivotTableGeometry } from "./layout";
import { PivotTable } from "./pivot-table";

const rows = generatePlanningPivotRows();
const spec: PivotSpec = { ...planningPivotSpec, values: ["actual", "plan", "growth"], heat: null };
const model = buildPivotModel(spec, rows);
const leaf = model.rows.findIndex((r) => r.kind === "leaf");
const total = model.rows.findIndex((r) => r.kind === "grandTotal");
const col = (id: string) => model.columns.findIndex((c) => c.id === id);

describe("number formats (pivotCellFormats)", () => {
  it("measure rule merges over the column format; more specific rules win", () => {
    const f = pivotCellFormats(model, [
      { row: model.rows[leaf]!.id, column: "c:Nov:actual", format: { decimals: 1 } },
      { measure: "actual", format: { compact: false, decimals: 0 } },
      { column: "c:Nov:actual", format: { style: "decimal", decimals: 2 } },
    ]);
    const nov = col("c:Nov:actual");
    const dec = col("c:Dec:actual");
    // Measure rule: full dollars, no compact.
    expect(f[leaf]![dec]!.text).toMatch(/^\$\d{1,3}(,\d{3})+$/);
    expect(f[leaf]![dec]!.excelNumFmt).toContain("$");
    // Column rule over the measure rule: plain decimal with 2 digits — except the one cell rule (1 digit).
    const other = model.rows.findIndex((r, i) => i > leaf && r.kind === "leaf");
    expect(f[other]![nov]!.text).toMatch(/^\d{1,3}(,\d{3})*\.\d{2}$/);
    expect(f[leaf]![nov]!.text).toMatch(/^\d{1,3}(,\d{3})*\.\d$/);
    // Cells no rule touches stay undefined.
    expect(f[leaf]![col("c:Nov:plan")]).toBeUndefined();
  });

  it("rowKind and replace", () => {
    const f = pivotCellFormats(model, [{ rowKind: "total", format: { style: "currency", currency: "EUR", decimals: 2 }, replace: true }]);
    expect(f[total]![col("c:Nov:plan")]!.text).toMatch(/^€[\d,]+\.\d{2}$/);
    expect(f[leaf]).toBeUndefined();
  });

  it("percent cells merge over their percent format", () => {
    const f = pivotCellFormats(model, [{ measure: "growth", format: { decimals: 2 } }]);
    expect(f[leaf]![col("c:Nov:growth")]!.text).toMatch(/^[+-]?\d+\.\d{2}%$/);
  });

  it("PivotTable prints the formatted text; geometry exports format + Excel format", () => {
    const rules = [{ measure: "plan", format: { compact: false } }];
    const html = renderToStaticMarkup(createElement(PivotTable, { model, mode: "static", numberFormats: rules }));
    const text = pivotCellFormats(model, rules)[leaf]![col("c:Nov:plan")]!.text;
    expect(html).toContain(`>${text}</td>`);
    const g = pivotTableGeometry(model, { numberFormats: rules });
    expect(g.cells![leaf]![col("c:Nov:plan")]!.numberFormat).toMatchObject({ text, excelNumFmt: expect.stringContaining("$") });
  });
});

describe("measureWidths", () => {
  it("one width for every column of a measure; valueWidths entries win", () => {
    const g = pivotTableGeometry(model, { measureWidths: { plan: 120 }, valueWidths: { "c:Nov:plan": 90 } });
    expect(g.valueWidths![col("c:Nov:plan")]).toBe(90);
    expect(g.valueWidths![col("c:Dec:plan")]).toBe(120);
    expect(g.valueWidths![col("c:Dec:actual")]).toBe(84);
  });

  it("onMeasureWidthChange alone puts one handle per column, labelled by column", () => {
    const html = renderToStaticMarkup(createElement(PivotTable, { model, onMeasureWidthChange: () => {} }));
    expect((html.match(/role="separator"/g) ?? []).length).toBe(model.columns.length);
  });
});

describe("pivotDesignProps", () => {
  it("maps a stored design to props and returns the next design from each callback", () => {
    const design: PivotTableDesign = { rowHeight: 30, bandedRows: true, numberFormats: [{ measure: "plan", format: { decimals: 1 } }] };
    const calls: [PivotTableDesign, PivotDesignChangeInfo][] = [];
    const props = pivotDesignProps(design, (next, info) => calls.push([next, info]));
    expect(props).toMatchObject({ rowHeight: 30, bandedRows: true, numberFormats: design.numberFormats });
    expect("heat" in props).toBe(false);
    props.onValueWidthChange!("c:Nov:plan", 120, { source: "pointer", final: false });
    props.onDimensionWidthChange!(1, 150, { source: "keyboard", final: true });
    props.onRowHeightChange!(40, { source: "keyboard", final: true });
    props.onMeasureOrderChange!(["plan", "actual"]);
    expect(calls.map(([, i]) => i)).toEqual([
      { change: "valueWidth", final: false },
      { change: "dimensionWidth", final: true },
      { change: "rowHeight", final: true },
      { change: "measureOrder", final: true },
    ]);
    expect(calls[0]![0]).toMatchObject({ version: 1, valueWidths: { "c:Nov:plan": 120 }, rowHeight: 30 });
    expect(calls[1]![0].dimensionWidths).toEqual([208, 150]); // no hole before the resized column
    expect(calls[3]![0].measureOrder).toEqual(["plan", "actual"]);
    // JSON round trip keeps everything.
    expect(JSON.parse(JSON.stringify(calls[1]![0]))).toEqual(calls[1]![0]);
  });

  it("widthScope measure reports measureWidths; no callback means props only", () => {
    const calls: PivotTableDesign[] = [];
    const props = pivotDesignProps({}, (next) => calls.push(next), { widthScope: "measure" });
    expect(props.onValueWidthChange).toBeUndefined();
    props.onMeasureWidthChange!("plan", 110, { source: "pointer", final: true });
    expect(calls[0]!.measureWidths).toEqual({ plan: 110 });
    expect(pivotDesignProps({ rowHeight: 28 })).toEqual({ rowHeight: 28 });
  });
});
