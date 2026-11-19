import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildPivotModel } from "../core/pivot/build-model";
import type { PivotSpec } from "../core/pivot/types";
import { generatePlanningPivotRows, planningPivotSpec } from "../fixtures/planning-pivot-mock";
import { pivotOrderMeasures } from "./header-layout";
import { PivotTable, type PivotTableProps } from "./pivot-table";

const rows = generatePlanningPivotRows();
const planning = buildPivotModel(planningPivotSpec, rows);
const spec: PivotSpec = { ...planningPivotSpec, values: ["actual", "plan", "growth"], heat: null };
const model = buildPivotModel(spec, rows);
const html = (props: Partial<PivotTableProps>) => renderToStaticMarkup(createElement(PivotTable, { model, ...props }));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const leafCount = model.rows.filter((r) => r.kind === "leaf").length;

describe("PivotTable design props (markup)", () => {
  it("valueWidths: per-column <col> widths and table width; other columns keep valueWidth", () => {
    const out = html({ valueWidths: { "c:Nov:plan": 140 }, valueWidth: 90, mode: "static" });
    expect(out).toContain('<col style="width:140px"/>');
    expect(count(out, /<col style="width:90px"\/>/g)).toBe(model.columns.length - 1);
    expect(out).toContain(`width:${208 + 172 + 140 + 90 * (model.columns.length - 1)}px`);
  });

  it("resize handles: one per value column and dimension column, plus the row handle; none in static mode", () => {
    const props = { onValueWidthChange: () => {}, onDimensionWidthChange: () => {}, onRowHeightChange: () => {} };
    const out = html(props);
    expect(count(out, /role="separator"/g)).toBe(model.columns.length + 2 + 1);
    expect(out).toContain('aria-label="Resize column Nov Plan"');
    expect(out).toContain('aria-label="Resize column Department"');
    expect(out).toMatch(/role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize column Nov Actual" aria-valuenow="84" aria-valuemin="48" aria-valuemax="800"/);
    expect(out).toMatch(/aria-orientation="horizontal" aria-label="Resize rows" aria-valuenow="36" aria-valuemin="20" aria-valuemax="96"/);
    expect(html({ ...props, mode: "static" })).not.toContain('role="separator"');
  });

  it("measureOrder renders the measures in that order; onMeasureOrderChange makes their headers focusable", () => {
    const out = html({ measureOrder: ["growth", "plan"], mode: "static" });
    const heads = [...out.matchAll(/<th scope="col"[^>]*>(Actual|Plan|Growth on FY25)<\/th>/g)].slice(0, 3).map((m) => m[1]);
    expect(heads).toEqual(["Growth on FY25", "Plan", "Actual"]);
    expect(out).toBe(renderToStaticMarkup(createElement(PivotTable, { model: pivotOrderMeasures(model, ["growth", "plan"]), mode: "static" })));
    const drag = html({ onMeasureOrderChange: () => {} });
    expect(count(drag, /data-nq-run="/g)).toBe(12 * 3);
    expect(drag).toMatch(/data-nq-run="1:0" data-nq-measure="actual" tabindex="0" aria-keyshortcuts="Alt\+ArrowLeft Alt\+ArrowRight"/);
  });

  it("freezeHeader / freezeDimensions turn the sticky header and pinned columns off", () => {
    const frozen = html({});
    expect(frozen).toMatch(/nqg-pivot-sticky-head/);
    expect(frozen).toMatch(/nqg-pivot-pinned /);
    const noHead = html({ freezeHeader: false });
    expect(noHead).not.toMatch(/nqg-pivot-sticky-head/);
    expect(noHead).toMatch(/nqg-pivot-pinned-head[^"]*" style="left:0;height:36px"/); // dimension headers still pin left
    expect(noHead).toMatch(/nqg-pivot-pinned /);
    const noDims = html({ freezeDimensions: false });
    expect(noDims).not.toMatch(/nqg-pivot-pinned /);
    expect(noDims).toMatch(/nqg-pivot-sticky-head/);
    expect(noDims).toMatch(/nqg-pivot-pinned-head[^"]*" style="top:\d+px;height/);
    const none = html({ freezeHeader: false, freezeDimensions: false });
    expect(none).not.toMatch(/nqg-pivot-(sticky-head|pinned)/);
    // Virtualized body keeps working with the header unfrozen.
    expect(count(html({ freezeHeader: false, virtualize: true }), /data-nqg-virtual/g)).toBe(1);
    // Static: thead prints once instead of on every page.
    expect(html({ mode: "static", freezeHeader: false, pagination: { pageHeight: 500 } })).toContain('<thead style="display:table-row-group">');
  });

  it("style hooks: cellClassName, rowClassName, headerClassName, bandedRows", () => {
    const out = html({
      mode: "static",
      cellClassName: (ctx) => (ctx.cell.value !== null && ctx.cell.value < 0 ? "is-neg" : ctx.column.measureId === "plan" ? "is-plan" : undefined),
      rowClassName: (_, ctx) => `row-${ctx.kind}`,
      headerClassName: (ctx) => (ctx.kind === "measure" ? "head-measure" : undefined),
      bandedRows: true,
    });
    expect(count(out, /is-plan/g)).toBe(model.rows.length * 12);
    expect(count(out, /class="row-leaf" data-nq-band/g)).toBe(leafCount);
    expect(out).toContain('class="row-subtotal" data-nq-band="odd"');
    expect(count(out, /class="row-total"/g)).toBe(model.rows.filter((r) => r.kind === "grandTotal").length);
    expect(count(out, /head-measure/g)).toBe(12 * 3);
    expect(count(out, /data-nq-band="odd"/g)).toBe(Math.ceil(model.rows.length / 2));
    expect(count(out, /data-nq-band="even"/g)).toBe(Math.floor(model.rows.length / 2));
  });

  it("dataAttributes: measure, row kind and negative flags on cells", () => {
    const out = html({ mode: "static", dataAttributes: true });
    expect(count(out, /data-nq-measure="plan"/g)).toBe(model.rows.length * 12);
    const negatives = model.rows.flatMap((r) => r.cells).filter((c) => c.value !== null && c.value < 0).length;
    expect(negatives).toBeGreaterThan(0);
    expect(count(out, /data-nq-negative=""/g)).toBe(negatives);
    expect(out).toContain('data-nq-row-kind="total"');
    expect(out).toContain('data-nq-row-kind="subtotal"');
    expect(html({ mode: "static" })).not.toContain("data-nq-");
  });

  it("heat (several specs): data-nq-heat steps, scale and CSS-variable backgrounds; replaces the model heat", () => {
    const out = html({ mode: "static", heat: [{ measure: "actual" }, { measure: "growth", scale: "diverging" }] });
    expect(out).toMatch(/style="background-color:var\(--nq-pivot-heat-\d\)" data-nq-heat="\d" data-nq-heat-scale="sequential"/);
    expect(out).toMatch(/style="background-color:var\(--nq-pivot-heat-diverging-\d\)" data-nq-heat="\d" data-nq-heat-scale="diverging"/);
    expect(count(out, /data-nq-heat-scale="sequential"/g)).toBe(leafCount * 12);
    // The old single spec still works, and [] removes the model's own heat.
    expect(html({ model: planning, mode: "static", heat: { measure: "actual", levels: 3 } })).toMatch(/data-nq-heat="(0|4|8)"/);
    expect(renderToStaticMarkup(createElement(PivotTable, { model: planning, mode: "static", heat: [] }))).not.toMatch(/data-heat=|nqg-heat-/);
  });

  it("bars: an absolutely placed span behind the number, which stays the cell text", () => {
    const out = html({ mode: "static", bars: [{ measure: "plan" }] });
    expect(count(out, /data-nq-bar=""/g)).toBe(leafCount * 12);
    expect(out).toMatch(
      /<td class="[^"]*" style="position:relative;z-index:0"><span aria-hidden="true" data-nq-bar="" style="position:absolute;inset:20% auto 20% 0%;width:[\d.]+%;background-color:var\(--nq-pivot-bar\);z-index:-1"><\/span>\$[\d.]+[kM]<\/td>/,
    );
  });

  it("measureLayout: alignment and wrapping for one measure, header alignment follows", () => {
    const out = html({ mode: "static", measureLayout: { growth: { align: "center", wrap: "clip" }, plan: { wrap: "wrap" } } });
    expect(count(out, /text-align:center;white-space:nowrap;overflow:hidden;text-overflow:clip/g)).toBe(model.rows.length * 12);
    expect(count(out, /white-space:normal;overflow-wrap:anywhere/g)).toBe(model.rows.length * 12);
    expect(out).toMatch(/style="height:36px;text-align:center">Growth on FY25<\/th>/);
  });

  it("renderColumnHeader still overrides the header label (with a header class)", () => {
    const out = html({ mode: "static", renderColumnHeader: (ctx) => (ctx.kind === "measure" ? `${ctx.label} ($)` : ctx.label), headerClassName: () => "h" });
    expect(out).toContain("Plan ($)");
  });

  it("a resize (new widths, same model) reuses the cached heat / bar levels and measure order", () => {
    const own = buildPivotModel(spec, rows);
    const props = { model: own, mode: "static" as const, heat: { measure: "actual" }, bars: [{ measure: "plan" }], measureOrder: ["plan"] };
    const first = renderToStaticMarkup(createElement(PivotTable, { ...props, valueWidths: { "c:Nov:actual": 100 } }));
    // Change the values in place: a recomputation would move the levels; the cache keeps them.
    for (const row of own.rows) for (const cell of row.cells) (cell as { value: number | null }).value = 1;
    const second = renderToStaticMarkup(createElement(PivotTable, { ...props, valueWidths: { "c:Nov:actual": 140 } }));
    const levels = (s: string) => [...s.matchAll(/data-nq-heat="(\d)"|width:([\d.]+)%/g)].map((m) => m[0]);
    expect(levels(second)).toEqual(levels(first));
    expect(second).toContain('<col style="width:140px"/>');
  });

  it("review fixes: diverging spec.heat uses the diverging ramp; default heat measure ignores reorders; span cells are auto-fit targets", () => {
    const div = buildPivotModel({ ...spec, heat: { measure: "growth", scale: "diverging" } }, rows);
    const out = renderToStaticMarkup(createElement(PivotTable, { model: div, mode: "static" }));
    expect(out).toContain('data-nq-heat-scale="diverging"');
    expect(out).not.toMatch(/nqg-heat-\d/);
    const reordered = html({ mode: "static", heat: { scope: "column" }, measureOrder: ["plan"], dataAttributes: true });
    expect(reordered).toMatch(/data-nq-measure="actual" data-nq-row-kind="leaf" data-nq-heat=/);
    expect(reordered).not.toMatch(/data-nq-measure="plan" data-nq-row-kind="leaf" data-nq-heat=/);
    expect(html({ onDimensionWidthChange: () => {} })).toMatch(/data-nqg-span="\d+" data-nq-dim-col="0"/);
  });

  it("fractional valueWidth keeps the 0.4.0 band and table widths", () => {
    const out = renderToStaticMarkup(createElement(PivotTable, { model: planning, mode: "static", valueWidth: 84.1 }));
    expect(out).toContain(`width:${208 + 172 + 84.1 * planning.columns.length}px`);
  });
});

