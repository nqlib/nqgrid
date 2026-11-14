import { buildPivotModel, pivotModelToSheet, type PivotDataRow, type PivotDiagnostic, type PivotSpec } from "@nqlib/nqgrid/core";
import { renderPivotHtml, type RenderPivotHtmlOptions } from "@nqlib/nqgrid/render-static";

import { PivotExportError, toPivotExportError } from "./errors";
import { createPivotPdfPagePool, launchPivotBrowser, type LaunchPivotBrowserOptions, type PivotPdfBrowser, type PivotPdfPagePool } from "./pdf";
import { parsePivotExportRequest, type PivotExportFormat, type PivotExportOptions } from "./request";
import { writePivotXlsx } from "./xlsx";

export const PIVOT_EXPORT_CONTENT_TYPES: Record<PivotExportFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  html: "text/html; charset=utf-8",
  model: "application/json; charset=utf-8",
  sheet: "application/json; charset=utf-8",
};

export const PIVOT_EXPORT_EXTENSIONS: Record<PivotExportFormat, string> = {
  pdf: "pdf",
  xlsx: "xlsx",
  html: "html",
  model: "model.json",
  sheet: "sheet.json",
};

/** Binary formats return bytes; `html`, `model` and `sheet` return text. */
export type PivotExportResult<F extends PivotExportFormat = PivotExportFormat> = F extends "pdf" | "xlsx" ? Uint8Array : string;

export interface ExportPivotInput<F extends PivotExportFormat = PivotExportFormat> {
  /** Validated with `validatePivotSpec` (unknown input is fine — e.g. JSON from Python). */
  readonly spec: PivotSpec | unknown;
  readonly rows: readonly PivotDataRow[] | unknown;
  readonly format: F;
  readonly options?: PivotExportOptions;
}

export type PivotBrowserState = "cold" | "starting" | "ready" | "unavailable";

/** `exportDetailed` result: the file plus `model.diagnostics` (data problems worth reporting, `[]` when none). */
export interface PivotExportOutput<F extends PivotExportFormat = PivotExportFormat> {
  readonly data: PivotExportResult<F>;
  readonly diagnostics: readonly PivotDiagnostic[];
}

/** Response header of `POST /export` carrying `model.diagnostics` as JSON (ASCII-escaped, ≤ 8 KB). */
export const PIVOT_DIAGNOSTICS_HEADER = "x-nqgrid-diagnostics";

/**
 * `diagnostics` as an HTTP-header-safe JSON array: non-ASCII escaped (`\u00e9`), and entries dropped
 * from the end (samples first) until it fits `maxLength` (the model already bounds them; this only
 * guards header limits).
 */
export function pivotDiagnosticsHeaderValue(diagnostics: readonly PivotDiagnostic[], maxLength = 8000): string {
  const encode = (list: readonly unknown[]) => JSON.stringify(list).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
  let list: readonly PivotDiagnostic[] = diagnostics;
  let text = encode(list);
  if (text.length > maxLength) {
    list = list.map((d) => {
      const rest = { ...d };
      delete (rest as { samples?: unknown }).samples;
      return rest;
    });
    text = encode(list);
  }
  while (text.length > maxLength && list.length > 0) {
    list = list.slice(0, -1);
    text = encode(list);
  }
  return text;
}

export interface PivotExporter {
  export<F extends PivotExportFormat>(input: ExportPivotInput<F>): Promise<PivotExportResult<F>>;
  /** `export` plus the model's diagnostics (serve mode sends them in `x-nqgrid-diagnostics`, the CLI on stderr). */
  exportDetailed<F extends PivotExportFormat>(input: ExportPivotInput<F>): Promise<PivotExportOutput<F>>;
  /** Launch Chromium now (serve mode keeps it warm). */
  warm(): Promise<void>;
  browserState(): PivotBrowserState;
  close(): Promise<void>;
}

export interface CreatePivotExporterOptions extends LaunchPivotBrowserOptions {
  /** Reuse an existing Playwright browser (not closed by `close()`). */
  readonly browser?: PivotPdfBrowser;
  /** Print pages kept warm for reuse (default 4; the serve mode passes its concurrency). */
  readonly pdfPages?: number;
}

/** `PivotExportOptions` are `renderPivotHtml` options plus PDF-only keys (ignored by the renderer). */
const htmlOptions = (o: PivotExportOptions | undefined): RenderPivotHtmlOptions => o ?? {};

/**
 * Exporter that owns (at most) one Chromium instance, launched on first PDF (or `warm()`) and
 * relaunched if it disconnects. PDFs render on reusable print pages (`createPivotPdfPagePool`: one
 * context with JavaScript off and the network blocked; each PDF replaces the page's document).
 */
export function createPivotExporter(options: CreatePivotExporterOptions = {}): PivotExporter {
  let browser: Promise<PivotPdfBrowser> | null = options.browser ? Promise.resolve(options.browser) : null;
  let state: PivotBrowserState = options.browser ? "ready" : "cold";
  let pool: { readonly browser: PivotPdfBrowser; readonly pages: PivotPdfPagePool } | null = null;
  const poolFor = (b: PivotPdfBrowser): PivotPdfPagePool => {
    if (pool?.browser !== b) {
      void pool?.pages.close();
      pool = { browser: b, pages: createPivotPdfPagePool(b, { maxIdlePages: options.pdfPages ?? 4 }) };
    }
    return pool.pages;
  };

  const getBrowser = () => {
    if (!browser) {
      state = "starting";
      browser = launchPivotBrowser(options).then(
        (b) => {
          state = "ready";
          b.on("disconnected", () => {
            browser = null;
            state = "cold";
            if (pool?.browser === b) pool = null;
          });
          return b;
        },
        (error: unknown) => {
          browser = null;
          state = "unavailable";
          throw error;
        },
      );
    }
    return browser;
  };

  const run = async (input: ExportPivotInput): Promise<{ data: Uint8Array | string; diagnostics: readonly PivotDiagnostic[] }> => {
    const req = parsePivotExportRequest({ spec: input.spec, rows: input.rows, options: input.options }, input.format);
    const model = buildPivotModel(req.spec, req.rows, { validate: false });
    return { data: await render(req, model), diagnostics: model.diagnostics ?? [] };
  };
  const render = async (req: ReturnType<typeof parsePivotExportRequest>, model: ReturnType<typeof buildPivotModel>): Promise<Uint8Array | string> => {
    switch (req.format) {
      case "model":
        return `${JSON.stringify(model, null, 2)}\n`;
      case "sheet":
        return `${JSON.stringify(pivotModelToSheet(model), null, 2)}\n`;
      case "html":
        return renderPivotHtml(model, htmlOptions(req.options));
      case "xlsx":
        return writePivotXlsx(model, { spec: req.spec, generatedAt: req.options?.generatedAt ?? null });
      case "pdf": {
        const html = renderPivotHtml(model, htmlOptions(req.options));
        const o = req.options;
        return poolFor(await getBrowser()).render(html, {
          page: o?.page,
          theme: o?.theme,
          title: o?.title === undefined ? (model.title ?? null) : o.title,
          generatedAt: o?.generatedAt ?? null,
          labels: o?.locale,
          headerFooter: o?.headerFooter,
        });
      }
    }
  };

  return {
    async export<F extends PivotExportFormat>(input: ExportPivotInput<F>) {
      try {
        return (await run(input)).data as PivotExportResult<F>;
      } catch (error) {
        throw toPivotExportError(error);
      }
    },
    async exportDetailed<F extends PivotExportFormat>(input: ExportPivotInput<F>) {
      try {
        const out = await run(input);
        return { data: out.data as PivotExportResult<F>, diagnostics: out.diagnostics };
      } catch (error) {
        throw toPivotExportError(error);
      }
    },
    async warm() {
      await getBrowser();
    },
    browserState: () => state,
    async close() {
      const current = browser;
      browser = null;
      state = "cold";
      const pages = pool?.pages;
      pool = null;
      await pages?.close();
      if (current && !options.browser) await current.then((b) => b.close()).catch(() => undefined);
    },
  };
}

/**
 * One-off export: `{ spec, rows, format, options }` → bytes (`pdf`, `xlsx`) or text (`html`, `model`,
 * `sheet`). PDF launches and closes Chromium per call — keep a `createPivotExporter()` (or the serve
 * mode) around for repeated PDFs. Throws `PivotExportError` (`code: "invalid_input" | "internal"`).
 */
export async function exportPivot<F extends PivotExportFormat>(
  input: ExportPivotInput<F> & { readonly exporter?: PivotExporter },
): Promise<PivotExportResult<F>> {
  const exporter = input.exporter ?? createPivotExporter();
  try {
    return await exporter.export(input);
  } finally {
    if (!input.exporter) await exporter.close();
  }
}

export { PivotExportError };
