import { buildPivotModel, pivotModelToSheet, type PivotDataRow, type PivotSpec } from "@nqlib/nqgrid/core";
import { renderPivotHtml, type RenderPivotHtmlOptions } from "@nqlib/nqgrid/render-static";

import { PivotExportError, toPivotExportError } from "./errors";
import { launchPivotBrowser, renderPivotPdf, type LaunchPivotBrowserOptions, type PivotPdfBrowser } from "./pdf";
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

export interface PivotExporter {
  export<F extends PivotExportFormat>(input: ExportPivotInput<F>): Promise<PivotExportResult<F>>;
  /** Launch Chromium now (serve mode keeps it warm). */
  warm(): Promise<void>;
  browserState(): PivotBrowserState;
  close(): Promise<void>;
}

export interface CreatePivotExporterOptions extends LaunchPivotBrowserOptions {
  /** Reuse an existing Playwright browser (not closed by `close()`). */
  readonly browser?: PivotPdfBrowser;
}

/** `PivotExportOptions` are `renderPivotHtml` options plus PDF-only keys (ignored by the renderer). */
const htmlOptions = (o: PivotExportOptions | undefined): RenderPivotHtmlOptions => o ?? {};

/**
 * Exporter that owns (at most) one Chromium instance, launched on first PDF (or `warm()`) and
 * relaunched if it disconnects. Every PDF renders in its own isolated browser context.
 */
export function createPivotExporter(options: CreatePivotExporterOptions = {}): PivotExporter {
  let browser: Promise<PivotPdfBrowser> | null = options.browser ? Promise.resolve(options.browser) : null;
  let state: PivotBrowserState = options.browser ? "ready" : "cold";

  const getBrowser = () => {
    if (!browser) {
      state = "starting";
      browser = launchPivotBrowser(options).then(
        (b) => {
          state = "ready";
          b.on("disconnected", () => {
            browser = null;
            state = "cold";
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

  const run = async (input: ExportPivotInput): Promise<Uint8Array | string> => {
    const req = parsePivotExportRequest({ spec: input.spec, rows: input.rows, options: input.options }, input.format);
    const model = buildPivotModel(req.spec, req.rows, { validate: false });
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
        return renderPivotPdf(await getBrowser(), html, {
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
        return (await run(input)) as PivotExportResult<F>;
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
