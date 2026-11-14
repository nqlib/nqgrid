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
        const cell = ws.getCell(sheet.tableRow + r + 1, c + 1);
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
    const t = sheet.tableRow;
    const expected = sheet.merges.map((m) => `${colName(m.col)}${t + m.row + 1}:${colName(m.col + m.colSpan - 1)}${t + m.row + m.rowSpan}`).sort();
    expect([...(ws.model as { merges: string[] }).merges].sort()).toEqual(expected);
    expect(ws.views[0]).toMatchObject({ state: "frozen", xSplit: sheet.frozenCols, ySplit: t + sheet.frozenRows });
    const r = sheet.cells.findIndex((row) => row.some((c) => c.heat !== undefined));
    const c = sheet.cells[r]!.findIndex((cell) => cell.heat !== undefined);
    const fill = ws.getCell(t + r + 1, c + 1).fill as ExcelJS.FillPattern;
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
    const header = [...new Set((ws.getRow(sheet.tableRow + 1).values as unknown[]).filter((v) => typeof v === "string"))];
    expect(header).toEqual(["Plan", "Actual", "Average of Units"]);
    expect(sheet.cells.slice(0, sheet.frozenRows).flat().map((c) => c.v)).toContain("Channel");
    expect((ws.getRow(sheet.tableRow + 2).values as unknown[]).filter((v) => v === "Tents")).toHaveLength(3);
    let numeric = 0;
    sheet.cells.forEach((row, r) =>
      row.forEach((src, c) => {
        const cell = ws.getCell(sheet.tableRow + r + 1, c + 1);
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
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: sheet.tableRow + 3 });
    // "North Total" covers two header rows and its two measure columns.
    const merge = sheet.merges.find((m) => m.rowSpan === 2 && m.colSpan === 2)!;
    const t = sheet.tableRow;
    const master = ws.getCell(t + merge.row + 1, merge.col + 1);
    expect(master.value).toBe("North Total");
    expect(ws.getCell(t + merge.row + 2, merge.col + 2).isMerged).toBe(true);
    expect(ws.getCell(t + merge.row + 2, merge.col + 2).master.address).toBe(master.address);
    sheet.cells.forEach((row, r) =>
      row.forEach((src, c) => {
        const cell = ws.getCell(sheet.tableRow + r + 1, c + 1);
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
        const cell = ws.getCell(sheet.tableRow + r + 1, c + 1);
        if (cell.isMerged && cell.master.address !== cell.address) return;
        expect(cell.value ?? null).toBe(src.v);
        if (typeof src.v === "number" && src.numFmt) expect(cell.numFmt).toBe(src.numFmt);
      }),
    );
    const subtotalRow = sheet.cells.findIndex((row) => row[0]?.v === "Camp Total");
    expect(subtotalRow).toBeGreaterThan(0);
    expect(ws.getCell(sheet.tableRow + subtotalRow + 1, 1).isMerged).toBe(false);
    // A rejected calculated measure never reaches the renderer.
    const bad = { ...calc, measures: [...calc.measures, { id: "loop", calculate: "loop + 1" }] };
    await expect(exportPivot({ spec: bad, rows: datesRows, format: "model" })).rejects.toMatchObject({ code: "invalid_input" });
    if (!chromiumAvailable) return;
    const pdf = (await exportPivot({ spec: calc, rows: datesRows, format: "pdf", options: { generatedAt: GOLDEN_GENERATED_AT } })) as Uint8Array;
    expect(pdfPageCount(pdf)).toBeGreaterThanOrEqual(1);
  }, 60_000);
});

describe("financial statement: sign field, % of with a global base, section subtotal labels (planning-statement)", async () => {
  const rows = JSON.parse(readExample("planning-statement.rows.json")) as PivotDataRow[];
  const spec = JSON.parse(readExample("planning-statement.spec.json")) as PivotSpec;

  it("model / sheet / html match the golden files", async () => {
    expect(await exportPivot({ spec, rows, format: "model" })).toBe(readExample("planning-statement.model.json"));
    expect(await exportPivot({ spec, rows, format: "sheet" })).toBe(readExample("planning-statement.sheet.json"));
    expect(await exportPivot({ spec, rows, format: "html", options: { generatedAt: GOLDEN_GENERATED_AT } })).toBe(readExample("planning-statement.html"));
  });

  it("xlsx: signed amounts and % of Revenue stay numeric with their formats", async () => {
    const bytes = await exportPivot({ spec, rows, format: "xlsx", options: { generatedAt: GOLDEN_GENERATED_AT } });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    const sheet = JSON.parse(readExample("planning-statement.sheet.json")) as PivotSheet;
    sheet.cells.forEach((row, r) =>
      row.forEach((src, c) => {
        const cell = ws.getCell(sheet.tableRow + r + 1, c + 1);
        if (cell.isMerged && cell.master.address !== cell.address) return;
        expect(cell.value ?? null).toBe(src.v);
        if (typeof src.v === "number" && src.numFmt) expect(cell.numFmt).toBe(src.numFmt);
      }),
    );
    const income = sheet.cells.findIndex((row) => row[0]?.v === "Operating income");
    expect(ws.getCell(sheet.tableRow + income + 1, sheet.columnCount).value).toBeCloseTo(4110 / 18600, 12);
    // signField on a count is rejected before rendering.
    const bad = { ...spec, measures: [...spec.measures, { id: "n", aggregate: "count", signField: "SIGN" }] } as PivotSpec;
    await expect(exportPivot({ spec: bad, rows, format: "model" })).rejects.toMatchObject({ code: "invalid_input" });
    if (!chromiumAvailable) return;
    const pdf = (await exportPivot({ spec, rows, format: "pdf", options: { generatedAt: GOLDEN_GENERATED_AT } })) as Uint8Array;
    expect(pdfPageCount(pdf)).toBeGreaterThanOrEqual(1);
  }, 60_000);
});

describe("units, format.scale and diagnostics (batch A)", async () => {
  const spec: PivotSpec = {
    version: 1,
    title: "P&L",
    units: "EUR thousands",
    rows: [{ field: "a" }],
    measures: [{ id: "m", field: "v", format: { style: "currency", currency: "EUR", scale: 1000, decimals: 1, negative: "parentheses" } }],
  };
  const rows: PivotDataRow[] = [{ a: "X", v: 12_345 }, { a: "Y", v: -629 }, { a: "Z", v: "1,234.50" }];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await exportPivot({ spec, rows, format: "xlsx" })) as unknown as ArrayBuffer);
  const ws = wb.worksheets[0]!;

  it("keeps real values in cells with Excel scaling commas, and prints the units in the page header", () => {
    // Title and units above the table (rows 1–2), a blank row, the header row 4, data from row 5.
    expect(ws.getCell(1, 1).value).toBe("P&L");
    expect(ws.getCell(2, 1).value).toBe("EUR thousands");
    expect(ws.getCell(5, 2).value).toBe(12_345);
    expect(ws.getCell(5, 2).numFmt).toBe('"€"#,##0.0,;("€"#,##0.0,)');
    expect(ws.headerFooter.oddHeader).toBe("&LP&&L&REUR thousands");
  });

  it("lists the units and diagnostics on the hidden Spec sheet", () => {
    const ss = wb.getWorksheet("Spec")!;
    const pairs: [unknown, unknown][] = [];
    ss.eachRow((row) => pairs.push([row.getCell(1).value, row.getCell(2).value]));
    expect(pairs).toContainEqual(["units", "EUR thousands"]);
    expect(pairs.find(([k]) => k === "diagnostic")?.[1]).toMatch(/^1 value of "v" \(measures\[0\]\.field\) is not a number/);
  });

  it("html prints the scaled text and the units line", async () => {
    const html = (await exportPivot({ spec, rows, format: "html" })) as string;
    expect(html).toContain(">€12.3</td>");
    expect(html).toContain(">(€0.6)</td>");
    expect(html).toContain('data-nqg-units="">EUR thousands</p>');
  });
});

describe("pivotDiagnosticsHeaderValue", () => {
  it("escapes non-ASCII and stays under the header budget (samples dropped first, then entries)", async () => {
    const { pivotDiagnosticsHeaderValue } = await import("../src/exporter");
    const d = { code: "unparsedNumbers" as const, field: "Montant €", path: "measures[0].field", count: 3, samples: [{ row: 1, value: '"1 234,50"' }], message: "3 valeurs de « Montant € » …" };
    const one = pivotDiagnosticsHeaderValue([d]);
    expect(one).toMatch(/^[\x20-\x7e]+$/);
    expect(JSON.parse(one)).toEqual([d]);
    const many = Array.from({ length: 200 }, (_, i) => ({ ...d, field: `f${i}` }));
    const text = pivotDiagnosticsHeaderValue(many, 2000);
    expect(text.length).toBeLessThanOrEqual(2000);
    const parsed = JSON.parse(text) as { samples?: unknown }[];
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.every((x) => x.samples === undefined)).toBe(true);
  });
});

describe("analyst workbook: preamble, outline, print setup, statement rules, formulas (batch B)", async () => {
  const load = async (bytes: Uint8Array | string) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes as Uint8Array) as unknown as ArrayBuffer);
    return wb.worksheets[0]!;
  };
  const filtered = { ...planningSpec, filters: [{ field: "department", include: ["Camp", "Footwear"] }] } as PivotSpec;
  const ws = await load(await exportPivot({ spec: filtered, rows: planningRows, format: "xlsx", options: { generatedAt: GOLDEN_GENERATED_AT } }));
  const sheet = JSON.parse((await exportPivot({ spec: filtered, rows: planningRows, format: "sheet" })) as string) as PivotSheet;

  it("writes title, subtitle and the filters line above the table and freezes below the header rows", () => {
    expect(sheet.preamble?.map((l) => l.role)).toEqual(["title", "filters"]);
    expect(ws.getCell(1, 1).value).toBe(filtered.title);
    expect(ws.getCell(1, 1).font?.bold).toBe(true);
    expect(ws.getCell(2, 1).value).toBe("Filters: Department = Camp, Footwear");
    expect(sheet.tableRow).toBe(3);
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: sheet.tableRow + sheet.frozenRows });
  });

  it("collapsed groups export their rows hidden in a row outline (summary above, + on the group row)", () => {
    const body = sheet.tableRow + sheet.frozenRows; // 0-based sheet row of the first body row
    sheet.bodyRows.forEach((meta, i) => {
      const row = ws.getRow(body + i + 1);
      expect(row.outlineLevel ?? 0).toBe(meta.outlineLevel);
      expect(row.hidden ?? false).toBe(meta.hidden === true);
    });
    const footwear = sheet.bodyRows.findIndex((r, i) => r.kind === "group" && sheet.cells[sheet.frozenRows + i]![0]!.v === "Footwear");
    expect(sheet.bodyRows[footwear]).toMatchObject({ outlineLevel: 0, collapsed: true });
    expect(sheet.bodyRows[footwear + 1]).toMatchObject({ outlineLevel: 1, hidden: true });
    expect(sheet.summaryBelow).toBe(false);
    expect(ws.properties.outlineLevelRow).toBe(1);
  });

  it("print setup: landscape, one page wide, header rows repeated, title and page numbers in header / footer", () => {
    expect(ws.pageSetup).toMatchObject({ orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 });
    expect(ws.pageSetup.printTitlesRow).toBe(`${sheet.tableRow + 1}:${sheet.tableRow + sheet.frozenRows}`);
    expect(ws.headerFooter.oddHeader).toBe(`&L${filtered.title}`);
    expect(ws.headerFooter.oddFooter).toBe(`&L${GOLDEN_GENERATED_AT}&RPage &P of &N`);
  });

  it("repeats tabular row labels (no body merges) unless options.xlsx.rowLabels is merge", async () => {
    expect(sheet.merges.every((m) => m.row < sheet.frozenRows)).toBe(true);
    const merged = JSON.parse((await exportPivot({ spec: filtered, rows: planningRows, format: "sheet", options: { xlsx: { rowLabels: "merge" } } })) as string) as PivotSheet;
    expect(merged.merges.some((m) => m.row >= merged.frozenRows && m.rowSpan > 1)).toBe(true);
  });

  it("statement profile: compact labels indented by alignment, rules above subtotals and a double rule under the grand total", async () => {
    const spec = JSON.parse(readExample("planning-statement.spec.json")) as PivotSpec;
    const rows = JSON.parse(readExample("planning-statement.rows.json")) as PivotDataRow[];
    const out = await exportPivot({ spec, rows, format: "xlsx", options: { profile: "statement" } });
    const st = await load(out);
    const sh = JSON.parse((await exportPivot({ spec, rows, format: "sheet", options: { profile: "statement" } })) as string) as PivotSheet;
    const at = (label: string) => sh.tableRow + sh.cells.findIndex((r) => r[0]!.v === label) + 1;
    expect(st.getCell(at("Revenue"), 1).alignment?.indent).toBe(1);
    const subtotal = sh.tableRow + sh.frozenRows + sh.bodyRows.findIndex((r) => r.kind === "subtotal") + 1;
    expect(st.getCell(subtotal, 2).border?.top?.style).toBe("thin");
    expect(st.getCell(subtotal, 2).font?.bold).toBe(true);
    expect((st.getCell(subtotal, 2).fill as ExcelJS.FillPattern | undefined)?.pattern ?? "none").toBe("none");
    const total = at("Operating income");
    expect(st.getCell(total, 2).border?.bottom?.style).toBe("double");
    // Summary rows below their detail (subtotal: "end"); section headers are one level deeper.
    expect(sh.summaryBelow).toBe(true);
    expect(st.properties.outlineProperties).toMatchObject({ summaryBelow: true });
  });

  it("subtotalFormulas: SUBTOTAL(9, …) on group and grand-total cells of sum measures, with cached values", async () => {
    const plan = { ...filtered, values: ["plan", "growth"] } as PivotSpec;
    const out = await exportPivot({ spec: plan, rows: planningRows, format: "xlsx", options: { xlsx: { subtotalFormulas: true } } });
    const wf = await load(out);
    const sh = JSON.parse((await exportPivot({ spec: plan, rows: planningRows, format: "sheet", options: { xlsx: { subtotalFormulas: true } } })) as string) as PivotSheet;
    // The ratio measure (growth) keeps values.
    expect(sh.cells.flat().filter((c) => c.f !== undefined && c.numFmt?.includes("%"))).toEqual([]);
    const gt = sh.cells.length - 1;
    const cellsWithF = sh.cells[gt]!.filter((c) => c.f !== undefined);
    expect(cellsWithF.length).toBeGreaterThan(0);
    const c = sh.cells[gt]!.findIndex((x) => x.f !== undefined);
    const xc = wf.getCell(sh.tableRow + gt + 1, c + 1);
    expect(xc.value).toMatchObject({ formula: sh.cells[gt]![c]!.f, result: sh.cells[gt]![c]!.v });
    expect(sh.cells[gt]![c]!.f).toMatch(/^SUBTOTAL\(9,[A-Z]+\d+:[A-Z]+\d+\)$/);
    // Leaves stay values.
    expect(sh.cells[sh.frozenRows + 1]!.every((x) => x.f === undefined)).toBe(true);
  });
});

describe("FP&A goldens: measure filters, closing balance, average over time (planning-fpa / planning-fpa-bs)", async () => {
  const rows = JSON.parse(readExample("planning-fpa.rows.json")) as PivotDataRow[];
  const spec = JSON.parse(readExample("planning-fpa.spec.json")) as PivotSpec;
  const bs = JSON.parse(readExample("planning-fpa-bs.spec.json")) as PivotSpec;

  it("model / sheet / html match the golden files", async () => {
    for (const [name, s] of [["planning-fpa", spec], ["planning-fpa-bs", bs]] as const) {
      expect(await exportPivot({ spec: s, rows, format: "model" })).toBe(readExample(`${name}.model.json`));
      expect(await exportPivot({ spec: s, rows, format: "sheet" })).toBe(readExample(`${name}.sheet.json`));
      expect(await exportPivot({ spec: s, rows, format: "html", options: { generatedAt: GOLDEN_GENERATED_AT } })).toBe(readExample(`${name}.html`));
    }
  });

  it("statement xlsx: units in the preamble and page header, real values with scaled numFmt, outline below", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await exportPivot({ spec, rows, format: "xlsx", options: { profile: "statement", generatedAt: GOLDEN_GENERATED_AT } })) as unknown as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    expect([1, 2, 3].map((r) => ws.getCell(r, 1).value)).toEqual([spec.title, spec.subtitle, "USD thousands"]);
    expect(ws.getCell(4, 1).value).toBe("Filters: Kind = flow");
    expect(ws.headerFooter.oddHeader).toBe("&LManagement P&&L: budget vs actual&RUSD thousands");
    const sheet = JSON.parse((await exportPivot({ spec, rows, format: "sheet", options: { profile: "statement" } })) as string) as PivotSheet;
    const gt = sheet.tableRow + sheet.cells.length;
    expect(ws.getCell(gt, 1).value).toBe("Operating income");
    expect(ws.getCell(gt, 2).value).toBe(99_619); // Q1 actual operating income (real value; Excel shows $99.6)
    expect(ws.getCell(gt, 2).numFmt).toBe('"$"#,##0.0,;("$"#,##0.0,)');
    expect(ws.getCell(gt, 2).border?.bottom?.style).toBe("double");
    expect(ws.properties.outlineProperties).toMatchObject({ summaryBelow: true });
    if (!chromiumAvailable) return;
    const pdf = (await exportPivot({ spec: bs, rows, format: "pdf", options: { profile: "statement", generatedAt: GOLDEN_GENERATED_AT } })) as Uint8Array;
    expect(pdfPageCount(pdf)).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
