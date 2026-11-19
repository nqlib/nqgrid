import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import * as core from "../core";
import { buildPivotModel } from "../core/pivot/build-model";
import { isPivotHeatPalette, isPivotToneKey, pivotHeatPaletteColor, pivotToneVar } from "../core/pivot/heat";
import type { PivotHeatSpec, PivotSpec } from "../core/pivot/types";
import { validatePivotSpec } from "../core/pivot/validate";
import { generatePlanningPivotRows, planningPivotSpec } from "../fixtures/planning-pivot-mock";
import * as pivot from "./index";
import { pivotCellDesigns } from "./design";
import { pivotTableGeometry } from "./layout";
import { PivotTable, type PivotTableProps } from "./pivot-table";

/**
 * The four style slots a host such as secolab fills from its stored chart style, with keys only
 * (no CSS, no hex): a width per value column, data bars, a tone for one cell (a rule color) and a
 * heat palette of 2 or 3 tone keys around a middle value.
 */
const rows = generatePlanningPivotRows();
const spec: PivotSpec = { ...planningPivotSpec, values: ["actual", "plan", "growth"], heat: null };
const model = buildPivotModel(spec, rows);
const html = (props: Partial<PivotTableProps>) => renderToStaticMarkup(createElement(PivotTable, { model, mode: "static", ...props }));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const leafCount = model.rows.filter((r) => r.kind === "leaf").length;
const months = model.columns.filter((c) => c.measureId === "plan").length;

describe("slot 1: a width for each value column", () => {
  it("measureWidths sets every column of a measure; a valueWidths entry (by column key) wins", () => {
    const out = html({ valueWidth: 90, measureWidths: { plan: 130 }, valueWidths: { "c:Nov:plan": 150 } });
    expect(count(out, /<col style="width:130px"\/>/g)).toBe(months - 1);
    expect(count(out, /<col style="width:150px"\/>/g)).toBe(1);
    expect(count(out, /<col style="width:90px"\/>/g)).toBe(model.columns.length - months);
  });
});

describe("slot 2: data bars for a column", () => {
  it("bars draw on the leaf rows of one measure only, with the host's bar variable", () => {
    const out = html({ bars: [{ measure: "plan" }], dataAttributes: true });
    expect(count(out, /data-nq-bar=""/g)).toBe(leafCount * months);
    expect(out).toContain("background-color:var(--nq-pivot-bar)");
    expect(out).not.toMatch(/data-nq-measure="actual"[^>]*><span aria-hidden="true" data-nq-bar/);
  });
});

describe("slot 3: a tone for one cell (cellTone)", () => {
  const negative: PivotTableProps["cellTone"] = (ctx) => (ctx.row.kind === "leaf" && ctx.cell.value !== null && ctx.cell.value < 0 ? "bad" : undefined);
  const negatives = model.rows.filter((r) => r.kind === "leaf").flatMap((r) => r.cells).filter((c) => c.value !== null && c.value < 0).length;

  it("tones the cells the host picks: data-nq-tone and the tone variable as background", () => {
    expect(negatives).toBeGreaterThan(0);
    const out = html({ cellTone: negative });
    expect(count(out, /data-nq-tone="bad"/g)).toBe(negatives);
    expect(count(out, /background-color:var\(--nq-pivot-tone-bad\)/g)).toBe(negatives);
  });

  it("a toned cell draws no heat (the rule wins); its data bar stays", () => {
    const heat: PivotHeatSpec = { measure: "growth", scale: "diverging" };
    const plain = html({ heat, bars: [{ measure: "growth" }] });
    const toned = html({ heat, bars: [{ measure: "growth" }], cellTone: negative });
    const growthNegatives = model.rows
      .filter((r) => r.kind === "leaf")
      .flatMap((r) => r.cells.filter((_, i) => model.columns[i]!.measureId === "growth"))
      .filter((c) => c.value !== null && c.value < 0).length;
    expect(growthNegatives).toBeGreaterThan(0);
    expect(count(toned, /data-nq-heat=/g)).toBe(count(plain, /data-nq-heat=/g) - growthNegatives);
    expect(count(toned, /data-nq-bar=""/g)).toBe(count(plain, /data-nq-bar=""/g));
    expect(toned).toMatch(/style="background-color:var\(--nq-pivot-tone-bad\);position:relative;z-index:0" data-nq-tone="bad"><span aria-hidden="true" data-nq-bar=""/);
  });

  it("cellTone and cellClassName work together on one cell", () => {
    const out = html({ cellTone: () => "info", cellClassName: () => "host-class" });
    expect(count(out, /host-class" style="background-color:var\(--nq-pivot-tone-info\)" data-nq-tone="info"/g)).toBe(model.rows.length * model.columns.length);
  });

  it("an invalid key is ignored, so a key can never carry CSS", () => {
    const out = html({ cellTone: () => "red; background-image: url(x)" });
    expect(out).toBe(html({}));
    expect(isPivotToneKey("good")).toBe(true);
    expect(isPivotToneKey("heat-4")).toBe(true);
    for (const bad of ["", "4x", "a b", "a)", "#ff0000", "a".repeat(65), 7, null]) expect(isPivotToneKey(bad)).toBe(false);
    expect(pivotToneVar("good")).toBe("var(--nq-pivot-tone-good)");
    expect(pivotToneVar("x;y")).toBeUndefined();
  });
});

describe("slot 4: a heat palette of the host's tone keys (2 or 3 stops, a middle value)", () => {
  it("pivotHeatPaletteColor: stops on steps 0 / 4 / 8, oklab mixes between them", () => {
    const three = ["good", "plain", "bad"] as const;
    expect(pivotHeatPaletteColor(three, 0)).toBe("var(--nq-pivot-tone-good)");
    expect(pivotHeatPaletteColor(three, 4)).toBe("var(--nq-pivot-tone-plain)");
    expect(pivotHeatPaletteColor(three, 8)).toBe("var(--nq-pivot-tone-bad)");
    expect(pivotHeatPaletteColor(three, 1)).toBe("color-mix(in oklab, var(--nq-pivot-tone-good) 75%, var(--nq-pivot-tone-plain))");
    expect(pivotHeatPaletteColor(three, 6)).toBe("color-mix(in oklab, var(--nq-pivot-tone-plain) 50%, var(--nq-pivot-tone-bad))");
    const two = ["plain", "heat"] as const;
    expect(pivotHeatPaletteColor(two, 0)).toBe("var(--nq-pivot-tone-plain)");
    expect(pivotHeatPaletteColor(two, 2)).toBe("color-mix(in oklab, var(--nq-pivot-tone-plain) 75%, var(--nq-pivot-tone-heat))");
    expect(pivotHeatPaletteColor(two, 8)).toBe("var(--nq-pivot-tone-heat)");
    expect(pivotHeatPaletteColor(["a;b", "c"] as unknown as readonly [string, string], 0)).toBeUndefined();
  });

  it("a diverging spec with a 3-stop palette puts the midpoint on the middle key", () => {
    const midpoint = 0.05;
    const out = html({ heat: { measure: "growth", scale: "diverging", midpoint, palette: ["good", "plain", "bad"] } });
    expect(out).toMatch(/style="background-color:var\(--nq-pivot-tone-good\)" data-nq-heat="0" data-nq-heat-scale="diverging"/);
    expect(out).toMatch(/style="background-color:color-mix\(in oklab, var\(--nq-pivot-tone-plain\) 75%, var\(--nq-pivot-tone-bad\)\)" data-nq-heat="5"/);
    expect(out).not.toContain("--nq-pivot-heat-");
    const designs = pivotCellDesigns(model, { heat: { measure: "growth", scale: "diverging", midpoint, palette: ["good", "plain", "bad"] } });
    model.rows.forEach((row, r) =>
      row.cells.forEach((cell, c) => {
        const h = designs[r]?.[c]?.heat;
        if (!h || cell.value === null) return;
        expect(h.palette).toEqual(["good", "plain", "bad"]);
        expect(Math.sign(h.step - 4)).toBe(Math.sign(cell.value - midpoint));
      }),
    );
  });

  it("a sequential spec with a 2-stop palette; specs without a palette keep the grid's ramp", () => {
    const out = html({ heat: [{ measure: "actual", palette: ["plain", "heat"] }, { measure: "plan" }] });
    expect(out).toContain("background-color:var(--nq-pivot-tone-plain)");
    expect(out).toContain("background-color:var(--nq-pivot-tone-heat)");
    expect(out).toMatch(/background-color:var\(--nq-pivot-heat-\d\)/);
  });

  it("spec.heat takes a palette too: validated, kept on model.heat, drawn and exported", () => {
    const withPalette: PivotSpec = { ...spec, heat: { measure: "growth", scale: "diverging", palette: ["good", "plain", "bad"] } };
    expect(validatePivotSpec(withPalette)).toMatchObject({ ok: true });
    expect(validatePivotSpec({ ...spec, heat: { palette: ["good"] } }).ok).toBe(false);
    expect(validatePivotSpec({ ...spec, heat: { palette: ["good", "#fff", "bad"] } }).ok).toBe(false);
    expect(isPivotHeatPalette(["a", "b", "c", "d"])).toBe(false);
    const m = buildPivotModel(withPalette, rows);
    expect(m.heat?.palette).toEqual(["good", "plain", "bad"]);
    const out = renderToStaticMarkup(createElement(PivotTable, { model: m, mode: "static" }));
    expect(out).toMatch(/style="background-color:(var|color-mix)\([^"]*--nq-pivot-tone-(good|plain|bad)[^"]*" data-nq-heat="\d" data-nq-heat-scale="diverging"/);
    expect(out).not.toMatch(/nqg-heat-\d|--nq-pivot-heat-/);
    const g = pivotTableGeometry(m, { bars: [] });
    expect(g.cells!.flat().find((x) => x?.heat)?.heat?.palette).toEqual(["good", "plain", "bad"]);
  });

  it("a sequential spec.heat with no palette keeps the 0.4.0 heat classes", () => {
    const m = buildPivotModel({ ...spec, heat: { measure: "actual" } }, rows);
    expect(m.heat).not.toHaveProperty("palette");
    expect(renderToStaticMarkup(createElement(PivotTable, { model: m, mode: "static" }))).toMatch(/nqg-heat-\d/);
  });
});

describe("cellTone in pivotTableGeometry (export)", () => {
  const negative = (ctx: { row: { kind: string }; cell: { value: number | null } }) =>
    ctx.row.kind === "leaf" && ctx.cell.value !== null && ctx.cell.value < 0 ? "bad" : undefined;

  it("a toned cell reports tone and no heat; its bar stays; other cells keep their heat", () => {
    const heat: PivotHeatSpec = { measure: "growth", scale: "diverging" };
    const plain = pivotTableGeometry(model, { heat, bars: [{ measure: "growth" }] }).cells!;
    const toned = pivotTableGeometry(model, { heat, bars: [{ measure: "growth" }], cellTone: negative }).cells!;
    let tonedCells = 0;
    model.rows.forEach((row, r) =>
      row.cells.forEach((cell, c) => {
        const key = negative({ row, cell });
        if (key) {
          tonedCells++;
          expect(toned[r]?.[c]?.tone).toBe("bad");
          expect(toned[r]?.[c]?.heat).toBeUndefined();
          expect(toned[r]?.[c]?.bar).toEqual(plain[r]?.[c]?.bar);
        } else {
          expect(toned[r]?.[c]).toEqual(plain[r]?.[c]);
        }
      }),
    );
    expect(tonedCells).toBeGreaterThan(0);
  });

  it("matches what PivotTable draws, also for the model's own heat; an invalid key reports nothing", () => {
    const m = buildPivotModel({ ...spec, heat: { measure: "growth", scale: "diverging", palette: ["good", "plain", "bad"] } }, rows);
    const cells = pivotTableGeometry(m, { cellTone: negative }).cells!;
    const out = renderToStaticMarkup(createElement(PivotTable, { model: m, mode: "static", cellTone: negative }));
    const flat = cells.flat();
    expect(count(out, /data-nq-tone="bad"/g)).toBe(flat.filter((x) => x?.tone === "bad").length);
    expect(count(out, /data-nq-heat=/g)).toBe(flat.filter((x) => x?.heat).length);
    expect(pivotTableGeometry(model, { cellTone: () => "a;b" }).cells!.flat().some((x) => x?.tone)).toBe(false);
  });
});

describe("entry points", () => {
  it("the palette and tone helpers are in /core (for a Node print bridge) and re-exported from /pivot", () => {
    for (const name of ["pivotHeatPaletteColor", "pivotHeatPaletteStep", "pivotToneVar", "isPivotToneKey", "isPivotHeatPalette"] as const) {
      expect(typeof core[name]).toBe("function");
      expect(pivot[name]).toBe(core[name]);
    }
  });

  it("an invalid palette: buildPivotModel rejects it, and drops it with validate: false", () => {
    const bad = { ...spec, heat: { measure: "growth", palette: ["good", "#fff"] as unknown as readonly [string, string] } };
    expect(() => buildPivotModel(bad, rows)).toThrow(/heat\.palette/);
    const m = buildPivotModel(bad, rows, { validate: false });
    expect(m.heat).not.toHaveProperty("palette");
    expect(renderToStaticMarkup(createElement(PivotTable, { model: { ...m, heat: { ...m.heat!, palette: bad.heat.palette } }, mode: "static" }))).not.toContain("--nq-pivot-tone-");
  });
});

describe("the default render is unchanged", () => {
  it("cellTone that returns nothing and heat specs without a palette print the same markup", () => {
    const heat: PivotHeatSpec[] = [{ measure: "actual" }, { measure: "growth", scale: "diverging" }];
    expect(html({ cellTone: () => undefined })).toBe(html({}));
    expect(html({ heat, cellTone: () => undefined, cellClassName: () => "x" })).toBe(html({ heat, cellClassName: () => "x" }));
    expect(html({})).not.toMatch(/data-nq-tone|--nq-pivot-tone-/);
  });
});
