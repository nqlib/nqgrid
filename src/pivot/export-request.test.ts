import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import { PIVOT_EXPORT_REQUEST_JSON_SCHEMA, PIVOT_SPEC_JSON_SCHEMA } from "../core/pivot/schema";
import { buildPivotModel } from "../core/pivot/build-model";
import { generatePlanningPivotRows, planningPivotSpec } from "../fixtures/planning-pivot-mock";
import { pivotExportRequestFromGrid } from "./export-request";
import { reducePivotGridSpec } from "./grid-state";

const ajv = new Ajv2020({ allErrors: true });
ajv.addSchema(PIVOT_SPEC_JSON_SCHEMA);
const validateRequest = ajv.compile(PIVOT_EXPORT_REQUEST_JSON_SCHEMA);

const rows = generatePlanningPivotRows();
const model = buildPivotModel(planningPivotSpec, rows);
const grid = { spec: reducePivotGridSpec(planningPivotSpec, model, { type: "setHeatScope", scope: "group" }), rows };

describe("pivotExportRequestFromGrid", () => {
  it("defaults to spec + dataset reference (spec.id), no rows, PDF", () => {
    const req = pivotExportRequestFromGrid(grid, { options: { generatedAt: "2026-01-15 09:30 UTC" } });
    expect(req).toEqual({ spec: grid.spec, dataset: "planning-fy26", format: "pdf", options: { generatedAt: "2026-01-15 09:30 UTC" } });
    expect(req.spec.heat?.scope).toBe("group");
    expect(validateRequest(req), JSON.stringify(validateRequest.errors)).toBe(true);
  });

  it("includeRows sends the grid's rows (what nqgrid-export needs directly)", () => {
    const req = pivotExportRequestFromGrid(grid, { includeRows: true, format: "xlsx" });
    expect(req.rows).toEqual(rows);
    expect(req).not.toHaveProperty("dataset");
    expect(req.format).toBe("xlsx");
    expect(validateRequest(req)).toBe(true);
    expect(pivotExportRequestFromGrid(grid, { includeRows: true, dataset: "sales" }).dataset).toBe("sales");
  });

  it("uses an explicit dataset and drops non-JSON options", () => {
    const req = pivotExportRequestFromGrid(grid, { dataset: "sales/fy26?region=emea", options: { css: "x" } as never });
    expect(req.dataset).toBe("sales/fy26?region=emea");
    expect(req).not.toHaveProperty("options");
  });

  it("needs a dataset reference or rows", () => {
    const { id: _id, ...anonymous } = planningPivotSpec;
    expect(() => pivotExportRequestFromGrid({ spec: anonymous })).toThrow(/dataset reference/);
    expect(() => pivotExportRequestFromGrid({ spec: planningPivotSpec }, { includeRows: true })).toThrow(/grid.rows/);
  });
});
