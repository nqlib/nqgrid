import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { bench, describe } from "vitest";

import { buildPivotModel } from "../src/core/pivot/build-model";
import type { PivotModel } from "../src/core/pivot/types";
import { PivotTable, type PivotTableProps } from "../src/pivot/pivot-table";
import { benchBaseSpec, generateBenchRows } from "./dataset";

/**
 * `pnpm bench` — React render of `PivotTable` with the 0.5.0 design props (`renderToStaticMarkup`,
 * the whole render without a browser layout). `virtualize: true` with a large `overscan` puts
 * ≈ 10,000 value cells in the window. Budget: < 50 ms per render with heat + bars
 * (docs/pivot-performance.md).
 */
const rows = generateBenchRows(100_000);
const model: PivotModel = buildPivotModel({ ...benchBaseSpec, heat: null, headerCharts: null, kpis: [] }, rows);
// Node has no window: the virtual window is 1000 px / 36 px ≈ 28 rows + 2 × overscan.
const overscan = Math.ceil((10_000 / model.columns.length - 28) / 2);
const visibleCells = Math.min(model.rows.length, 28 + 2 * overscan) * model.columns.length;

/** The budgeted case: heat on two measures + bars on a third, virtualized. */
const heatAndBars: Partial<PivotTableProps> = {
  virtualize: true,
  overscan,
  heat: [{ measure: "actual", scope: "column" }, { measure: "units", scale: "diverging", midpoint: 50 }],
  bars: [{ measure: "plan" }],
};
const everything: Partial<PivotTableProps> = {
  ...heatAndBars,
  bandedRows: true,
  dataAttributes: true,
  onValueWidthChange: () => {},
  onMeasureOrderChange: () => {},
};
const render = (props: Partial<PivotTableProps>) => renderToStaticMarkup(createElement(PivotTable, { model, ...props }));
const opts = { iterations: 30, time: 1500, warmupIterations: 5 };

describe(`PivotTable render: ${visibleCells.toLocaleString("en-US")} visible value cells (${model.rows.length} rows × ${model.columns.length} columns)`, () => {
  bench("no design props (0.4.0 output)", () => {
    render({ virtualize: true, overscan });
  }, opts);

  bench("heat ×2 + bars (budget: < 50 ms)", () => {
    render(heatAndBars);
  }, opts);

  // A resize drag: only widths change; the model, its heat and bar levels come from the cache.
  let w = 84;
  bench("resize frame: heat + bars, new valueWidths, same model", () => {
    w = w === 84 ? 120 : 84;
    render({ ...heatAndBars, valueWidths: { [model.columns[0]!.id]: w } });
  }, opts);

  bench("cold: heat + bar levels computed for a new model object", () => {
    render({ ...heatAndBars, model: { ...model } });
  }, opts);

  bench("everything: heat + bars + bands + data attributes + resize / reorder handles", () => {
    render(everything);
  }, opts);
});
