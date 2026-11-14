import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import vectors from "../../../contract/pivot/v1/invalid-specs.json";
import { planningFilteredPivotSpec, planningPivotSpec } from "../../fixtures/planning-pivot-mock";
import { PIVOT_SPEC_JSON_SCHEMA } from "./schema";
import { checkPivotCalculatedMeasure, setPivotMeasureShowAs } from "./measures";
import { assertPivotSpec, validatePivotSpec } from "./validate";

const validateSchema = new Ajv2020({ allErrors: true }).compile(PIVOT_SPEC_JSON_SCHEMA);

const minimal = { version: 1, rows: [{ field: "a" }], measures: [{ id: "m", field: "v" }] };

/** Structurally invalid specs: both the JSON Schema and `validatePivotSpec` must reject them. */
const structurallyInvalid: Record<string, unknown> = {
  "wrong version": { ...minimal, version: 2 },
  "no rows": { ...minimal, rows: [] },
  "row without field": { ...minimal, rows: [{ label: "x" }] },
  "no measures": { ...minimal, measures: [] },
  "measure missing field": { ...minimal, measures: [{ id: "m" }] },
  "bad aggregate": { ...minimal, measures: [{ id: "m", field: "v", aggregate: "median" }] },
  "ratio missing denominator": {
    ...minimal,
    measures: [{ id: "m", aggregate: { type: "ratio", numeratorField: "a" } }],
  },
  "bad showAs": { ...minimal, measures: [{ id: "m", field: "v", showAs: "percentOfEverything" }] },
  "bad expanded": { ...minimal, expanded: [[1]] },
  "bad heat scope": { ...minimal, heat: { scope: "diagonal" } },
  "bad heat levels": { ...minimal, heat: { levels: 1 } },
  "filter without field": { ...minimal, filters: [{ include: ["a"] }] },
  "non-string include": { ...minimal, filters: [{ field: "a", include: [1] }] },
  "bad match op": { ...minimal, filters: [{ field: "a", match: { op: "like", value: "x" } }] },
  "topN count 0": { ...minimal, rows: [{ field: "a", topN: { measure: "m", count: 0 } }] },
  "topN without measure": { ...minimal, rows: [{ field: "a", topN: { count: 3 } }] },
  "bad sortBy direction": { ...minimal, rows: [{ field: "a", sortBy: { measure: "m", direction: "up" } }] },
  "bad facet": { ...minimal, facets: [{ label: "x" }] },
};

describe("pivot spec contract", () => {
  it("accepts the planning fixture and a minimal spec", () => {
    for (const spec of [planningPivotSpec, planningFilteredPivotSpec, minimal]) {
      expect(validateSchema(spec), JSON.stringify(validateSchema.errors)).toBe(true);
      expect(validatePivotSpec(spec)).toMatchObject({ ok: true });
    }
  });

  it.each(Object.entries(structurallyInvalid))("rejects %s in both validators", (_name, spec) => {
    expect(validateSchema(spec)).toBe(false);
    expect(validatePivotSpec(spec).ok).toBe(false);
  });

  it("catches dangling measure references the schema cannot express", () => {
    const spec = {
      ...minimal,
      values: ["nope"],
      heat: { measure: "ghost" },
      headerCharts: { measure: "ghost" },
      kpis: [{ id: "k", measure: "m", compareTo: "ghost" }],
    };
    expect(validateSchema(spec)).toBe(true);
    const result = validatePivotSpec(spec);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toEqual([
      'values[0] references unknown measure "nope"',
      'heat.measure references unknown measure "ghost"',
      'headerCharts.measure references unknown measure "ghost"',
      'kpis[0].compareTo references unknown measure "ghost"',
    ]);
  });

  it("rejects duplicate measure ids", () => {
    const result = validatePivotSpec({ ...minimal, measures: [minimal.measures[0], minimal.measures[0]] });
    expect(!result.ok && result.errors).toEqual(['measures[1].id "m" is duplicated']);
  });

  it("assertPivotSpec throws with all errors", () => {
    expect(() => assertPivotSpec({ version: 1 })).toThrow(/rows must be a non-empty array[\s\S]*measures must be/);
  });
});

/**
 * `contract/pivot/v1/invalid-specs.json` is shared with the Python suite (`test_contract.py`): both
 * validators must reject every invalid spec with the same messages (`errors`, verbatim) or at least at
 * the same paths (`paths`), and accept every valid one.
 */
describe("shared validation vectors (contract/pivot/v1/invalid-specs.json)", () => {
  interface Vector {
    readonly name: string;
    readonly spec: unknown;
    readonly errors?: readonly string[];
    readonly paths?: readonly string[];
    readonly schemaValid?: boolean;
  }
  const at = (error: string, path: string) => error.startsWith(path) && [":", " ", ".", "["].includes(error[path.length] ?? "");
  const invalid = vectors.invalid as readonly Vector[];
  const valid = vectors.valid as readonly Vector[];

  it.each(invalid.map((v) => [v.name, v] as const))("rejects %s", (_name, v) => {
    const result = validatePivotSpec(v.spec);
    expect(result.ok).toBe(false);
    const errors = result.ok ? [] : result.errors;
    for (const e of v.errors ?? []) expect(errors).toContain(e);
    for (const p of v.paths ?? []) expect(errors.some((e) => at(e, p)), `${p} in ${JSON.stringify(errors)}`).toBe(true);
    expect(validateSchema(v.spec)).toBe(v.schemaValid === true);
  });

  it.each(valid.map((v) => [v.name, v] as const))("accepts %s", (_name, v) => {
    expect(validatePivotSpec(v.spec)).toMatchObject({ ok: true });
    expect(validateSchema(v.spec), JSON.stringify(validateSchema.errors)).toBe(true);
  });

  it("has vectors for every unknown-key position the schema forbids", () => {
    expect(invalid.filter((v) => v.errors?.some((e) => e.includes("unknown key(s)"))).length).toBeGreaterThanOrEqual(15);
  });
});

describe("calculated measures over show-as measures", () => {
  const spec = {
    version: 1 as const,
    rows: [{ field: "line" }],
    columns: { field: "month" },
    measures: [
      { id: "act", field: "actual" },
      { id: "bud", field: "budget" },
      { id: "ytd", field: "actual", showAs: "runningTotal" as const, showAsBase: { field: "month" } },
    ],
  };

  it("checkPivotCalculatedMeasure explains the alternative; setPivotMeasureShowAs refuses referenced measures", () => {
    const error = checkPivotCalculatedMeasure(spec, "ytd - bud", "ytdVar");
    expect(error).toMatchObject({ code: "showAs", position: 0 });
    expect(error?.message).toBe(
      'references "ytd", which has showAs "runningTotal"; calculated measures read aggregated values before showAs. Reference the plain measure and put showAs on the calculated measure instead (e.g. calculate "actual - budget" with showAs "runningTotal")',
    );
    const withCalc = { ...spec, measures: [...spec.measures, { id: "var", calculate: "act - bud" }] };
    expect(setPivotMeasureShowAs(withCalc, "act", "percentOfGrandTotal")).toBe(withCalc);
    expect(setPivotMeasureShowAs(withCalc, "act", "percentOfGrandTotal", null, { scope: "group" }).measures[0]).toMatchObject({ groupShowAs: "percentOfGrandTotal" });
    // The supported way: show-as on the calculated measure itself.
    const ytdVar = setPivotMeasureShowAs(withCalc, "var", "runningTotal", { field: "month" });
    expect(validatePivotSpec(ytdVar)).toMatchObject({ ok: true });
  });
});
