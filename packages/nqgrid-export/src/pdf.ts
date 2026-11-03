import { createRequire } from "node:module";
import { join } from "node:path";

import {
  PIVOT_STATIC_LABELS,
  PIVOT_STATIC_PALETTE,
  PIVOT_STATIC_FONT_STACK,
  resolvePivotStaticPage,
  type PivotStaticLabels,
  type PivotStaticPageOptions,
  type PivotStaticTheme,
} from "@nqlib/nqgrid/render-static";

import { PivotExportError } from "./errors";

/**
 * The slice of the Playwright API used here, typed structurally so `playwright` stays an optional
 * peer dependency (install it next to this package, globally via NODE_PATH, or use the Docker image).
 */
export interface PivotPdfRoute {
  request(): { url(): string };
  abort(): Promise<void>;
  continue(): Promise<void>;
}
export interface PivotPdfPage {
  setContent(html: string, options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle"; timeout?: number }): Promise<void>;
  emulateMedia(options: { media: "print" | "screen" }): Promise<void>;
  pdf(options: Record<string, unknown>): Promise<Uint8Array>;
  close?(): Promise<void>;
}
export interface PivotPdfContext {
  route(url: string, handler: (route: PivotPdfRoute) => unknown): Promise<void>;
  newPage(): Promise<PivotPdfPage>;
  close(): Promise<void>;
}
export interface PivotPdfBrowser {
  newContext(options?: Record<string, unknown>): Promise<PivotPdfContext>;
  close(): Promise<void>;
  isConnected(): boolean;
  version(): string;
  on(event: "disconnected", listener: () => void): unknown;
}
interface PlaywrightChromium {
  launch(options?: { executablePath?: string; args?: string[] }): Promise<PivotPdfBrowser>;
}

/** Resolve `playwright` (ESM import, then CommonJS from this package or the cwd — which honours NODE_PATH). */
export async function loadPlaywrightChromium(): Promise<PlaywrightChromium> {
  const name = "playwright";
  const pick = (m: unknown): PlaywrightChromium | undefined => {
    const mod = m as { chromium?: PlaywrightChromium; default?: { chromium?: PlaywrightChromium } } | undefined;
    return mod?.chromium ?? mod?.default?.chromium;
  };
  try {
    const found = pick(await import(name));
    if (found) return found;
  } catch {
    // fall through to CommonJS resolution
  }
  for (const base of [import.meta.url, join(process.cwd(), "noop.js")]) {
    try {
      const found = pick(createRequire(base)(name));
      if (found) return found;
    } catch {
      // try the next base
    }
  }
  throw new PivotExportError(
    "internal",
    "PDF export needs Playwright: install `playwright` next to nqgrid-export (browsers via `npx playwright install chromium`) or use the Docker image",
  );
}

export interface LaunchPivotBrowserOptions {
  /** Chromium binary (default: Playwright's own; env `NQGRID_CHROMIUM_PATH`). */
  readonly executablePath?: string;
}

/** Launch headless Chromium for PDF rendering. */
export async function launchPivotBrowser(options: LaunchPivotBrowserOptions = {}): Promise<PivotPdfBrowser> {
  const chromium = await loadPlaywrightChromium();
  const executablePath = options.executablePath ?? process.env.NQGRID_CHROMIUM_PATH;
  try {
    return await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ["--disable-dev-shm-usage"] });
  } catch (error) {
    throw new PivotExportError("internal", `could not launch Chromium: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface PivotPdfOptions {
  readonly page?: PivotStaticPageOptions;
  readonly theme?: PivotStaticTheme;
  /** Running header (left). */
  readonly title?: string | null;
  /** Running footer (left), e.g. "Generated 2026-10-30 09:00 UTC". */
  readonly generatedAt?: string | null;
  readonly labels?: Partial<PivotStaticLabels>;
  /** Default true. */
  readonly headerFooter?: boolean;
  /** `setContent` timeout in ms (default 30 000). */
  readonly timeout?: number;
}

/** Header / footer templates (Chromium renders them in the page margins, outside the document). */
export function pivotPdfTemplates(options: PivotPdfOptions): { headerTemplate: string; footerTemplate: string } {
  const labels = { ...PIVOT_STATIC_LABELS, ...options.labels };
  const page = resolvePivotStaticPage(options.page);
  const color = PIVOT_STATIC_PALETTE[options.theme === "dark" ? "dark" : "light"].mutedForeground;
  const font = PIVOT_STATIC_FONT_STACK.replace(/"/g, "'");
  const box = (inner: string) =>
    `<div style="box-sizing:border-box;width:100%;padding:0 ${page.margins.right}mm 0 ${page.margins.left}mm;display:flex;justify-content:space-between;gap:12px;font-family:${font};font-size:8px;line-height:10px;color:${color};-webkit-print-color-adjust:exact;">${inner}</div>`;
  const title = options.title ? escapeHtml(options.title) : "";
  const generated = options.generatedAt ? `${escapeHtml(labels.generated)} ${escapeHtml(options.generatedAt)}` : "";
  return {
    headerTemplate: box(`<span>${title}</span><span></span>`),
    footerTemplate: box(
      `<span>${generated}</span><span>${escapeHtml(labels.page)} <span class="pageNumber"></span> ${escapeHtml(labels.of)} <span class="totalPages"></span></span>`,
    ),
  };
}

/** Load `html` into `tab` and print it (shared by the one-off and pooled paths). */
async function printPivotPdf(tab: PivotPdfPage, html: string, options: PivotPdfOptions): Promise<Uint8Array> {
  const page = resolvePivotStaticPage(options.page);
  await tab.setContent(html, { waitUntil: "load", timeout: options.timeout ?? 30_000 });
  const headerFooter = options.headerFooter ?? true;
  const m = page.margins;
  const pdf = await tab.pdf({
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: headerFooter,
    ...(headerFooter ? pivotPdfTemplates(options) : {}),
    margin: { top: `${m.top}mm`, right: `${m.right}mm`, bottom: `${m.bottom}mm`, left: `${m.left}mm` },
  });
  return new Uint8Array(pdf.buffer, pdf.byteOffset, pdf.byteLength);
}

/** Browser context for PDF rendering: JavaScript off and every network request aborted. */
async function newPivotPdfContext(browser: PivotPdfBrowser): Promise<PivotPdfContext> {
  const context = await browser.newContext({ javaScriptEnabled: false, offline: true });
  try {
    await context.route("**/*", (route) => (route.request().url().startsWith("data:") ? route.continue() : route.abort()));
  } catch (error) {
    await context.close().catch(() => undefined);
    throw error;
  }
  return context;
}

/**
 * Print a `renderPivotHtml` document to PDF in an isolated context: JavaScript off and every
 * network request aborted (the document is self-contained anyway). Creates and closes a context
 * and page per call; for repeated PDFs use `createPivotPdfPagePool` (what `createPivotExporter`
 * does), which skips about two thirds of the per-PDF time.
 */
export async function renderPivotPdf(browser: PivotPdfBrowser, html: string, options: PivotPdfOptions = {}): Promise<Uint8Array> {
  const context = await newPivotPdfContext(browser);
  try {
    const tab = await context.newPage();
    await tab.emulateMedia({ media: "print" });
    return await printPivotPdf(tab, html, options);
  } finally {
    await context.close();
  }
}

export interface PivotPdfPagePoolOptions {
  /** Idle pages kept for reuse (default 4, e.g. the serve mode's concurrency). Busier moments open extra pages. */
  readonly maxIdlePages?: number;
  /** Renders per page before it is replaced (default 100), to bound renderer memory growth. */
  readonly maxUsesPerPage?: number;
}

export interface PivotPdfPagePool {
  /** Same output as `renderPivotPdf(browser, html, options)`. */
  render(html: string, options?: PivotPdfOptions): Promise<Uint8Array>;
  close(): Promise<void>;
}

/**
 * Reusable print pages in one context with JavaScript off and the network blocked (as
 * `renderPivotPdf`). Each render replaces the page's document (`setContent`), so no state carries
 * over (documents run no scripts); a page that fails is closed instead of reused. Creating a context
 * and page and loading into a fresh renderer cost about 100 of the 160 ms of a one-off PDF
 * (docs/pivot-performance.md).
 */
export function createPivotPdfPagePool(browser: PivotPdfBrowser, options: PivotPdfPagePoolOptions = {}): PivotPdfPagePool {
  const maxIdle = Math.max(0, options.maxIdlePages ?? 4);
  const maxUses = Math.max(1, options.maxUsesPerPage ?? 100);
  let context: Promise<PivotPdfContext> | null = null;
  const idle: { readonly page: PivotPdfPage; uses: number }[] = [];
  let closed = false;
  const contextOf = () => {
    if (!context) {
      context = newPivotPdfContext(browser);
      context.catch(() => {
        context = null;
      });
    }
    return context;
  };
  const closePage = (page: PivotPdfPage) => page.close?.().catch(() => undefined);
  return {
    async render(html, renderOptions = {}) {
      if (closed) throw new PivotExportError("internal", "PDF page pool is closed");
      let entry = idle.pop();
      if (!entry) {
        const page = await (await contextOf()).newPage();
        await page.emulateMedia({ media: "print" });
        entry = { page, uses: 0 };
      }
      let ok = false;
      try {
        const pdf = await printPivotPdf(entry.page, html, renderOptions);
        ok = true;
        return pdf;
      } finally {
        entry.uses++;
        if (ok && !closed && entry.uses < maxUses && idle.length < maxIdle) idle.push(entry);
        else void closePage(entry.page);
      }
    },
    async close() {
      closed = true;
      idle.length = 0;
      const current = context;
      context = null;
      if (current) await current.then((c) => c.close()).catch(() => undefined);
    },
  };
}
