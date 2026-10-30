import type { PivotDataRow, PivotSpec } from "./types";

/**
 * Wire types for an export request (`contract/pivot/v1/export-request.schema.json`): what
 * `nqgrid-export` reads (CLI `--input`, `POST /export`) and what an app sends to a backend that
 * owns the data (`dataset` instead of `rows`). Plain JSON only — no CSS, HTML or functions.
 */

export const PIVOT_EXPORT_FORMATS = ["pdf", "xlsx", "html", "model", "sheet"] as const;
export type PivotExportFormat = (typeof PIVOT_EXPORT_FORMATS)[number];

/** File extension per format (`model` / `sheet` are JSON). */
export const PIVOT_EXPORT_FILE_EXTENSIONS: Readonly<Record<PivotExportFormat, string>> = {
  pdf: "pdf",
  xlsx: "xlsx",
  html: "html",
  model: "model.json",
  sheet: "sheet.json",
};

export const PIVOT_EXPORT_PAGE_SIZES = ["A4", "A3", "Letter", "Legal", "Tabloid"] as const;

export interface PivotExportPageOptions {
  readonly size?: (typeof PIVOT_EXPORT_PAGE_SIZES)[number];
  readonly orientation?: "landscape" | "portrait";
  /** mm. */
  readonly margins?: { readonly top?: number; readonly right?: number; readonly bottom?: number; readonly left?: number };
}

/** `lang` plus printed labels (see `PIVOT_STATIC_LABELS` in `@nqlib/nqgrid/render-static`). */
export interface PivotExportLocale {
  readonly lang?: string;
  readonly generated?: string;
  readonly continued?: string;
  readonly columns?: string;
  readonly of?: string;
  readonly page?: string;
}

export interface PivotExportTableOptions {
  readonly dimensionWidths?: readonly number[];
  readonly valueWidth?: number;
  readonly rowHeight?: number;
  readonly headRowHeight?: number;
  readonly headerChart?: boolean;
  readonly chartHeight?: number;
  readonly kpiHeadlineId?: string;
  readonly kpiCaptionAttribute?: string;
}

/** JSON-safe render options (`renderPivotHtml` options minus `css`, plus the PDF-only `headerFooter`). */
export interface PivotExportOptions {
  readonly theme?: "light" | "dark";
  readonly page?: PivotExportPageOptions;
  /** Default `spec.title`; `null` hides the report header. */
  readonly title?: string | null;
  readonly subtitle?: string | null;
  /** Printed verbatim (the exporter never reads the clock). */
  readonly generatedAt?: string | null;
  readonly maxColumnsPerPage?: number;
  readonly minScale?: number;
  readonly kpiPanel?: boolean;
  /** PDF running header + "Page X of Y" footer (default true). */
  readonly headerFooter?: boolean;
  readonly locale?: PivotExportLocale;
  readonly table?: PivotExportTableOptions;
}

export interface PivotExportRequest {
  readonly spec: PivotSpec;
  /** Leaf-grain rows. Required by `nqgrid-export`; omit when the backend resolves `dataset`. */
  readonly rows?: readonly PivotDataRow[];
  /** Opaque reference to rows the backend owns (ignored by `nqgrid-export`). */
  readonly dataset?: string;
  readonly format?: PivotExportFormat;
  readonly options?: PivotExportOptions;
}

export interface BuildPivotExportRequestOptions {
  readonly format?: PivotExportFormat;
  readonly options?: PivotExportOptions;
  /** Sent instead of (or with) `rows` so the backend can load the data itself. */
  readonly dataset?: string;
}

export function isPivotExportFormat(v: unknown): v is PivotExportFormat {
  return typeof v === "string" && (PIVOT_EXPORT_FORMATS as readonly string[]).includes(v);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Keep only `keys` (in that order), dropping `undefined`; nested objects go through `nested`. */
function pick(input: unknown, keys: readonly string[], nested: Record<string, readonly string[]> = {}): Record<string, unknown> | undefined {
  if (!isObject(input)) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = input[k];
    if (v === undefined) continue;
    const sub = nested[k];
    if (sub) {
      const picked = pick(v, sub, nested);
      if (picked) out[k] = picked;
    } else out[k] = Array.isArray(v) ? [...v] : v;
  }
  return Object.keys(out).length ? out : undefined;
}

const OPTION_KEYS = ["theme", "page", "title", "subtitle", "generatedAt", "maxColumnsPerPage", "minScale", "kpiPanel", "headerFooter", "locale", "table"] as const;
const NESTED_OPTION_KEYS: Record<string, readonly string[]> = {
  page: ["size", "orientation", "margins"],
  margins: ["top", "right", "bottom", "left"],
  locale: ["lang", "generated", "continued", "columns", "of", "page"],
  table: ["dimensionWidths", "valueWidth", "rowHeight", "headRowHeight", "headerChart", "chartHeight", "kpiHeadlineId", "kpiCaptionAttribute"],
};

/**
 * JSON-safe copy of export options: known keys only (so `css` or other strays never cross the
 * wire), `undefined` dropped, stable key order. Value checks are left to the receiver
 * (`nqgrid-export` / the JSON Schema), which reports every problem at once.
 */
export function sanitizePivotExportOptions(options: PivotExportOptions | undefined): PivotExportOptions | undefined {
  return pick(options, OPTION_KEYS, NESTED_OPTION_KEYS) as PivotExportOptions | undefined;
}

/**
 * Build a `PivotExportRequest` (pure). Pass `rows` for `nqgrid-export`, or `undefined` plus
 * `dataset` when the backend owns the data (the usual Tauri → Python backend case). The spec is
 * copied as plain JSON, so view state (`expanded`, `heat.scope`, …) is exported as on screen.
 *
 * Throws `TypeError` for an unknown `format` or when neither `rows` nor `dataset` is given.
 */
export function buildPivotExportRequest(
  spec: PivotSpec,
  rows: readonly PivotDataRow[] | undefined,
  { format, options, dataset }: BuildPivotExportRequestOptions = {},
): PivotExportRequest {
  if (format !== undefined && !isPivotExportFormat(format)) {
    throw new TypeError(`format must be one of ${PIVOT_EXPORT_FORMATS.join(", ")} (got ${JSON.stringify(format)})`);
  }
  if (rows === undefined && !dataset) throw new TypeError("pass rows or a dataset reference");
  const opts = sanitizePivotExportOptions(options);
  return {
    spec: JSON.parse(JSON.stringify(spec)) as PivotSpec,
    ...(rows !== undefined ? { rows: [...rows] } : {}),
    ...(dataset ? { dataset } : {}),
    ...(format !== undefined ? { format } : {}),
    ...(opts ? { options: opts } : {}),
  };
}

/** `<spec.id>.<ext>` (same name `nqgrid-export serve` puts in `Content-Disposition`). */
export function pivotExportFilename(spec: Pick<PivotSpec, "id">, format: PivotExportFormat): string {
  return `${(spec.id ?? "pivot").replace(/[^\w.-]+/g, "_")}.${PIVOT_EXPORT_FILE_EXTENSIONS[format]}`;
}
