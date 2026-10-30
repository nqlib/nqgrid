import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import { planningPivotSpec } from "../../fixtures/planning-pivot-mock";
import { PIVOT_SPEC_JSON_SCHEMA } from "./schema";
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
};

describe("pivot spec contract", () => {
  it("accepts the planning fixture and a minimal spec", () => {
    for (const spec of [planningPivotSpec, minimal]) {
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
