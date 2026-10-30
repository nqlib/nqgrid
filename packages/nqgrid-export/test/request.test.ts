import { describe, expect, it } from "vitest";

import { PivotExportError } from "../src/errors";
import { parsePivotExportRequest } from "../src/request";
import { planningRows, planningSpec } from "./helpers";

const fail = (input: unknown, format?: unknown): PivotExportError => {
  try {
    parsePivotExportRequest(input, format);
  } catch (error) {
    return error as PivotExportError;
  }
  throw new Error("expected parsePivotExportRequest to throw");
};

describe("parsePivotExportRequest", () => {
  it("accepts { spec, rows, options } with the format from the flag or the body", () => {
    const req = parsePivotExportRequest({ spec: planningSpec, rows: planningRows, options: { theme: "dark", page: { size: "Letter" } } }, "pdf");
    expect(req.format).toBe("pdf");
    expect(req.options?.theme).toBe("dark");
    expect(parsePivotExportRequest({ spec: planningSpec, rows: [], format: "xlsx" }).format).toBe("xlsx");
  });

  it("collects every problem as invalid_input (exit 2 / HTTP 400)", () => {
    const e = fail({ spec: { ...planningSpec, version: 2, values: ["nope"] }, rows: [1], options: { theme: "sepia", maxColumnsPerPage: 0, css: "x" } }, "docx");
    expect(e).toBeInstanceOf(PivotExportError);
    expect([e.code, e.exitCode, e.status]).toEqual(["invalid_input", 2, 400]);
    expect(e.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining("format must be one of pdf, xlsx, html, model, sheet"),
        "spec: version must be 1 (got 2)",
        expect.stringContaining('references unknown measure "nope"'),
        "rows[0] must be an object",
        'options.theme must be "light" | "dark"',
        "options.maxColumnsPerPage must be a positive integer",
        expect.stringContaining("options.css is not accepted"),
      ]),
    );
    expect(e.toJSON().error.code).toBe("invalid_input");
  });

  it("rejects non-objects, custom aggregators and bad page options", () => {
    expect(fail([]).message).toContain("request must be a JSON object");
    const custom = { ...planningSpec, measures: [...planningSpec.measures, { id: "x", aggregate: { type: "custom", name: "median" } }] };
    expect(fail({ spec: custom, rows: [] }, "html").details[0]).toContain('custom aggregator "median"');
    const page = fail({ spec: planningSpec, rows: [], options: { page: { size: "B5", margins: { top: -1 } } } }, "pdf");
    expect(page.details).toEqual([expect.stringContaining("options.page.size must be one of A4, A3, Letter"), expect.stringContaining("options.page.margins.top")]);
  });
});
