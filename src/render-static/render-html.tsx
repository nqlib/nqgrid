import { renderToStaticMarkup } from "react-dom/server";

import { buildPivotModel, type BuildPivotModelOptions } from "../core/pivot/build-model";
import type { PivotDataRow, PivotModel, PivotSpec } from "../core/pivot/types";
import { pivotTableGeometry } from "../pivot/layout";
import { PivotHeaderSummary } from "../pivot/pivot-header-chart";
import { PivotTable, type PivotTableProps } from "../pivot/pivot-table";
import { PIVOT_STATIC_PALETTE, type PivotStaticTheme } from "./color";
import { PIVOT_STATIC_CSS } from "./css";
import {
  pivotColumnChunks,
  pivotColumnsPerPage,
  resolvePivotStaticPage,
  slicePivotModelColumns,
  type PivotColumnChunk,
  type PivotStaticPageOptions,
} from "./paging";

/** Printed strings (override for other languages). */
export interface PivotStaticLabels {
  /** Before `generatedAt` (default `Generated`). */
  readonly generated: string;
  /** Appended to the title of continuation column chunks (default `(cont.)`). */
  readonly continued: string;
  /** Column range caption, e.g. "Columns 7–12 of 12" (default `Columns`). */
  readonly columns: string;
  /** Default `of`. */
  readonly of: string;
  /** PDF footer "Page 2 of 3" (default `Page`); used by `nqgrid-export`. */
  readonly page: string;
}

export const PIVOT_STATIC_LABELS: PivotStaticLabels = {
  generated: "Generated",
  continued: "(cont.)",
  columns: "Columns",
  of: "of",
  page: "Page",
};

/** Print-friendly defaults (narrower than the interactive `[208, 172]` / 84). */
export const PIVOT_STATIC_DIMENSION_WIDTHS = [184, 152] as const;
export const PIVOT_STATIC_VALUE_WIDTH = 76;

export type PivotStaticTableOptions = Pick<
  PivotTableProps,
  | "dimensionWidths"
  | "valueWidth"
  | "rowHeight"
  | "headRowHeight"
  | "headerChart"
  | "chartHeight"
  | "kpiHeadlineId"
  | "kpiCaptionAttribute"
>;

export interface RenderPivotHtmlOptions {
  /** Default `light`. Dark prints the dark surfaces and the dark series steps. */
  readonly theme?: PivotStaticTheme;
  /** Page box for print / PDF (default A4 landscape). */
  readonly page?: PivotStaticPageOptions;
  /** Report title (default `model.title`); `null` hides the report header. */
  readonly title?: string | null;
  /** Default `model.subtitle`; `null` hides it. */
  readonly subtitle?: string | null;
  /**
   * Printed as "Generated …". Strings are printed verbatim; a `Date` prints as `YYYY-MM-DD HH:mm UTC`.
   * Never read from the clock, so the same input renders byte-identical HTML.
   */
  readonly generatedAt?: string | Date | null;
  /**
   * Max value columns per page. Default: as many as fit the page width at `minScale`; wider pivots
   * are split into balanced column chunks, each repeating the row-dimension columns.
   */
  readonly maxColumnsPerPage?: number;
  /** Smallest zoom used to fit columns on a page before splitting them (default 0.7). */
  readonly minScale?: number;
  /** `lang` attribute plus printed labels. */
  readonly locale?: { readonly lang?: string } & Partial<PivotStaticLabels>;
  /** KPI side panels in department cells (default true); `false` prints label + headline delta. */
  readonly kpiPanel?: boolean;
  /** Table geometry / content overrides (defaults are print-sized). */
  readonly table?: PivotStaticTableOptions;
  /** Extra CSS appended after the built-in stylesheet. */
  readonly css?: string;
}

export interface PivotStaticLayout {
  readonly chunks: readonly PivotColumnChunk[];
  /** Zoom applied to every chunk table so the widest one fits the page width (≤ 1). */
  readonly scale: number;
  readonly columnsPerPage: number;
  readonly page: ReturnType<typeof resolvePivotStaticPage>;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD HH:mm UTC` for dates; strings unchanged. */
export function formatPivotGeneratedAt(value: string | Date): string {
  if (typeof value === "string") return value;
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())} UTC`;
}

const tableGeometryOptions = (options: RenderPivotHtmlOptions) => ({
  dimensionWidths: options.table?.dimensionWidths ?? PIVOT_STATIC_DIMENSION_WIDTHS,
  valueWidth: options.table?.valueWidth ?? PIVOT_STATIC_VALUE_WIDTH,
});

/** Page, column chunks and zoom `renderPivotHtml` will use (pure; exposed for exporters and tests). */
export function pivotStaticLayout(model: PivotModel, options: RenderPivotHtmlOptions = {}): PivotStaticLayout {
  const page = resolvePivotStaticPage(options.page);
  const geometry = tableGeometryOptions(options);
  const columnsPerPage =
    options.maxColumnsPerPage !== undefined && options.maxColumnsPerPage > 0
      ? Math.floor(options.maxColumnsPerPage)
      : pivotColumnsPerPage(model, { widthPx: page.contentWidthPx, minScale: options.minScale, ...geometry });
  const chunks = pivotColumnChunks(model, columnsPerPage);
  const widest = Math.max(...chunks.map((c) => pivotTableGeometry(slicePivotModelColumns(model, c.start, c.end), geometry).width));
  const scale = Math.min(1, Math.floor((page.contentWidthPx / widest) * 1000) / 1000);
  return { chunks, scale, columnsPerPage, page };
}

/** One table row / section per line, so golden files diff readably (whitespace there is insignificant). */
const lineBreaks = (html: string) => html.replace(/(<\/(?:tr|thead|tbody|colgroup|header|section)>)/g, "$1\n");

/** Keep only the semantic `nqg-*` classes (Tailwind utilities mean nothing without the app's CSS). */
function keepSemanticClasses(html: string): string {
  return html.replace(/ class="([^"]*)"/g, (_, value: string) => {
    const kept = value.split(/\s+/).filter((c) => c.startsWith("nqg-"));
    return kept.length ? ` class="${kept.join(" ")}"` : "";
  });
}

function PivotStaticReport({ model, options, layout }: { model: PivotModel; options: RenderPivotHtmlOptions; layout: PivotStaticLayout }) {
  const labels = { ...PIVOT_STATIC_LABELS, ...options.locale };
  const title = options.title === undefined ? model.title : options.title;
  const subtitle = options.subtitle === undefined ? model.subtitle : options.subtitle;
  const generatedAt = options.generatedAt ? formatPivotGeneratedAt(options.generatedAt) : null;
  const geometry = tableGeometryOptions(options);
  const multi = layout.chunks.length > 1;
  const total = model.columns.length;
  const dimension = model.columnDimension?.label;
  const summary = model.headerSeries ? <PivotHeaderSummary model={model} /> : undefined;

  return (
    <main className="nqg-report" data-nqg-report="">
      {title !== null && (title || generatedAt) ? (
        <header className="nqg-report-header">
          <div>
            {title ? <h1 className="nqg-report-title">{title}</h1> : null}
            {subtitle ? <p className="nqg-report-subtitle">{subtitle}</p> : null}
          </div>
          {generatedAt ? (
            <div className="nqg-report-meta">
              {labels.generated} {generatedAt}
            </div>
          ) : null}
        </header>
      ) : null}
      {layout.chunks.map((chunk) => {
        const sub = slicePivotModelColumns(model, chunk.start, chunk.end);
        const range = chunk.firstLabel === chunk.lastLabel ? chunk.firstLabel : `${chunk.firstLabel} – ${chunk.lastLabel}`;
        return (
          <section key={chunk.index} className="nqg-report-chunk" data-nqg-chunk={chunk.index}>
            {multi ? (
              <div className="nqg-report-chunk-head">
                <span className="nqg-report-chunk-title">
                  {chunk.index > 0 ? `${title ?? model.title ?? ""} ${labels.continued}`.trim() : null}
                </span>
                <span>
                  {dimension ? `${dimension} ${range} · ` : `${range} · `}
                  {`${labels.columns} ${chunk.start + 1}–${chunk.end} ${labels.of} ${total}`}
                </span>
              </div>
            ) : null}
            <div className="nqg-report-scale" style={layout.scale < 1 ? { zoom: layout.scale } : undefined}>
              <PivotTable
                model={sub}
                mode="static"
                {...options.table}
                {...geometry}
                kpiPanel={options.kpiPanel ?? true}
                headerSummary={summary}
              />
            </div>
          </section>
        );
      })}
    </main>
  );
}

/**
 * Standalone HTML document for a pivot model: the `@nqlib/nqgrid/pivot` components in static mode
 * plus the inlined `PIVOT_STATIC_CSS`. No scripts, fonts or network requests — open it in a
 * browser, email it, or print it to PDF (landscape by default, repeated header band and column
 * headers on every page, groups kept together, wide pivots split into column chunks).
 */
export function renderPivotHtml(model: PivotModel, options: RenderPivotHtmlOptions = {}): string {
  const theme: PivotStaticTheme = options.theme === "dark" ? "dark" : "light";
  const layout = pivotStaticLayout(model, options);
  const lang = options.locale?.lang ?? "en";
  const docTitle = (options.title === undefined ? model.title : options.title) ?? model.title ?? "Pivot";
  const body = lineBreaks(keepSemanticClasses(renderToStaticMarkup(<PivotStaticReport model={model} options={options} layout={layout} />)));
  // The page background also covers the margins (Chromium otherwise paints its default canvas there).
  const pageCss = `${layout.page.css}\n@page { background: ${PIVOT_STATIC_PALETTE[theme].page}; }`;
  const css = `${PIVOT_STATIC_CSS}${pageCss}\n${options.css ? `${options.css}\n` : ""}`;
  return [
    "<!DOCTYPE html>",
    `<html lang="${escapeHtml(lang)}" data-theme="${theme}"${theme === "dark" ? ' class="dark"' : ""}>`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="generator" content="@nqlib/nqgrid/render-static">',
    `<title>${escapeHtml(docTitle)}</title>`,
    `<style>\n${css}</style>`,
    "</head>",
    `<body>${body}</body>`,
    "</html>",
    "",
  ].join("\n");
}

export interface RenderPivotHtmlFromSpecOptions extends RenderPivotHtmlOptions {
  /** Passed to `buildPivotModel` (e.g. custom aggregators). */
  readonly build?: BuildPivotModelOptions;
}

/** `buildPivotModel(spec, rows)` (validates the spec) + `renderPivotHtml`. */
export function renderPivotHtmlFromSpec(
  spec: PivotSpec,
  rows: readonly PivotDataRow[],
  options: RenderPivotHtmlFromSpecOptions = {},
): string {
  const { build, ...html } = options;
  return renderPivotHtml(buildPivotModel(spec, rows, build), html);
}
