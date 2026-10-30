import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import { generatePlanningPivotRows, planningPivotSpec } from "../../fixtures/planning-pivot-mock";
import { buildPivotExportRequest, pivotExportFilename, sanitizePivotExportOptions, type PivotExportOptions } from "./export-request";
import { PIVOT_EXPORT_REQUEST_JSON_SCHEMA, PIVOT_SPEC_JSON_SCHEMA } from "./schema";

const ajv = new Ajv2020({ allErrors: true });
ajv.addSchema(PIVOT_SPEC_JSON_SCHEMA);
const validateRequest = ajv.compile(PIVOT_EXPORT_REQUEST_JSON_SCHEMA);

const dir = "../../../contract/pivot/v1/examples";
const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

/** Same timestamp as the golden `planning.html`. */
const goldenOptions: PivotExportOptions = {
  theme: "light",
  page: { size: "A4", orientation: "landscape" },
  generatedAt: "2026-01-15 09:30 UTC",
};
const golden = buildPivotExportRequest(planningPivotSpec, undefined, { format: "pdf", dataset: "planning-fy26", options: goldenOptions });

describe("pivot export request contract", () => {
  it("golden request (spec + dataset reference)", async () => {
    await expect(json(golden)).toMatchFileSnapshot(`${dir}/planning.request.json`);
    expect(validateRequest(golden), JSON.stringify(validateRequest.errors)).toBe(true);
  });

  it("accepts rows instead of a dataset, every format and the full option set", () => {
    const rows = generatePlanningPivotRows();
    for (const format of ["pdf", "xlsx", "html", "model", "sheet"] as const) {
      const req = buildPivotExportRequest(planningPivotSpec, rows, { format });
      expect(validateRequest(req), JSON.stringify(validateRequest.errors)).toBe(true);
    }
    const full: PivotExportOptions = {
      theme: "dark",
      page: { size: "Letter", orientation: "portrait", margins: { top: 16, right: 10, bottom: 14, left: 10 } },
      title: null,
      subtitle: "Actuals",
      generatedAt: null,
      maxColumnsPerPage: 6,
      minScale: 0.7,
      kpiPanel: false,
      headerFooter: true,
      locale: { lang: "de", page: "Seite", of: "von", continued: "(Forts.)", columns: "Spalten", generated: "Erstellt" },
      table: { dimensionWidths: [184, 152], valueWidth: 76, rowHeight: 36, headRowHeight: 36, chartHeight: 44, headerChart: true, kpiHeadlineId: "growth", kpiCaptionAttribute: "owner" },
    };
    expect(validateRequest({ spec: planningPivotSpec, rows: [], options: full }), JSON.stringify(validateRequest.errors)).toBe(true);
  });

  const invalid: Record<string, unknown> = {
    "neither rows nor dataset": { spec: planningPivotSpec },
    "no spec": { rows: [] },
    "invalid spec": { spec: { ...planningPivotSpec, version: 2 }, rows: [] },
    "unknown format": { spec: planningPivotSpec, rows: [], format: "docx" },
    "raw css": { spec: planningPivotSpec, rows: [], options: { css: "body { display: none }" } },
    "unknown option": { spec: planningPivotSpec, rows: [], options: { html: "<script>" } },
    "bad theme": { spec: planningPivotSpec, rows: [], options: { theme: "sepia" } },
    "bad page size": { spec: planningPivotSpec, rows: [], options: { page: { size: "A5" } } },
    "margin out of range": { spec: planningPivotSpec, rows: [], options: { page: { margins: { top: 120 } } } },
    "zero columns per page": { spec: planningPivotSpec, rows: [], options: { maxColumnsPerPage: 0 } },
    "minScale above 1": { spec: planningPivotSpec, rows: [], options: { minScale: 1.5 } },
    "non-object row": { spec: planningPivotSpec, rows: [1] },
    "empty dataset": { spec: planningPivotSpec, dataset: "" },
    "unknown top-level key": { spec: planningPivotSpec, rows: [], css: "x" },
  };

  it.each(Object.entries(invalid))("rejects %s", (_name, req) => {
    expect(validateRequest(req)).toBe(false);
  });
});

describe("buildPivotExportRequest", () => {
  it("copies the spec as plain JSON and keeps view state", () => {
    const spec = { ...planningPivotSpec, expanded: [["Camp"]] as const, heat: { ...planningPivotSpec.heat, scope: "group" as const } };
    const req = buildPivotExportRequest(spec, [{ department: "Camp" }], { format: "xlsx" });
    expect(req.spec).not.toBe(spec);
    expect(req.spec).toEqual(spec);
    expect(req.spec.expanded).toEqual([["Camp"]]);
    expect(req).toMatchObject({ rows: [{ department: "Camp" }], format: "xlsx" });
    expect(req).not.toHaveProperty("options");
    expect(req).not.toHaveProperty("dataset");
  });

  it("keeps known options only, in a stable order", () => {
    const options = { generatedAt: "now", css: "body{}", theme: "dark", page: { margins: { left: 5, bogus: 1 }, size: "A3" }, title: undefined } as unknown as PivotExportOptions;
    expect(sanitizePivotExportOptions(options)).toEqual({ theme: "dark", page: { size: "A3", margins: { left: 5 } }, generatedAt: "now" });
    expect(Object.keys(sanitizePivotExportOptions(options)!)).toEqual(["theme", "page", "generatedAt"]);
    expect(sanitizePivotExportOptions({})).toBeUndefined();
    expect(buildPivotExportRequest(planningPivotSpec, [], { options: { title: null } }).options).toEqual({ title: null });
  });

  it("rejects an unknown format and a request without data", () => {
    expect(() => buildPivotExportRequest(planningPivotSpec, [], { format: "docx" as never })).toThrow(TypeError);
    expect(() => buildPivotExportRequest(planningPivotSpec, undefined)).toThrow(/rows or a dataset/);
  });

  it("names files like nqgrid-export serve", () => {
    expect(pivotExportFilename(planningPivotSpec, "pdf")).toBe("planning-fy26.pdf");
    expect(pivotExportFilename({ id: "FY 26/plan" }, "sheet")).toBe("FY_26_plan.sheet.json");
    expect(pivotExportFilename({}, "xlsx")).toBe("pivot.xlsx");
  });
});
