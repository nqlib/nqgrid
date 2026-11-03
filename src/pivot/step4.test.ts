import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildPivotModel, createPivotModelBuilder } from "../core/pivot/build-model";
import type { PivotDrillThroughTarget } from "../core/pivot/cube";
import type { PivotSpec } from "../core/pivot/types";
import { generatePlanningPivotRows, planningCalcPivotSpec, planningFieldCatalog, planningPivotSpec } from "../fixtures/planning-pivot-mock";
import { reducePivotGridSpec } from "./grid-state";
import { pivotBodyGroups, pivotDimensionSlots } from "./layout";
import { PivotDrillThroughPanel, pivotDrillThroughFieldInfo, pivotDrillThroughTitle } from "./pivot-drill-through";
import { PivotFieldList } from "./pivot-field-list";
import { PivotCalculatedMeasureForm, pivotCalcReference, PivotShowAsMenu } from "./pivot-measure-menus";
import { PivotTable, type PivotCellContext, type PivotTableProps } from "./pivot-table";

const rows = generatePlanningPivotRows(7, { extraFields: true, orderDates: true });
const model = buildPivotModel(planningCalcPivotSpec, rows);
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

/** Elements of a rendered tree (function components are not expanded). */
function* walk(node: ReactNode): Generator<ReactElement<Record<string, unknown>>> {
  if (Array.isArray(node)) for (const n of node) yield* walk(n);
  else if (isValidElement(node)) {
    const el = node as ReactElement<Record<string, unknown>>;
    yield el;
    yield* walk(el.props.children as ReactNode);
  }
}

describe("reducePivotGridSpec: step-4 actions", () => {
  const base: PivotSpec = { ...planningPivotSpec, fields: planningFieldCatalog };
  const m = buildPivotModel(base, generatePlanningPivotRows(7, { extraFields: true }));
  it("routes calculated measures, show-as, subtotals and measure removal to the core helpers", () => {
    const calc = reducePivotGridSpec(base, m, { type: "setCalculatedMeasure", measure: { id: "vs", label: "vs Plan", calculate: "actual / plan - 1" } });
    expect(calc.values).toEqual(["actual", "vs"]);
    expect(reducePivotGridSpec(base, m, { type: "setCalculatedMeasure", measure: { calculate: "actual /" } })).toBe(base);
    const showAs = reducePivotGridSpec(calc, m, { type: "setMeasureShowAs", measureId: "actual", showAs: "runningTotal", base: { field: "month" } });
    expect(showAs.measures[0]).toMatchObject({ showAs: "runningTotal", showAsBase: { field: "month" } });
    expect(reducePivotGridSpec(base, m, { type: "setSubtotal", field: "department", position: "end" }).rows[0]!.subtotal).toBe("end");
    expect(reducePivotGridSpec(calc, m, { type: "removeMeasure", measureId: "vs" }).values).toEqual(["actual"]);
  });
});

describe("PivotTable: subtotal rows and drill-through", () => {
  it("renders subtotal rows in tabular and compact layouts (static too)", () => {
    const html = renderToStaticMarkup(createElement(PivotTable, { model, mode: "static" }));
    expect(count(html, /data-kind="subtotal"/g)).toBe(2);
    expect(html).toContain(">Camp Total<");
    const slots = pivotDimensionSlots(model);
    const at = model.rows.findIndex((r) => r.kind === "subtotal");
    expect(slots[at]).toEqual([{ type: "covered", level: 0 }, { type: "subtotal", level: 1 }]);
    expect(pivotBodyGroups(model).find((g) => g.id === "r:Camp")!.end).toBe(at + 1);
    const compact = renderToStaticMarkup(createElement(PivotTable, { model: { ...model, layout: "compact" }, mode: "static" }));
    expect(compact).toContain("Camp Total");
  });

  it("double-click calls onDrillThrough with the cell's target (interactive only)", () => {
    const calls: [PivotDrillThroughTarget, PivotCellContext][] = [];
    const props: PivotTableProps = { model, onDrillThrough: (t, c) => calls.push([t, c]) };
    const tree = (PivotTable as unknown as { type: (p: PivotTableProps) => ReactNode }).type(props);
    const cells = [...walk(tree)].filter((el) => typeof el.props.onDoubleClick === "function");
    expect(cells.length).toBe(model.rows.length * model.columns.length);
    (cells[2 * model.columns.length + 6]!.props.onDoubleClick as () => void)();
    const [target, ctx] = calls[0]!;
    expect(target).toEqual({ path: model.rows[2]!.path, columnPath: ["2026"], measureId: "vsPlan" });
    expect(ctx).toMatchObject({ rowIndex: 2, columnIndex: 6, column: model.columns[6] });
    const staticTree = (PivotTable as unknown as { type: (p: PivotTableProps) => ReactNode }).type({ ...props, mode: "static" });
    expect([...walk(staticTree)].some((el) => typeof el.props.onDoubleClick === "function")).toBe(false);
  });
});

describe("PivotDrillThroughPanel", () => {
  it("renders records with labels, formats and a count", () => {
    const builder = createPivotModelBuilder();
    builder.build(planningCalcPivotSpec, rows);
    const target: PivotDrillThroughTarget = { path: ["Camp", "Tents"], columnPath: ["2026"], measureId: "vsPlan" };
    const result = builder.drillThrough(planningCalcPivotSpec, rows, target, { limit: 5 });
    expect(result.total).toBe(12);
    const info = pivotDrillThroughFieldInfo(planningCalcPivotSpec);
    const title = pivotDrillThroughTitle(model, target);
    expect(title).toBe("Camp › Tents · FY26 · vs Plan");
    const html = renderToStaticMarkup(createElement(PivotDrillThroughPanel, { result, title, ...info, onClose: () => {} }));
    expect(html).toContain("Showing 5 of 12 records");
    expect(html).toContain(">Order date<");
    expect(count(html, /<tr>/g)).toBe(6);
    expect(html).toMatch(/\$\d/); // actual / plan in the measure's currency format
    expect(renderToStaticMarkup(createElement(PivotDrillThroughPanel, { result: { ...result, records: [], indices: [], total: 0 } }))).toContain("No records");
  });
});

describe("measure menus", () => {
  it("PivotCalculatedMeasureForm renders, and pre-fills when editing", () => {
    const html = renderToStaticMarkup(createElement(PivotCalculatedMeasureForm, { spec: planningCalcPivotSpec, measureId: "vsPlan", onSubmit: () => {} }));
    expect(html).toContain("Edit calculated measure");
    expect(html).toContain("actual / plan - 1</textarea>");
    expect(html).toContain('aria-invalid="false"');
    expect(pivotCalcReference("prior year")).toBe("[prior year]");
    expect(pivotCalcReference("and")).toBe("[and]");
    expect(pivotCalcReference("actual")).toBe("actual");
  });

  it("PivotShowAsMenu shows the base field and item for differences", () => {
    const html = renderToStaticMarkup(createElement(PivotShowAsMenu, { spec: planningCalcPivotSpec, measureId: "yoy", onChange: () => {} }));
    expect(html).toContain("% difference from");
    expect(html).toContain("data-nqg-show-as-field");
    expect(html).toContain("(previous)");
    const running = renderToStaticMarkup(createElement(PivotShowAsMenu, { spec: planningCalcPivotSpec, measureId: "cumShare", onChange: () => {} }));
    expect(running).not.toContain("data-nqg-show-as-item");
  });

  it("the field list offers a calculated measure button and distinct count", () => {
    const html = renderToStaticMarkup(createElement(PivotFieldList, { spec: planningCalcPivotSpec, onSpecChange: () => {} }));
    expect(html).toContain("data-nqg-add-calculated");
    expect(html).toContain("Calculated measure…");
  });
});
