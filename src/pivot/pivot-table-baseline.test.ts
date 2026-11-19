import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildPivotModel } from "../core/pivot/build-model";
import { fpaPivotSpec, generateFpaPivotRows } from "../fixtures/fpa-pivot-mock";
import { generatePlanningPivotRows, planningMultiColumnPivotSpec, planningPivotSpec } from "../fixtures/planning-pivot-mock";
import { generateStatementPivotRows, statementPivotSpec } from "../fixtures/statement-pivot-mock";
import { pivotTableGeometry } from "./layout";
import { PivotTable, type PivotTableProps } from "./pivot-table";

/**
 * 0.5.0 added design props (widths, freeze, heat / bars, style hooks, …). With none of them set,
 * `PivotTable` must print the same bytes as 0.4.0. The snapshots under `__snapshots__/baseline/`
 * were written by the 0.4.0 renderer; never regenerate them to make this test pass.
 */
const planningRows = generatePlanningPivotRows();
const planning = buildPivotModel(planningPivotSpec, planningRows);
const multi = buildPivotModel(planningMultiColumnPivotSpec, planningRows);
const statement = buildPivotModel(statementPivotSpec, generateStatementPivotRows());
const fpa = buildPivotModel(fpaPivotSpec, generateFpaPivotRows());

const cases: readonly (readonly [string, PivotTableProps])[] = [
  ["planning-static", { model: planning, mode: "static" }],
  ["planning-interactive", { model: planning, onToggleGroup: () => {}, onToggleColumnGroup: () => {}, onDrillThrough: () => {} }],
  ["planning-virtual", { model: planning, virtualize: true, onToggleGroup: () => {} }],
  ["planning-paginated", { model: planning, mode: "static", pagination: { pageHeight: 600, firstPageOffset: 80 } }],
  ["planning-compact", { model: { ...planning, layout: "compact" }, mode: "static", pagination: { pageHeight: 500 } }],
  ["multi-column-interactive", { model: multi, onToggleColumnGroup: () => {}, dimensionWidths: [180, 140], valueWidth: 96 }],
  ["statement-static", { model: statement, mode: "static", rowHeight: 30, headRowHeight: 32 }],
  ["fpa-interactive", { model: fpa }],
];

describe("PivotTable with no design props is byte-identical to 0.4.0", () => {
  for (const [name, props] of cases) {
    it(name, async () => {
      await expect(renderToStaticMarkup(createElement(PivotTable, props))).toMatchFileSnapshot(`./__snapshots__/baseline/${name}.html`);
    });
  }

  it("pivotTableGeometry keeps its 0.4.0 fields", () => {
    const g = pivotTableGeometry(planning, { dimensionWidths: [200, 150], valueWidth: 90 });
    expect({
      dimensionColumns: g.dimensionColumns,
      dimensionWidths: g.dimensionWidths,
      dimensionOffsets: g.dimensionOffsets,
      valueWidth: g.valueWidth,
      width: g.width,
    }).toEqual({ dimensionColumns: 2, dimensionWidths: [200, 150], dimensionOffsets: [0, 200], valueWidth: 90, width: 350 + 90 * planning.columns.length });
  });
});
