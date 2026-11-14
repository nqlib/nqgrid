import { describe, expect, it } from "vitest";
import { buildPivotModel, validatePivotSpec } from "@nqlib/nqgrid/core";
import { BIG_DATA_SIZES } from "./big-data-rows";
import { DEFAULT_PIVOT_LINK, LEGACY_PIVOT_ALIASES, LEGACY_PIVOT_IDS, PIVOT_SCENARIOS, resolvePivotLink } from "./registry";
import { badValueFieldOf, injectBadValues } from "./spec-tools";
import { ALL_PIVOT_PANELS } from "./types";

const variants = PIVOT_SCENARIOS.flatMap((scenario) => scenario.variants.map((variant) => ({ scenario, variant })));
// The 250k / 500k big-data variants only differ in size; the 100k one covers their spec.
const buildable = variants.filter(({ variant }) => !/^big-(250|500)k$/.test(variant.id));

describe("pivot showcase registry", () => {
  it("lists ten scenarios with unique ids and unique deep-link ids", () => {
    expect(PIVOT_SCENARIOS).toHaveLength(10);
    const ids = PIVOT_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const linkIds = variants.map(({ variant }) => variant.id);
    expect(new Set(linkIds).size).toBe(linkIds.length);
  });

  it.each(PIVOT_SCENARIOS.map((s) => [s.id, s] as const))("%s: copy, panels and controls are well-formed", (_id, scenario) => {
    expect(scenario.title.length).toBeGreaterThan(3);
    expect(scenario.blurb.length).toBeGreaterThan(20);
    expect(scenario.tryThis.length).toBeGreaterThanOrEqual(2);
    expect(scenario.tryThis.length).toBeLessThanOrEqual(4);
    expect(scenario.variants[0].id).toBe(scenario.id);
    expect(scenario.panels.length).toBeGreaterThan(0);
    for (const panel of scenario.panels) expect(ALL_PIVOT_PANELS).toContain(panel);
    for (const { spec } of scenario.variants) {
      if (scenario.slicers) for (const field of scenario.slicers) expect(spec.facets?.map((f) => (typeof f === "string" ? f : f.field))).toContain(field);
      if (scenario.heatControl) expect(spec.heat).toBeDefined();
      // Diagnostics → "Inject bad values" needs a summed field.
      expect(scenario.badValues?.field ?? badValueFieldOf(spec)).toBeTruthy();
    }
  });

  it.each(buildable.map(({ scenario, variant }) => [`${scenario.id}/${variant.id}`, variant] as const))(
    "%s: the spec validates and builds a model with no diagnostics",
    (_id, variant) => {
      const validation = validatePivotSpec(variant.spec);
      expect(validation.ok ? [] : validation.errors).toEqual([]);
      const rows = variant.rows();
      expect(rows.length).toBeGreaterThan(0);
      const model = buildPivotModel(variant.spec, rows);
      expect(model.rows.length).toBeGreaterThan(0);
      expect(model.columns.length).toBeGreaterThan(0);
      expect(model.diagnostics ?? []).toEqual([]);
    },
    30_000,
  );

  it("offers 100k–500k rows for big data", () => {
    expect(Math.min(...BIG_DATA_SIZES)).toBe(100_000);
    expect(Math.max(...BIG_DATA_SIZES)).toBe(500_000);
  });
});

describe("?pivot= deep links", () => {
  it.each(LEGACY_PIVOT_IDS)("keeps the old preset id %s working", (id) => {
    const target = resolvePivotLink(id);
    expect(target).not.toBeNull();
    expect(target!.variant.id).toBe(id);
  });

  it("maps the old Order date preset to the column hierarchy scenario", () => {
    expect(resolvePivotLink("dates")!.scenario.id).toBe("columns");
  });

  it("resolves aliases, scenario ids and variant ids", () => {
    for (const [alias, id] of Object.entries(LEGACY_PIVOT_ALIASES)) expect(resolvePivotLink(alias)!.scenario.id).toBe(id);
    for (const { scenario, variant } of variants) {
      expect(resolvePivotLink(variant.id)).toEqual({ scenario, variant });
      expect(resolvePivotLink(scenario.id)!.scenario).toBe(scenario);
    }
  });

  it("returns null for unknown or empty ids (the page falls back to the first scenario)", () => {
    expect(resolvePivotLink("nope")).toBeNull();
    expect(resolvePivotLink(null)).toBeNull();
    expect(resolvePivotLink("__proto__")).toBeNull();
    expect(DEFAULT_PIVOT_LINK.scenario).toBe(PIVOT_SCENARIOS[0]);
  });
});

describe("Inject bad values", () => {
  it.each(buildable.map(({ scenario, variant }) => [`${scenario.id}/${variant.id}`, scenario, variant] as const))(
    "%s: injected values surface in model.diagnostics",
    (_id, scenario, variant) => {
      const field = scenario.badValues?.field ?? badValueFieldOf(variant.spec)!;
      const rows = injectBadValues(variant.rows(), field, scenario.badValues?.values);
      const diagnostics = buildPivotModel(variant.spec, rows).diagnostics ?? [];
      expect(diagnostics.some((d) => d.field === field)).toBe(true);
    },
    30_000,
  );
});
