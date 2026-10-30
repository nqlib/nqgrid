import { validatePivotSpec, type PivotDataRow, type PivotSpec } from "@nqlib/nqgrid/core";
import { PIVOT_PAGE_SIZES_MM, type RenderPivotHtmlOptions } from "@nqlib/nqgrid/render-static";

import { invalidInput } from "./errors";

export const PIVOT_EXPORT_FORMATS = ["pdf", "xlsx", "html", "model", "sheet"] as const;
export type PivotExportFormat = (typeof PIVOT_EXPORT_FORMATS)[number];

/** JSON-safe render options accepted over the wire (`renderPivotHtml` options minus `css`). */
export type PivotExportOptions = Omit<RenderPivotHtmlOptions, "css" | "generatedAt"> & {
  /** Printed verbatim (pass the timestamp in; the exporter never reads the clock). */
  readonly generatedAt?: string | null;
  /** PDF: print the running header (title) and footer (generated · page X of Y). Default true. */
  readonly headerFooter?: boolean;
};

/** What the CLI reads (`--input`) and serve mode accepts (`POST /export`). */
export interface PivotExportRequest {
  readonly spec: PivotSpec;
  readonly rows: readonly PivotDataRow[];
  readonly options?: PivotExportOptions;
  /** Optional; the CLI `--format` flag or `?format=` query parameter wins. */
  readonly format?: PivotExportFormat;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function isPivotExportFormat(v: unknown): v is PivotExportFormat {
  return typeof v === "string" && (PIVOT_EXPORT_FORMATS as readonly string[]).includes(v);
}

function validateOptions(input: unknown, errors: string[]): PivotExportOptions | undefined {
  if (input === undefined || input === null) return undefined;
  if (!isObject(input)) {
    errors.push("options must be an object");
    return undefined;
  }
  const o = input;
  const check = (ok: boolean, message: string) => {
    if (!ok) errors.push(message);
  };
  const optionalString = (v: unknown) => v === undefined || v === null || typeof v === "string";
  check(o.theme === undefined || o.theme === "light" || o.theme === "dark", 'options.theme must be "light" | "dark"');
  check(optionalString(o.title), "options.title must be a string or null");
  check(optionalString(o.subtitle), "options.subtitle must be a string or null");
  check(optionalString(o.generatedAt), "options.generatedAt must be a string (pass the timestamp in)");
  check(
    o.maxColumnsPerPage === undefined || (Number.isInteger(o.maxColumnsPerPage) && (o.maxColumnsPerPage as number) > 0),
    "options.maxColumnsPerPage must be a positive integer",
  );
  check(
    o.minScale === undefined || (typeof o.minScale === "number" && o.minScale > 0 && o.minScale <= 1),
    "options.minScale must be a number in (0, 1]",
  );
  check(o.kpiPanel === undefined || typeof o.kpiPanel === "boolean", "options.kpiPanel must be a boolean");
  check(o.headerFooter === undefined || typeof o.headerFooter === "boolean", "options.headerFooter must be a boolean");
  if (o.page !== undefined) {
    if (!isObject(o.page)) errors.push("options.page must be an object");
    else {
      const p = o.page;
      check(p.size === undefined || (typeof p.size === "string" && p.size in PIVOT_PAGE_SIZES_MM), `options.page.size must be one of ${Object.keys(PIVOT_PAGE_SIZES_MM).join(", ")}`);
      check(p.orientation === undefined || p.orientation === "landscape" || p.orientation === "portrait", 'options.page.orientation must be "landscape" | "portrait"');
      if (p.margins !== undefined) {
        if (!isObject(p.margins)) errors.push("options.page.margins must be an object (mm)");
        else
          for (const [k, v] of Object.entries(p.margins)) {
            check(["top", "right", "bottom", "left"].includes(k) && typeof v === "number" && v >= 0 && v < 100, `options.page.margins.${k} must be a number of mm (0–100)`);
          }
      }
    }
  }
  if (o.locale !== undefined) {
    if (!isObject(o.locale) || !Object.values(o.locale).every((v) => typeof v === "string")) errors.push("options.locale must be an object of strings");
  }
  if (o.table !== undefined) {
    if (!isObject(o.table)) errors.push("options.table must be an object");
    else {
      const t = o.table;
      const positive = (v: unknown) => v === undefined || (typeof v === "number" && v > 0);
      check(t.dimensionWidths === undefined || (Array.isArray(t.dimensionWidths) && t.dimensionWidths.every((w) => typeof w === "number" && w > 0)), "options.table.dimensionWidths must be an array of positive numbers");
      for (const k of ["valueWidth", "rowHeight", "headRowHeight", "chartHeight"] as const) check(positive(t[k]), `options.table.${k} must be a positive number`);
      check(t.headerChart === undefined || typeof t.headerChart === "boolean", "options.table.headerChart must be a boolean");
      for (const k of ["kpiHeadlineId", "kpiCaptionAttribute"] as const) check(t[k] === undefined || typeof t[k] === "string", `options.table.${k} must be a string`);
    }
  }
  if ("css" in o) errors.push("options.css is not accepted by nqgrid-export (the stylesheet is built in)");
  return o as PivotExportOptions;
}

/**
 * Validate an export request from JSON (CLI file / stdin or HTTP body). Throws a
 * `PivotExportError` (`invalid_input`) listing every problem.
 */
export function parsePivotExportRequest(input: unknown, format?: unknown): PivotExportRequest & { readonly format: PivotExportFormat } {
  if (!isObject(input)) throw invalidInput("request must be a JSON object { spec, rows, options? }");
  const errors: string[] = [];
  const resolvedFormat = format ?? input.format;
  if (!isPivotExportFormat(resolvedFormat)) errors.push(`format must be one of ${PIVOT_EXPORT_FORMATS.join(", ")} (got ${JSON.stringify(resolvedFormat ?? null)})`);

  const spec = validatePivotSpec(input.spec);
  if (!spec.ok) errors.push(...spec.errors.map((e) => `spec: ${e}`));
  else {
    spec.spec.measures.forEach((m, i) => {
      if (typeof m.aggregate === "object" && m.aggregate.type === "custom") {
        errors.push(`spec: measures[${i}] uses custom aggregator "${m.aggregate.name}", which is not available in nqgrid-export`);
      }
    });
  }

  if (!Array.isArray(input.rows)) errors.push("rows must be an array of objects");
  else {
    const bad = input.rows.findIndex((r) => !isObject(r));
    if (bad >= 0) errors.push(`rows[${bad}] must be an object`);
  }
  const options = validateOptions(input.options, errors);
  if (errors.length) throw invalidInput("invalid export request", errors);
  return {
    spec: (spec as { spec: PivotSpec }).spec,
    rows: input.rows as PivotDataRow[],
    format: resolvedFormat as PivotExportFormat,
    ...(options ? { options } : {}),
  };
}
