import { describe, expect, it } from "vitest";

import { createPivotExporter, exportPivot } from "../src/exporter";
import { pivotPdfTemplates } from "../src/pdf";
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
