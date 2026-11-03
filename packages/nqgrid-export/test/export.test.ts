import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  addPivotMeasure,
  movePivotField,
  pivotColumnFields,
  resolvePivotFields,
  setPivotDateGrouping,
  setPivotFilterValues,
  setPivotMeasureAggregate,
  setPivotValuesPosition,
  validatePivotSpec,
  type PivotDataRow,
  type PivotSheet,
  type PivotSpec,
} from "@nqlib/nqgrid/core";
import { pivotHeatLevelFillHex } from "@nqlib/nqgrid/render-static";

import { exportPivot } from "../src/exporter";
import { NQGRID_EXPORT_VERSION } from "../src/version";
import { chromiumAvailable, GOLDEN_GENERATED_AT, pdfPageCount, planningFilteredSpec, planningRows, planningSpec, readExample } from "./helpers";

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

  it("planning-filtered: model / sheet / html match the golden files", async () => {
    const args = { spec: planningFilteredSpec, rows: planningRows };
    expect(await exportPivot({ ...args, format: "model" })).toBe(readExample("planning-filtered.model.json"));
    expect(await exportPivot({ ...args, format: "sheet" })).toBe(readExample("planning-filtered.sheet.json"));
    expect(await exportPivot({ ...args, format: "html", options: { generatedAt: GOLDEN_GENERATED_AT } })).toBe(readExample("planning-filtered.html"));
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

describe("exportPivot (xlsx with filters)", async () => {
  const bytes = await exportPivot({ spec: planningFilteredSpec, rows: planningRows, format: "xlsx", options: { generatedAt: GOLDEN_GENERATED_AT } });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  const filters = (JSON.parse(readExample("planning-filtered.sheet.json")) as PivotSheet).filters!;

  it("lists the active filters under the KPIs and on the Spec sheet", () => {
    expect(filters).toEqual(["Department = Camp, Packs", 'Line does not contain "kids"', "Line: Top 3 by Actual, rest as Other"]);
    const ks = wb.getWorksheet("KPIs")!;
    const col = (ks.getSheetValues() as unknown[][]).map((r) => r?.[1]);
    const at = col.indexOf("Filters");
    expect(at).toBeGreaterThan(1);
    expect(col.slice(at + 1)).toEqual(filters);
    const ss = wb.getWorksheet("Spec")!;
    expect([3, 4, 5].map((r) => [ss.getCell(`A${r}`).value, ss.getCell(`B${r}`).value])).toEqual(filters.map((f) => ["filter", f]));
    const lines: string[] = [];
    ss.eachRow((row, n) => {
      if (n >= 7) lines.push(String(row.getCell(1).value ?? ""));
    });
    expect(JSON.parse(lines.join("\n"))).toEqual(planningFilteredSpec);
  });

  it("the pivot sheet keeps the filtered values (Other rows included)", () => {
    const ws = wb.worksheets[0]!;
    const labels = (ws.getColumn(2).values as unknown[]).filter((v) => typeof v === "string");
    expect(labels).toContain("Other");
    expect(labels).not.toContain("Kids");
  });
});

describe("exportPivot after field-list moves (rearranged specs)", async () => {
  const rows = JSON.parse(readExample("planning-fields.rows.json")) as PivotDataRow[];
  const fields = resolvePivotFields({ ...planningSpec, fields: JSON.parse(readExample("planning-fields.spec.json")).fields });
  // Line ↔ Month, Units + Plan in Values, Σ Values outermost, Region as a report filter, Channel as a row.
  let spec: PivotSpec = { ...planningSpec, fields };
  spec = movePivotField(spec, { field: "line", from: "rows", to: "columns", index: 0 }, { fields });
  spec = movePivotField(spec, { field: "month", from: "columns", to: "rows" }, { fields });
  spec = addPivotMeasure(spec, { field: "units" }, { fields });
  spec = addPivotMeasure(spec, { field: "plan", index: 0 }, { fields });
  spec = setPivotValuesPosition(spec, 0);
  spec = movePivotField(spec, { field: "region", from: "unused", to: "filters" }, { fields });
  spec = setPivotFilterValues(spec, "region", ["North", "South", "East", "West"], ["North", "East"]);
  spec = movePivotField(spec, { field: "channel", from: "unused", to: "rows", index: 0 }, { fields });
  spec = setPivotMeasureAggregate(spec, "units", "avg", { fields });

  it("the moved spec is valid and changes the layout", () => {
    expect(validatePivotSpec(spec)).toMatchObject({ ok: true });
    expect(spec.rows.map((d) => d.field)).toEqual(["channel", "department", "month"]);
    expect(spec.columns).toEqual({ field: "line", label: "Line" });
    expect(spec.values).toEqual(["plan", "actual", "units"]);
  });

  it("xlsx: values, filters and the Spec sheet follow the moved spec", async () => {
    const bytes = await exportPivot({ spec, rows, format: "xlsx", options: { generatedAt: GOLDEN_GENERATED_AT } });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
    const sheet = JSON.parse((await exportPivot({ spec, rows, format: "sheet" })) as string) as PivotSheet;
    expect(sheet.filters).toEqual(["Region = North, East"]);
    const ws = wb.worksheets[0]!;
    // Measures are the top header row (Σ Values outermost), lines below.
    const header = [...new Set((ws.getRow(1).values as unknown[]).filter((v) => typeof v === "string"))];
    expect(header).toEqual(["Plan", "Actual", "Average of Units"]);
    expect(sheet.cells.slice(0, sheet.frozenRows).flat().map((c) => c.v)).toContain("Channel");
    expect((ws.getRow(2).values as unknown[]).filter((v) => v === "Tents")).toHaveLength(3);
    let numeric = 0;
    sheet.cells.forEach((row, r) =>
      row.forEach((src, c) => {
        const cell = ws.getCell(r + 1, c + 1);
        if (cell.isMerged && cell.master.address !== cell.address) return;
        expect(cell.value ?? null).toBe(src.v);
        if (typeof src.v === "number") numeric++;
      }),
    );
    expect(numeric).toBeGreaterThan(100);
    const ss = wb.getWorksheet("Spec")!;
    const lines: string[] = [];
    ss.eachRow((row, n) => {
      if (n >= 5) lines.push(String(row.getCell(1).value ?? ""));
    });
    expect(JSON.parse(lines.join("\n"))).toEqual(spec);
  });

  it("html / pdf render the moved spec", async () => {
    const html = (await exportPivot({ spec, rows, format: "html", options: { generatedAt: GOLDEN_GENERATED_AT } })) as string;
    expect(html).toContain("Filters: Region = North, East");
    expect(html).toContain("Average of Units");
    if (!chromiumAvailable) return;
    const pdf = (await exportPivot({ spec, rows, format: "pdf", options: { generatedAt: GOLDEN_GENERATED_AT } })) as Uint8Array;
    expect(Buffer.from(pdf.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
    expect(pdfPageCount(pdf)).toBeGreaterThanOrEqual(1);
  }, 60_000);
});

describe("several column fields and date grouping (planning-multicol / planning-dates)", async () => {
  const fieldsRows = JSON.parse(readExample("planning-fields.rows.json")) as PivotDataRow[];
  const multi = JSON.parse(readExample("planning-multicol.spec.json")) as PivotSpec;
  const datesRows = JSON.parse(readExample("planning-dates.rows.json")) as PivotDataRow[];
  const dates = JSON.parse(readExample("planning-dates.spec.json")) as PivotSpec;

  it("model / sheet / html match the golden files", async () => {
    for (const [spec, rows, name] of [[multi, fieldsRows, "planning-multicol"], [dates, datesRows, "planning-dates"]] as const) {
      expect(await exportPivot({ spec, rows, format: "model" })).toBe(readExample(`${name}.model.json`));
      expect(await exportPivot({ spec, rows, format: "sheet" })).toBe(readExample(`${name}.sheet.json`));
      expect(await exportPivot({ spec, rows, format: "html", options: { generatedAt: GOLDEN_GENERATED_AT } })).toBe(readExample(`${name}.html`));
    }
  });

  it("xlsx keeps the multi-row header: row-spanning subtotal merges and the frozen header rows", async () => {
    const bytes = await exportPivot({ spec: multi, rows: fieldsRows, format: "xlsx", options: { generatedAt: GOLDEN_GENERATED_AT } });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    const sheet = JSON.parse(readExample("planning-multicol.sheet.json")) as PivotSheet;
    expect(sheet.frozenRows).toBe(3);
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 3 });
    // "North Total" covers two header rows and its two measure columns.
    const merge = sheet.merges.find((m) => m.rowSpan === 2 && m.colSpan === 2)!;
    const master = ws.getCell(merge.row + 1, merge.col + 1);
    expect(master.value).toBe("North Total");
    expect(ws.getCell(merge.row + 2, merge.col + 2).isMerged).toBe(true);
    expect(ws.getCell(merge.row + 2, merge.col + 2).master.address).toBe(master.address);
    sheet.cells.forEach((row, r) =>
      row.forEach((src, c) => {
        const cell = ws.getCell(r + 1, c + 1);
        if (cell.isMerged && cell.master.address !== cell.address) return;
        expect(cell.value ?? null).toBe(src.v);
      }),
    );
  });

  it("a date grouping changed after loading exports like any spec (pdf splits by column group)", async () => {
    const months = setPivotDateGrouping({ ...dates, columnsExpanded: "all" }, "orderDate", ["year", "quarter", "month"]);
    expect(pivotColumnFields(months).map((d) => d.field)).toEqual(["orderDate:year", "orderDate:quarter", "orderDate:month"]);
    const html = (await exportPivot({ spec: months, rows: datesRows, format: "html", options: { generatedAt: GOLDEN_GENERATED_AT } })) as string;
    // A fiscal year (17 columns) is wider than a page: chunks follow its quarters instead.
    expect(html).toContain("Year (Order date) FY25 Q1 – FY25 Q3 Total · Columns 1–12 of 35");
    expect(html).toContain(">Nov<");
    if (!chromiumAvailable) return;
    const pdf = (await exportPivot({ spec: months, rows: datesRows, format: "pdf", options: { generatedAt: GOLDEN_GENERATED_AT } })) as Uint8Array;
    expect(pdfPageCount(pdf)).toBeGreaterThanOrEqual(2);
  }, 60_000);
});

describe("calculated measures, show-as differences, subtotal rows and distinct count (planning-calc)", async () => {
  const datesRows = JSON.parse(readExample("planning-dates.rows.json")) as PivotDataRow[];
  const calc = JSON.parse(readExample("planning-calc.spec.json")) as PivotSpec;

  it("model / sheet / html match the golden files", async () => {
    expect(await exportPivot({ spec: calc, rows: datesRows, format: "model" })).toBe(readExample("planning-calc.model.json"));
    expect(await exportPivot({ spec: calc, rows: datesRows, format: "sheet" })).toBe(readExample("planning-calc.sheet.json"));
    expect(await exportPivot({ spec: calc, rows: datesRows, format: "html", options: { generatedAt: GOLDEN_GENERATED_AT } })).toBe(readExample("planning-calc.html"));
  });

  it("xlsx: numeric calc / show-as values with their formats, subtotal rows labelled in the group column", async () => {
    const bytes = await exportPivot({ spec: calc, rows: datesRows, format: "xlsx", options: { generatedAt: GOLDEN_GENERATED_AT } });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    const sheet = JSON.parse(readExample("planning-calc.sheet.json")) as PivotSheet;
    sheet.cells.forEach((row, r) =>
      row.forEach((src, c) => {
        const cell = ws.getCell(r + 1, c + 1);
        if (cell.isMerged && cell.master.address !== cell.address) return;
        expect(cell.value ?? null).toBe(src.v);
        if (typeof src.v === "number" && src.numFmt) expect(cell.numFmt).toBe(src.numFmt);
      }),
    );
    const subtotalRow = sheet.cells.findIndex((row) => row[0]?.v === "Camp Total");
    expect(subtotalRow).toBeGreaterThan(0);
    expect(ws.getCell(subtotalRow + 1, 1).isMerged).toBe(false);
    // A rejected calculated measure never reaches the renderer.
    const bad = { ...calc, measures: [...calc.measures, { id: "loop", calculate: "loop + 1" }] };
    await expect(exportPivot({ spec: bad, rows: datesRows, format: "model" })).rejects.toMatchObject({ code: "invalid_input" });
    if (!chromiumAvailable) return;
    const pdf = (await exportPivot({ spec: calc, rows: datesRows, format: "pdf", options: { generatedAt: GOLDEN_GENERATED_AT } })) as Uint8Array;
    expect(pdfPageCount(pdf)).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
