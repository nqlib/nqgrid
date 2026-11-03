import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildPivotModel } from "../core/pivot/build-model";
import type { PivotSpec } from "../core/pivot/types";
import { generatePlanningPivotRows, planningDatesPivotSpec, planningPivotSpec } from "../fixtures/planning-pivot-mock";
import { reducePivotGridSpec } from "./grid-state";
import { pivotColumnHeaderRole, pivotVirtualRowWindow } from "./layout";
import { PivotHeaderChartBand } from "./pivot-header-chart";
import { PivotKpiPanel } from "./pivot-kpi-panel";
import { PivotTable, type PivotColumnHeaderContext } from "./pivot-table";

/** Components render from the model alone, so `renderToStaticMarkup` (Phase 3 PDF path) sees the full grid. */
const rows = generatePlanningPivotRows();
const model = buildPivotModel(planningPivotSpec, rows);
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe("PivotTable (static markup)", () => {
  const staticHtml = html(createElement(PivotTable, { model, mode: "static" }));
  const interactiveHtml = html(createElement(PivotTable, { model, onToggleGroup: () => {} }));

  it("renders one body row per model row and real rowSpans from model.spans", () => {
    expect(count(staticHtml, /<tr data-kind=/g)).toBe(model.rows.length);
    expect(staticHtml).toContain('rowSpan="6" class=');
    expect(staticHtml).toContain('rowSpan="7" class=');
    expect(count(staticHtml, /data-nqg-span="/g)).toBe(model.spans[0]!.length);
  });

  it("department spans show the KPI panel when expanded, a compact delta when collapsed", () => {
    expect(count(staticHtml, /data-nqg-kpi-panel/g)).toBe(2); // Camp + Packs
    expect(staticHtml).toContain("Growth on FY25");
    expect(staticHtml).toContain("$4.35M"); // Camp forecast
    expect(staticHtml).toContain("vs Plan");
    expect(staticHtml).toContain("Ingrid Solberg");
    expect(staticHtml).toContain(">Footwear<");
    expect(staticHtml).not.toContain("Maya Chen"); // Footwear is collapsed → no panel
  });

  it("heat cells carry level classes, data-heat and CSS-variable backgrounds", () => {
    const leafHeat = model.rows.filter((r) => r.kind === "leaf").flatMap((r) => r.cells).filter((c) => c.heat !== undefined);
    expect(count(staticHtml, /data-heat="/g)).toBe(leafHeat.length);
    expect(staticHtml).toMatch(/class="[^"]*nqg-heat-\d[^"]*" style="background-color:var\(--nqg-heat-\d, color-mix/);
  });

  it("header band: summary + one SVG bar per month, stacked by department", () => {
    expect(count(staticHtml, /data-nqg-bar="/g)).toBe(12);
    expect(count(staticHtml, /data-series="/g)).toBe(12 * 4);
    expect(staticHtml).toContain('aria-label="Nov: $5.5M"');
    expect(staticHtml).toMatch(/data-nqg-summary="">.*Actual.*\$66\.\dM/);
    expect(staticHtml).toContain("var(--nqg-series-0, #2a78d6)");
  });

  it("static mode: no buttons and no sticky positioning; interactive adds both", () => {
    expect(staticHtml).not.toContain("<button");
    expect(staticHtml).not.toMatch(/\bsticky\b/);
    expect(staticHtml).toContain('data-nqg-mode="static"');
    expect(count(interactiveHtml, /<button/g)).toBe(8); // 4 departments × (span + line cell)
    expect(interactiveHtml).toContain('aria-label="Collapse Camp"');
    expect(interactiveHtml).toMatch(/class="[^"]*sticky[^"]*" style="left:208px/);
    expect(interactiveHtml).toContain("position:sticky;top:");
  });

  it("interactive mode without a handler renders no toggles", () => {
    expect(html(createElement(PivotTable, { model }))).not.toContain("<button");
  });

  it("renderSpanCell replaces the KPI slot; compact layout uses one dimension column", () => {
    const custom = html(
      createElement(PivotTable, {
        model,
        mode: "static",
        renderSpanCell: (row, ctx) => createElement("em", null, `${row.label}:${ctx.rowSpan}`),
      }),
    );
    expect(custom).toContain("<em>Camp:6</em>");
    const compact = html(createElement(PivotTable, { model: { ...model, layout: "compact" }, mode: "static" }));
    expect(compact).toContain("Department / Line");
    expect(compact).not.toContain("rowSpan=\"6\" class=");
  });

  it("headerChart={false} drops the band", () => {
    expect(html(createElement(PivotTable, { model, mode: "static", headerChart: false }))).not.toContain("data-nqg-band");
  });
});

describe("standalone pieces", () => {
  it("PivotKpiPanel prints headline, rows, deltas and caption", () => {
    const camp = model.rows.find((r) => r.label === "Camp")!;
    const out = html(createElement(PivotKpiPanel, { kpis: camp.kpis!, title: "Camp", caption: "Ingrid Solberg" }));
    expect(out).toMatch(/Growth on FY25<\/div><div class="[^"]*text-emerald-600[^"]*">\+1%/);
    expect(out).toContain("<dt");
    expect(out).toContain(">IS<");
  });

  it("PivotHeaderChartBand renders a single header row", () => {
    const out = html(createElement("table", null, createElement("thead", null, createElement(PivotHeaderChartBand, { model, mode: "static" }))));
    expect(count(out, /<tr/g)).toBe(1);
    expect(out).toContain('colSpan="2"');
  });
});

describe("PivotTable with several column fields", () => {
  const dateRows = generatePlanningPivotRows(7, { extraFields: true, orderDates: true });
  const dates = buildPivotModel(planningDatesPivotSpec, dateRows);

  it("renders row-spanning subtotal headers and column-group toggles", () => {
    const interactive = html(createElement(PivotTable, { model: dates, onToggleColumnGroup: () => {} }));
    expect(interactive).toContain('aria-label="Expand FY25"');
    expect(interactive).toContain('aria-label="Collapse FY26"');
    expect(count(interactive, /data-nqg-column-toggle=""/g)).toBe(2);
    expect(interactive).toMatch(/rowSpan="2"[^>]*data-nqg-subtotal=""/);
    const plain = html(createElement(PivotTable, { model: dates, mode: "static" }));
    expect(plain).not.toContain("data-nqg-column-toggle");
    // Header bars: FY25 (collapsed) and the four FY26 quarters, none over subtotals / the total.
    expect(count(plain, /data-nqg-bar="/g)).toBe(5);
  });

  it("renderColumnHeader gets each cell's role, field and Columns-area position", () => {
    const seen: PivotColumnHeaderContext[] = [];
    html(createElement(PivotTable, { model: dates, renderColumnHeader: (ctx: PivotColumnHeaderContext) => (seen.push(ctx), ctx.label) }));
    expect(seen.map((c) => [c.label, c.kind, c.level, c.areaIndex, c.dimension?.field ?? null])).toEqual([
      ["FY25", "dimension", 0, 0, "orderDate:year"],
      ["FY26", "dimension", 0, 0, "orderDate:year"],
      ["FY26 Total", "subtotal", 0, 0, "orderDate:year"],
      ["Total", "total", null, 2, null],
      ["Q1", "dimension", 1, 1, "orderDate:quarter"],
      ["Q2", "dimension", 1, 1, "orderDate:quarter"],
      ["Q3", "dimension", 1, 1, "orderDate:quarter"],
      ["Q4", "dimension", 1, 1, "orderDate:quarter"],
    ]);
    // One column field with Σ Values outermost: measures are row 0 (area index 0), months row 1.
    const two = buildPivotModel({ ...planningPivotSpec, values: ["actual", "plan"], valuesIndex: 0, totals: { rowTotal: true } }, rows);
    const roles = two.headerRows.map((r, i) => r.map((h) => pivotColumnHeaderRole(two, i, h)));
    expect(roles[0]![0]).toEqual({ kind: "measure", level: null, areaIndex: 0 });
    expect(roles[0]!.at(-1)!.kind).toBe("total");
    expect(roles[1]![0]).toEqual({ kind: "dimension", level: 0, areaIndex: 1 });
    expect(roles[1]!.at(-1)!.kind).toBe("measure");
  });

  it("reducer: column-group toggles and date grouping", () => {
    const spec: PivotSpec = { ...planningDatesPivotSpec, columnsExpanded: undefined };
    const model = buildPivotModel(spec, dateRows);
    const collapsed = reducePivotGridSpec(spec, model, { type: "toggleColumnGroup", path: ["2025"] });
    expect(collapsed.columnsExpanded).toEqual([["2026"]]);
    expect(reducePivotGridSpec(spec, model, { type: "collapseAllColumns" }).columnsExpanded).toBe("none");
    expect(reducePivotGridSpec(collapsed, model, { type: "expandAllColumns" }).columnsExpanded).toBe("all");
    const months = reducePivotGridSpec(spec, model, { type: "setDateGrouping", field: "orderDate", groups: ["year", "month"] });
    expect(months.columns).toEqual([{ field: "orderDate:year" }, { field: "orderDate:month", label: "Month (Order date)" }]);
  });
});

describe("PivotTable row virtualization", () => {
  // 6 regions × 600 customers: 3,606 body rows × 13 value columns.
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const bigRows = Array.from({ length: 30_000 }, (_, i) => ({
    region: `R${Math.floor(i / 5000)}`,
    customer: `C${(i * 7919) % 600}`,
    month: months[i % 12],
    actual: (i * 37) % 1000,
  }));
  const big = buildPivotModel(
    {
      version: 1,
      rows: [{ field: "region" }, { field: "customer" }],
      columns: { field: "month" },
      measures: [{ id: "actual", field: "actual" }],
      totals: { rowTotal: true },
    },
    bigRows,
  );
  const rowsIn = (s: string) => count(s, /<tr data-kind=/g);

  it("auto: large interactive bodies render a window plus a bottom spacer of the remaining height", () => {
    expect(big.rows.length).toBeGreaterThan(3000);
    const out = html(createElement(PivotTable, { model: big, onToggleGroup: () => {} }));
    expect(out).toContain('data-nqg-virtual=""');
    const rendered = rowsIn(out);
    expect(rendered).toBeGreaterThan(20);
    expect(rendered).toBeLessThan(120);
    // Rows are 36px until measured: the spacer holds every row that is not rendered.
    expect(out).toContain(`data-nqg-spacer="" style="height:${(big.rows.length - rendered) * 36}px`);
    expect(out).toContain(`aria-rowcount="${big.headerRows.length + big.rows.length}"`);
    // The region spans are clipped to the rendered rows, so no cell spans into the spacer.
    const spans = [...out.matchAll(/rowSpan="(\d+)"[^>]*data-nqg-span="(\d+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(spans.length).toBeGreaterThan(0);
    for (const [shown, total] of spans) expect(shown).toBeLessThanOrEqual(Math.min(total!, rendered));
  });

  it("virtualize={false}, static mode and small models render every row", () => {
    expect(rowsIn(html(createElement(PivotTable, { model: big, virtualize: false })))).toBe(big.rows.length);
    const printed = html(createElement(PivotTable, { model: big, mode: "static", virtualize: true }));
    expect(rowsIn(printed)).toBe(big.rows.length);
    expect(printed).not.toContain("data-nqg-virtual");
    const small = html(createElement(PivotTable, { model, onToggleGroup: () => {} }));
    expect(small).not.toContain("data-nqg-virtual");
    expect(small).not.toContain("aria-rowcount");
    expect(rowsIn(html(createElement(PivotTable, { model, virtualize: true })))).toBeLessThanOrEqual(model.rows.length);
  });
});

describe("pivotVirtualRowWindow", () => {
  const top = (i: number) => i * 36;
  it("covers the viewport plus overscan, aligned to chunks", () => {
    expect(pivotVirtualRowWindow(1000, top, 0, 360, 4)).toEqual({ start: 0, end: 16 });
    // Rows 100…110 visible; ± 4 rows, widened to multiples of 8.
    expect(pivotVirtualRowWindow(1000, top, 3600, 360, 4)).toEqual({ start: 96, end: 120 });
    // A small scroll keeps the window.
    expect(pivotVirtualRowWindow(1000, top, 3610, 360, 4)).toEqual({ start: 96, end: 120 });
    expect(pivotVirtualRowWindow(1000, top, 36_000, 360, 4)).toEqual({ start: 992, end: 1000 });
    expect(pivotVirtualRowWindow(0, top, 0, 360, 4)).toEqual({ start: 0, end: 0 });
    // Body below the viewport (negative offset) or above it.
    expect(pivotVirtualRowWindow(1000, top, -5000, 360, 4)).toEqual({ start: 0, end: 8 });
    expect(pivotVirtualRowWindow(1000, top, 99_999, 360, 4)).toEqual({ start: 992, end: 1000 });
  });
  it("uses the given row tops (taller rows, filler rows)", () => {
    const tops = [0, 36, 200, 236, 272];
    expect(pivotVirtualRowWindow(4, (i) => tops[i]!, 210, 20, 0, 1)).toEqual({ start: 2, end: 3 });
  });
});
