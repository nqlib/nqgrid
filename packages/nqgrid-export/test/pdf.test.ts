import { describe, expect, it } from "vitest";

import { createPivotExporter, exportPivot } from "../src/exporter";
import { createPivotPdfPagePool, pivotPdfTemplates, type PivotPdfBrowser } from "../src/pdf";
import { chromiumAvailable, pdfPageCount, planningRows, planningSpec } from "./helpers";

describe("pivotPdfTemplates", () => {
  it("prints the title, generated stamp and page X of Y (escaped, theme colored)", () => {
    const t = pivotPdfTemplates({ title: "Plan <FY26>", generatedAt: "2026-01-15", theme: "dark", labels: { page: "Seite", of: "von" } });
    expect(t.headerTemplate).toContain("Plan &lt;FY26&gt;");
    expect(t.footerTemplate).toContain('Seite <span class="pageNumber"></span> von <span class="totalPages"></span>');
    expect(t.footerTemplate).toContain("Generated 2026-01-15");
    expect(t.footerTemplate).toContain("color:#a1a1a1");
  });
});

describe.skipIf(!chromiumAvailable)("PDF (Chromium)", () => {
  it("renders a landscape PDF with pages", async () => {
    const pdf = await exportPivot({ spec: planningSpec, rows: planningRows, format: "pdf", options: { generatedAt: "2026-01-15 09:30 UTC" } });
    expect(Buffer.from(pdf.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
    expect(pdfPageCount(pdf)).toBe(1);
    // A4 landscape media box (841.92 × 595.2 pt, rounded by Chromium).
    expect(Buffer.from(pdf).toString("latin1")).toMatch(/\/MediaBox \[0 0 841\.\d+ 59\d\.\d+\]/);
  });

  it("one warm browser serves several PDFs; column chunks add pages", async () => {
    const exporter = createPivotExporter();
    try {
      const expanded = { ...planningSpec, expanded: "all" as const };
      const a = await exporter.export({ spec: expanded, rows: planningRows, format: "pdf" });
      const b = await exporter.export({ spec: expanded, rows: planningRows, format: "pdf", options: { maxColumnsPerPage: 6, theme: "dark" } });
      expect(exporter.browserState()).toBe("ready");
      expect(pdfPageCount(a)).toBe(2); // 4 departments expanded → groups kept whole across 2 pages
      expect(pdfPageCount(b)).toBe(4); // × 2 column chunks
    } finally {
      await exporter.close();
    }
  });
});

describe("createPivotPdfPagePool (fake browser)", () => {
  const fake = () => {
    const log: string[] = [];
    let pages = 0;
    let contexts = 0;
    const browser: PivotPdfBrowser = {
      async newContext(options) {
        const id = ++contexts;
        log.push(`context${id}:${JSON.stringify(options)}`);
        return {
          async route() {
            log.push(`route${id}`);
          },
          async newPage() {
            const p = ++pages;
            log.push(`page${p}`);
            return {
              async setContent(html: string) {
                if (html === "boom") throw new Error("setContent failed");
                log.push(`load${p}:${html}`);
              },
              async emulateMedia() {},
              async pdf() {
                return new TextEncoder().encode(`%PDF-${p}`);
              },
              async close() {
                log.push(`closePage${p}`);
              },
            };
          },
          async close() {
            log.push(`closeContext${id}`);
          },
        };
      },
      async close() {},
      isConnected: () => true,
      version: () => "fake",
      on: () => undefined,
    };
    return { browser, log };
  };

  it("reuses pages in one locked-down context, replaces failed and worn-out pages", async () => {
    const { browser, log } = fake();
    const pool = createPivotPdfPagePool(browser, { maxIdlePages: 2, maxUsesPerPage: 3 });
    const text = (b: Uint8Array) => new TextDecoder().decode(b);
    expect(text(await pool.render("a"))).toBe("%PDF-1");
    expect(text(await pool.render("b"))).toBe("%PDF-1");
    // Two at once: the idle page plus a new one.
    expect((await Promise.all([pool.render("c"), pool.render("d")])).map(text).sort()).toEqual(["%PDF-1", "%PDF-2"]);
    expect(log).toContain("closePage1"); // page 1 reached 3 uses
    await expect(pool.render("boom")).rejects.toThrow("setContent failed");
    expect(log.filter((l) => l.startsWith("context"))).toEqual(['context1:{"javaScriptEnabled":false,"offline":true}']);
    expect(log).toContain("route1");
    const closedAfterBoom = log.filter((l) => l.startsWith("closePage")).length;
    expect(closedAfterBoom).toBe(2); // the failed page is not reused
    expect(text(await pool.render("e"))).toMatch(/^%PDF-\d$/);
    await pool.close();
    expect(log.at(-1)).toBe("closeContext1");
    await expect(pool.render("f")).rejects.toThrow("closed");
  });
});
