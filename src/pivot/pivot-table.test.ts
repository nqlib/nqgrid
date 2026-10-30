import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildPivotModel } from "../core/pivot/build-model";
import { generatePlanningPivotRows, planningPivotSpec } from "../fixtures/planning-pivot-mock";
import { PivotHeaderChartBand } from "./pivot-header-chart";
import { PivotKpiPanel } from "./pivot-kpi-panel";
import { PivotTable } from "./pivot-table";

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
