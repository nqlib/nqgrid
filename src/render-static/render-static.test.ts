import { describe, expect, it } from "vitest";

import { buildPivotModel } from "../core/pivot/build-model";
import type { PivotSpec } from "../core/pivot/types";
import { generatePlanningPivotRows, planningPivotSpec } from "../fixtures/planning-pivot-mock";
import { pivotBodyGroups, pivotKpiPanelHeight } from "../pivot/layout";
import { PIVOT_SERIES_COLORS } from "../styles";
import {
  PIVOT_STATIC_CSS,
  mixHexColors,
  pivotColumnChunks,
  pivotColumnsPerPage,
  pivotHeatFillHex,
  pivotStaticLayout,
  renderPivotHtml,
  renderPivotHtmlFromSpec,
  resolvePivotStaticPage,
  slicePivotModelColumns,
} from "./index";

const rows = generatePlanningPivotRows();
const model = buildPivotModel(planningPivotSpec, rows);
const generatedAt = "2026-01-15 09:30 UTC";
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe("renderPivotHtml", () => {
  const html = renderPivotHtml(model, { generatedAt });

  it("matches the golden planning report (contract/pivot/v1/examples/planning.html)", async () => {
    await expect(html).toMatchFileSnapshot("../../contract/pivot/v1/examples/planning.html");
  });

  it("is deterministic and equals renderPivotHtmlFromSpec", () => {
    expect(renderPivotHtml(model, { generatedAt })).toBe(html);
    expect(renderPivotHtmlFromSpec(planningPivotSpec, rows, { generatedAt })).toBe(html);
    expect(renderPivotHtml(model, { generatedAt: new Date(Date.UTC(2026, 0, 15, 9, 30)) })).toBe(html);
  });

  it("is a standalone document: inline CSS, no scripts, fonts or network URLs", () => {
    expect(html.startsWith("<!DOCTYPE html>\n<html lang=\"en\" data-theme=\"light\">")).toBe(true);
    expect(html).toContain(`<style>\n${PIVOT_STATIC_CSS}`);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/https?:/i);
    expect(html).not.toMatch(/@import|url\(|<link/i);
    expect(html).toContain("<title>FY26 Sales Plan</title>");
    expect(html).toContain("Generated 2026-01-15 09:30 UTC");
  });

  it("keeps only semantic classes (no Tailwind utilities)", () => {
    const classes = new Set([...html.matchAll(/ class="([^"]*)"/g)].flatMap((m) => m[1]!.split(" ")));
    expect([...classes].every((c) => c.startsWith("nqg-"))).toBe(true);
    for (const c of ["nqg-pivot", "nqg-pivot-span", "nqg-pivot-kpi", "nqg-pivot-heat", "nqg-pivot-band", "nqg-pivot-up"]) {
      expect(classes.has(c)).toBe(true);
      expect(PIVOT_STATIC_CSS).toContain(`.${c}`);
    }
  });

  it("prints one thead (band + headers), real rowSpans and one tbody per top-level group", () => {
    expect(count(html, /<thead>/g)).toBe(1);
    expect(html).toMatch(/<thead><tr style="height:76px" data-nqg-band="">/);
    expect(html).toContain('rowSpan="6"');
    expect(html).toContain('rowSpan="7"');
    expect(count(html, /<tbody data-nqg-group="group">/g)).toBe(4);
    expect(count(html, /<tbody data-nqg-group="grandTotal">/g)).toBe(1);
    expect(count(html, /data-nqg-kpi-panel/g)).toBe(2);
    expect(count(html, /data-nqg-filler/g)).toBe(0);
    expect(html).not.toContain("<button");
    expect(html).not.toMatch(/position:sticky/);
  });

  it("prints repeated-header and page CSS (landscape A4 by default)", () => {
    expect(PIVOT_STATIC_CSS).toContain(".nqg-pivot thead { display: table-header-group; break-inside: avoid; }");
    expect(PIVOT_STATIC_CSS).toContain(".nqg-pivot tbody { break-inside: avoid; }");
    expect(html).toContain("@page { size: 297mm 210mm; margin: 16mm 10mm 14mm 10mm; }");
    const letter = renderPivotHtml(model, { page: { size: "Letter", orientation: "portrait", margins: { top: 12 } } });
    expect(letter).toContain("@page { size: 215.9mm 279.4mm; margin: 12mm 10mm 14mm 10mm; }");
  });

  it("dark theme: data-theme, dark surfaces and dark series steps", () => {
    const dark = renderPivotHtml(model, { theme: "dark", generatedAt });
    expect(dark).toContain('<html lang="en" data-theme="dark" class="dark">');
    const darkBlock = PIVOT_STATIC_CSS.slice(PIVOT_STATIC_CSS.indexOf(':root[data-theme="dark"], .dark {'));
    PIVOT_SERIES_COLORS.dark.forEach((c, i) => expect(darkBlock).toContain(`--nqg-series-${i}: ${c};`));
    expect(darkBlock).toContain(`--nqg-heat-8: ${pivotHeatFillHex(8, "dark")};`);
    expect(PIVOT_STATIC_CSS).toContain(`--nqg-series-0: ${PIVOT_SERIES_COLORS.light[0]};`);
  });

  it("splits wide pivots into column chunks that repeat the dimension columns", () => {
    const chunked = renderPivotHtml(model, { generatedAt, maxColumnsPerPage: 5 });
    expect(count(chunked, /<section class="nqg-report-chunk"/g)).toBe(3); // 12 months → 4 + 4 + 4
    expect(count(chunked, /<thead>/g)).toBe(3);
    expect(count(chunked, />Department<\/th>/g)).toBe(3);
    expect(count(chunked, /data-nqg-bar="/g)).toBe(12);
    expect(count(chunked, /FY26 Sales Plan \(cont\.\)/g)).toBe(2);
    expect(chunked).toContain("Month Nov – Feb · Columns 1–4 of 12");
    expect(chunked).toContain("Month Jul – Oct · Columns 9–12 of 12");
    // Band summary keeps the full-year total on every chunk.
    expect(count(chunked, /\$66\.\dM/g)).toBe(3);
    const labels = renderPivotHtml(model, { maxColumnsPerPage: 6, locale: { lang: "de", continued: "(Forts.)", columns: "Spalten", of: "von" } });
    expect(labels).toContain('<html lang="de"');
    expect(labels).toContain("FY26 Sales Plan (Forts.)");
    expect(labels).toContain("Spalten 7–12 von 12");
  });

  it("fits 12 months on one landscape page by zooming, splits on portrait", () => {
    const landscape = pivotStaticLayout(model);
    expect(landscape.chunks).toHaveLength(1);
    expect(landscape.scale).toBeGreaterThan(0.7);
    expect(landscape.scale).toBeLessThan(1);
    expect(renderPivotHtml(model)).toContain(`style="zoom:${landscape.scale}"`);
    const portrait = pivotStaticLayout(model, { page: { orientation: "portrait" } });
    expect(portrait.chunks.map((c) => c.end - c.start)).toEqual([6, 6]);
  });

  it("tall KPI panels get a filler row instead of stretching data rows", () => {
    const few = rows.filter((r) => r.department !== "Camp" || r.line === "Tents");
    const m = buildPivotModel({ ...planningPivotSpec, expanded: "all" }, few);
    const out = renderPivotHtml(m);
    const camp = m.spans[0]!.find((s) => s.path[0] === "Camp")!;
    expect(camp.span).toBe(2);
    expect(out).toMatch(/rowSpan="3" class="[^"]*" data-nqg-span="2"/);
    expect(count(out, /<tr data-nqg-filler="" aria-hidden="true" style="height:\d+px">/g)).toBe(1);
    const need = pivotKpiPanelHeight(m.rows[camp.rowIndex]!.kpis!, { caption: true });
    expect(out).toContain(`style="height:${need - 2 * 36}px"`);
    expect(renderPivotHtml(m, { kpiPanel: false })).not.toContain("data-nqg-filler");
  });

  it("renders compact layouts, several measures and models without a column dimension", () => {
    const compact = renderPivotHtml(buildPivotModel({ ...planningPivotSpec, layout: "compact", values: ["actual", "plan"] }, rows), { maxColumnsPerPage: 8 });
    expect(compact).toContain("Department / Line");
    expect(count(compact, /<section class="nqg-report-chunk"/g)).toBe(3); // 24 columns, months never split
    const flat: PivotSpec = { version: 1, rows: [{ field: "department" }], measures: [{ id: "actual", field: "actual" }] };
    const out = renderPivotHtml(buildPivotModel(flat, rows), { generatedAt });
    expect(out).toContain("Generated 2026-01-15 09:30 UTC");
    expect(out).not.toContain("nqg-report-title\"");
    expect(count(out, /<tr data-kind=/g)).toBe(5);
  });

  it("kpiPanel: false prints labels with the headline delta; title: null drops the header", () => {
    const plain = renderPivotHtml(model, { kpiPanel: false, title: null });
    expect(plain).not.toContain("data-nqg-kpi-panel");
    expect(plain).not.toContain('<header class="nqg-report-header"');
    expect(plain).toMatch(/>Camp<\/span><span class="nqg-pivot-delta nqg-pivot-up" title="Growth on FY25">\+1%/);
  });
});

describe("static paging helpers", () => {
  it("resolvePivotStaticPage: sizes in mm and content box in px", () => {
    const a4 = resolvePivotStaticPage();
    expect([a4.size, a4.orientation, a4.widthMm, a4.heightMm]).toEqual(["A4", "landscape", 297, 210]);
    expect(a4.contentWidthPx).toBe(Math.floor((277 * 96) / 25.4));
    const letter = resolvePivotStaticPage({ size: "Letter", orientation: "portrait" });
    expect([letter.widthMm, letter.heightMm]).toEqual([215.9, 279.4]);
  });

  it("pivotColumnChunks balances chunks and never splits a top-level header", () => {
    expect(pivotColumnChunks(model, 12).map((c) => [c.start, c.end])).toEqual([[0, 12]]);
    expect(pivotColumnChunks(model, 5).map((c) => [c.start, c.end])).toEqual([[0, 4], [4, 8], [8, 12]]);
    expect(pivotColumnChunks(model, 7).map((c) => c.end - c.start)).toEqual([6, 6]);
    const two: PivotSpec = { ...planningPivotSpec, values: ["actual", "plan"] };
    const m2 = buildPivotModel(two, rows);
    const chunks = pivotColumnChunks(m2, 5);
    expect(chunks.every((c) => c.start % 2 === 0 && c.end - c.start <= 5)).toBe(true);
    expect(chunks[chunks.length - 1]!.end).toBe(24);
    const sub = slicePivotModelColumns(m2, chunks[1]!.start, chunks[1]!.end);
    expect(sub.headerRows.map((r) => r.reduce((a, h) => a + h.colSpan, 0))).toEqual([4, 4]);
  });

  it("slicePivotModelColumns keeps rows and the global header-bar scale", () => {
    const sub = slicePivotModelColumns(model, 3, 6);
    expect(sub.columns.map((c) => c.columnKey)).toEqual(["Feb", "Mar", "Apr"]);
    expect(sub.rows.every((r) => r.cells.length === 3)).toBe(true);
    expect(sub.rows).toHaveLength(model.rows.length);
    expect(sub.headerSeries!.points.map((p) => p.columnKey)).toEqual(["Feb", "Mar", "Apr"]);
    expect(sub.headerSeries!.max).toBe(model.headerSeries!.max);
    expect(sub.spans).toBe(model.spans);
    expect(slicePivotModelColumns(model, 0, 12)).toBe(model);
  });

  it("pivotColumnsPerPage honours minScale", () => {
    expect(pivotColumnsPerPage(model, { widthPx: 1000, minScale: 1, dimensionWidths: [200, 200], valueWidth: 100 })).toBe(6);
    expect(pivotColumnsPerPage(model, { widthPx: 1000, minScale: 0.5, dimensionWidths: [200, 200], valueWidth: 100 })).toBe(16);
    expect(pivotColumnsPerPage(model, { widthPx: 100, minScale: 1 })).toBe(1);
  });

  it("pivotBodyGroups: one range per top-level group plus the grand total", () => {
    const groups = pivotBodyGroups(model);
    expect(groups.map((g) => [g.kind, g.end - g.start])).toEqual([
      ["group", 1],
      ["group", 1],
      ["group", 6],
      ["group", 7],
      ["grandTotal", 1],
    ]);
  });

  it("heat fills match the interactive surface mix", () => {
    expect(mixHexColors("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(pivotHeatFillHex(8)).toBe(mixHexColors("#ef6a24", "#ffffff", 0.82));
    expect(pivotHeatFillHex(0, "dark")).toBe(mixHexColors("#ef6a24", "#171717", 0.07));
  });
});
