import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import type { PivotSheet } from "@nqlib/nqgrid/core";
import { pivotHeatLevelFillHex } from "@nqlib/nqgrid/render-static";

import { exportPivot } from "../src/exporter";
import { NQGRID_EXPORT_VERSION } from "../src/version";
import { GOLDEN_GENERATED_AT, planningRows, planningSpec, readExample } from "./helpers";

const colName = (c: number) => {
  let s = "";
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

describe("exportPivot (text formats)", () => {
  it("model / sheet / html match the golden contract files", async () => {
    expect(await exportPivot({ spec: planningSpec, rows: planningRows, format: "model" })).toBe(readExample("planning.model.json"));
    expect(await exportPivot({ spec: planningSpec, rows: planningRows, format: "sheet" })).toBe(readExample("planning.sheet.json"));
    const html = await exportPivot({ spec: planningSpec, rows: planningRows, format: "html", options: { generatedAt: GOLDEN_GENERATED_AT } });
    expect(html).toBe(readExample("planning.html"));
  });

  it("throws invalid_input for bad specs", async () => {
    await expect(exportPivot({ spec: { version: 1 }, rows: [], format: "html" })).rejects.toMatchObject({ code: "invalid_input", exitCode: 2 });
  });

  it("version matches package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(NQGRID_EXPORT_VERSION).toBe(pkg.version);
  });
});

describe("exportPivot (xlsx)", async () => {
  const bytes = await exportPivot({ spec: planningSpec, rows: planningRows, format: "xlsx", options: { generatedAt: GOLDEN_GENERATED_AT } });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  const sheet = JSON.parse(readExample("planning.sheet.json")) as PivotSheet;
  const ws = wb.worksheets[0]!;

  it("is a zip with the pivot, KPIs and hidden Spec sheets", () => {
    expect(Buffer.from(bytes.subarray(0, 2)).toString("latin1")).toBe("PK");
    expect(wb.worksheets.map((w) => [w.name, w.state])).toEqual([
      ["FY26 Sales Plan", "visible"],
      ["KPIs", "visible"],
      ["Spec", "hidden"],
    ]);
  });

  it("keeps values and numFmt from planning.sheet.json", () => {
    let numeric = 0;
    sheet.cells.forEach((row, r) =>
      row.forEach((src, c) => {
        const cell = ws.getCell(r + 1, c + 1);
        if (cell.isMerged && cell.master.address !== cell.address) return;
        expect(cell.value ?? null).toBe(src.v);
        if (typeof src.v === "number") {
          numeric++;
          expect(cell.numFmt).toBe(src.numFmt);
        }
        if (src.bold) expect(cell.font?.bold).toBe(true);
      }),
    );
    expect(numeric).toBeGreaterThan(100);
  });

  it("keeps merges, frozen panes, heat fills and column widths", () => {
    const expected = sheet.merges.map((m) => `${colName(m.col)}${m.row + 1}:${colName(m.col + m.colSpan - 1)}${m.row + m.rowSpan}`).sort();
    expect([...(ws.model as { merges: string[] }).merges].sort()).toEqual(expected);
    expect(ws.views[0]).toMatchObject({ state: "frozen", xSplit: sheet.frozenCols, ySplit: sheet.frozenRows });
    const r = sheet.cells.findIndex((row) => row.some((c) => c.heat !== undefined));
    const c = sheet.cells[r]!.findIndex((cell) => cell.heat !== undefined);
    const fill = ws.getCell(r + 1, c + 1).fill as ExcelJS.FillPattern;
    expect(fill.fgColor?.argb).toBe(`FF${pivotHeatLevelFillHex(sheet.cells[r]![c]!.heat!, 9).slice(1).toUpperCase()}`);
    expect(ws.getColumn(1).width).toBeGreaterThanOrEqual(12);
    expect(ws.getColumn(3).width).toBeGreaterThanOrEqual(10);
  });

  it("KPIs sheet lists grand and department KPIs with number formats", () => {
    const ks = wb.getWorksheet("KPIs")!;
    expect(ks.getRow(1).values).toEqual([undefined, "Department", "Owner", "KPI", "Value", "Compared to", "Delta"]);
    const rows = ks.getSheetValues().slice(2) as unknown[][];
    expect(rows.length).toBe(5 * 4); // grand total + 4 departments (collapsed ones too) × 4 KPIs
    const outlook = ks.getRow(4);
    expect(outlook.getCell(3).value).toBe("Outlook");
    expect(outlook.getCell(5).value).toBe("Plan");
    expect(outlook.getCell(6).numFmt).toContain("%");
    expect(ks.getRow(14).getCell(1).value).toBe("Camp");
    expect(ks.getRow(14).getCell(2).value).toBe("Ingrid Solberg");
  });

  it("Spec sheet holds the spec JSON for traceability", () => {
    const ss = wb.getWorksheet("Spec")!;
    expect(ss.getCell("B2").value).toBe(GOLDEN_GENERATED_AT);
    const lines: string[] = [];
    ss.eachRow((row, n) => {
      if (n >= 4) lines.push(String(row.getCell(1).value ?? ""));
    });
    expect(JSON.parse(lines.join("\n"))).toEqual(planningSpec);
  });
});
