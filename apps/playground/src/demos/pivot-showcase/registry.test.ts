import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildPivotModel, validatePivotSpec } from "@nqlib/nqgrid/core";
import { BIG_DATA_SIZES } from "./big-data-rows";
import { DOCS, docsUrl, githubSlug } from "./docs";
import { withCurrencyScale } from "./examples/finance";
import { DEFAULT_PIVOT_LINK, LEGACY_PIVOT_ALIASES, PIVOT_EXAMPLES, resolvePivotLink } from "./registry";
import { badValueFieldOf, injectBadValues } from "./spec-tools";
import { ALL_PIVOT_PANELS } from "./types";

const views = PIVOT_EXAMPLES.flatMap((example) => example.views.map((view) => ({ example, view })));
// The 250k / 500k scale views only differ in size; the 100k one covers their spec.
const buildable = views.filter(({ view }) => !/^scale-(250|500)k$/.test(view.id));
const DOCS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../docs");

describe("pivot showcase registry", () => {
  it("keeps the showcase to three examples with unique ids and deep-link ids", () => {
    expect(PIVOT_EXAMPLES.map((e) => e.id)).toEqual(["sales", "finance", "scale"]);
    const ids = views.map(({ view }) => view.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(PIVOT_EXAMPLES.map((e) => [e.id, e] as const))("%s: copy, features, panels and controls are well-formed", (_id, example) => {
    expect(example.blurb.length).toBeGreaterThan(20);
    expect(example.features.length).toBeGreaterThan(0);
    expect(example.views[0].id).toBe(example.id);
    for (const panel of example.panels) expect(ALL_PIVOT_PANELS).toContain(panel);
    for (const view of example.views) {
      expect(view.tryThis.length).toBeGreaterThanOrEqual(2);
      expect(view.tryThis.length).toBeLessThanOrEqual(4);
      if (example.slicers) for (const field of example.slicers) expect(view.spec.facets?.map((f) => (typeof f === "string" ? f : f.field))).toContain(field);
      if (example.heatControl) expect(view.spec.heat).toBeDefined();
      expect(example.badValues?.[view.id]?.field ?? badValueFieldOf(view.spec)).toBeTruthy();
    }
  });

  it.each(buildable.map(({ example, view }) => [`${example.id}/${view.id}`, view] as const))(
    "%s: the spec validates and builds a model with no diagnostics",
    (_id, view) => {
      const validation = validatePivotSpec(view.spec);
      expect(validation.ok ? [] : validation.errors).toEqual([]);
      const model = buildPivotModel(view.spec, view.rows());
      expect(model.rows.length).toBeGreaterThan(0);
      expect(model.columns.length).toBeGreaterThan(0);
      expect(model.diagnostics ?? []).toEqual([]);
    },
    30_000,
  );

  it.each(buildable.map(({ example, view }) => [`${example.id}/${view.id}`, example, view] as const))(
    "%s: injected bad values surface in model.diagnostics",
    (_id, example, view) => {
      const bad = example.badValues?.[view.id];
      const field = bad?.field ?? badValueFieldOf(view.spec)!;
      const diagnostics = buildPivotModel(view.spec, injectBadValues(view.rows(), field, bad?.values)).diagnostics ?? [];
      expect(diagnostics.some((d) => d.field === field)).toBe(true);
    },
    30_000,
  );

  it("income statement: calculated items and Operating income add up on the shared ledger", () => {
    const view = resolvePivotLink("income")!.view;
    const model = buildPivotModel(view.spec, view.rows());
    const label = (l: string) => model.rows.find((r) => r.label === l);
    expect(label("Gross margin")?.kind).toBe("calculated");
    expect(label("EBITDA")?.kind).toBe("calculated");
    const total = (l: string) => label(l)!.cells.at(-2)!.value as number;
    expect(total("EBITDA")).toBeCloseTo(total("Operating income"));
  });

  it("Amounts in rescales every currency measure and keeps the spec valid", () => {
    const view = resolvePivotLink("finance")!.view;
    for (const scale of ["1", "1000", "1000000"] as const) {
      const next = withCurrencyScale(view.spec, scale);
      expect(validatePivotSpec(next).ok).toBe(true);
    }
    expect(withCurrencyScale(view.spec, "1000000").units).toBe("USD millions");
  });

  it("offers 100k–500k rows at scale", () => {
    expect(Math.min(...BIG_DATA_SIZES)).toBe(100_000);
    expect(Math.max(...BIG_DATA_SIZES)).toBe(500_000);
  });
});

describe("docs links", () => {
  it("builds GitHub anchors", () => {
    expect(githubSlug("Filters, slicers & sorting (Excel parity)")).toBe("filters-slicers--sorting-excel-parity");
    expect(githubSlug("Scaling (`format.scale`) and units")).toBe("scaling-formatscale-and-units");
  });

  it.each(Object.entries(DOCS))("%s points at a heading that exists", (_key, ref) => {
    const text = readFileSync(path.join(DOCS_DIR, ref.file), "utf8");
    const headings = text.split("\n").filter((l) => /^#{1,6} /.test(l)).map((l) => l.replace(/^#+ /, "").trim());
    expect(headings).toContain(ref.heading);
    expect(docsUrl(ref)).toMatch(new RegExp(`/docs/${ref.file}#`));
  });
});

describe("?pivot= deep links", () => {
  it.each(["planning", "dates", "calc", "statement", "income", "fpa", "balance", "filter", "fields", "columns", "big"])("keeps %s working", (id) => {
    expect(resolvePivotLink(id)).not.toBeNull();
  });

  it("sends old presets to the example that now covers them", () => {
    expect(resolvePivotLink("dates")!.example.id).toBe("sales");
    expect(resolvePivotLink("calc")!.example.id).toBe("sales");
    expect(resolvePivotLink("statement")!.view.id).toBe("income");
    expect(resolvePivotLink("fpa")!.view.id).toBe("finance");
    expect(resolvePivotLink("balance")!.view.id).toBe("balance");
    expect(resolvePivotLink("big-500k")!.view.id).toBe("scale-500k");
  });

  it("resolves every alias, example id and view id", () => {
    for (const [alias, id] of Object.entries(LEGACY_PIVOT_ALIASES)) expect(resolvePivotLink(alias)).toEqual(resolvePivotLink(id));
    for (const { example, view } of views) {
      expect(resolvePivotLink(view.id)).toEqual({ example, view });
      expect(resolvePivotLink(example.id)!.example).toBe(example);
    }
  });

  it("returns null for unknown ids (the page falls back to the first example)", () => {
    expect(resolvePivotLink("nope")).toBeNull();
    expect(resolvePivotLink(null)).toBeNull();
    expect(resolvePivotLink("__proto__")).toBeNull();
    expect(resolvePivotLink("constructor")).toBeNull();
    expect(DEFAULT_PIVOT_LINK.example).toBe(PIVOT_EXAMPLES[0]);
  });
});
