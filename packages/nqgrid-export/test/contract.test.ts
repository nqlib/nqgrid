import Ajv2020 from "ajv/dist/2020";
import {
  PIVOT_EXPORT_REQUEST_JSON_SCHEMA,
  PIVOT_SPEC_JSON_SCHEMA,
  type PivotExportOptions as WireOptions,
  type PivotExportRequest as WireRequest,
} from "@nqlib/nqgrid/core";
import { describe, expect, expectTypeOf, it } from "vitest";

import { parsePivotExportRequest, type PivotExportOptions, type PivotExportRequest } from "../src/request";
import { planningRows, planningSpec, readExample } from "./helpers";

const ajv = new Ajv2020({ allErrors: true });
ajv.addSchema(PIVOT_SPEC_JSON_SCHEMA);
const validateRequest = ajv.compile(PIVOT_EXPORT_REQUEST_JSON_SCHEMA);

/** `contract/pivot/v1/examples/planning.request.json` references its rows; a backend fills them in. */
const golden = JSON.parse(readExample("planning.request.json")) as WireRequest;
const withRows = { ...golden, rows: planningRows };

const accepts = (req: unknown) => {
  try {
    parsePivotExportRequest(req);
    return true;
  } catch {
    return false;
  }
};

describe("export-request.schema.json ↔ parsePivotExportRequest", () => {
  it("wire options are accepted by the CLI types", () => {
    expectTypeOf<WireOptions>().toMatchTypeOf<PivotExportOptions>();
    expectTypeOf<PivotExportRequest>().toMatchTypeOf<WireRequest>();
  });

  it("the golden request validates and, with rows, is a valid nqgrid-export request", () => {
    expect(validateRequest(golden), JSON.stringify(validateRequest.errors)).toBe(true);
    expect(validateRequest(withRows)).toBe(true);
    const req = parsePivotExportRequest(withRows);
    expect(req.format).toBe("pdf");
    expect(req.options).toEqual(golden.options);
    expect(accepts(golden)).toBe(false); // nqgrid-export needs rows; dataset is for the backend
  });

  const rejectedByBoth: Record<string, unknown> = {
    "raw css": { options: { css: "body{}" } },
    "bad theme": { options: { theme: "sepia" } },
    "bad page size": { options: { page: { size: "A5" } } },
    "bad orientation": { options: { page: { orientation: "sideways" } } },
    "margin out of range": { options: { page: { margins: { top: 100 } } } },
    "zero columns per page": { options: { maxColumnsPerPage: 0 } },
    "fractional columns per page": { options: { maxColumnsPerPage: 2.5 } },
    "minScale 0": { options: { minScale: 0 } },
    "kpiPanel not boolean": { options: { kpiPanel: "yes" } },
    "headerFooter not boolean": { options: { headerFooter: 1 } },
    "numeric generatedAt": { options: { generatedAt: 1700000000 } },
    "bad locale value": { options: { locale: { lang: 1 } } },
    "negative valueWidth": { options: { table: { valueWidth: -1 } } },
    "bad dimensionWidths": { options: { table: { dimensionWidths: [0] } } },
    "unknown format": { format: "docx" },
    "invalid spec": { spec: { ...planningSpec, version: 2 } },
    "non-object row": { rows: [1] },
  };

  it.each(Object.entries(rejectedByBoth))("both reject %s", (_name, patch) => {
    const req = { ...withRows, ...(patch as object) };
    expect(validateRequest(req)).toBe(false);
    expect(accepts(req)).toBe(false);
  });
});
