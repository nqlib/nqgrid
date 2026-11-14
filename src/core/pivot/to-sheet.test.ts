import { describe, expect, it } from "vitest";

import { buildPivotModel } from "./build-model";
import { buildPivotSheet, pivotModelToSheet, pivotSheetColumnLetter, pivotSheetToMatrix, type PivotSheet } from "./to-sheet";
import type { PivotDataRow, PivotSpec } from "./types";

const rows: PivotDataRow[] = [
  { region: "North", dept: "Camp", line: "Tents", v: 10 },
  { region: "North", dept: "Camp", line: "Chairs", v: 20 },
  { region: "North", dept: "Packs", line: "Day", v: 5 },
  { region: "South", dept: "Camp", line: "Tents", v: 7 },
  { region: "South", dept: "Packs", line: "Day", v: 3 },
];
const base: PivotSpec = {
  version: 1,
  title: "Sales",
  subtitle: "FY26",
  units: "units",
  layout: "compact",
  rows: [{ field: "region" }, { field: "dept" }, { field: "line" }],
  measures: [{ id: "v", field: "v" }],
  filters: [{ field: "line", exclude: ["Socks"] }],
};

/** `label|level|flags` per body row. */
const outline = (sheet: PivotSheet) =>
  sheet.bodyRows.map((r, i) => `${sheet.cells[sheet.frozenRows + i]![0]!.v}|${r.outlineLevel}${r.hidden ? "|hidden" : ""}${r.collapsed ? "|collapsed" : ""}`);

describe("pivotModelToSheet: analyst workbook shape", () => {
  it("preamble lines above the table; options override or drop them", () => {
    const sheet = pivotModelToSheet(buildPivotModel(base, rows));
    expect(sheet.preamble).toEqual([
      { text: "Sales", role: "title" },
      { text: "FY26", role: "subtitle" },
      { text: "units", role: "units" },
      { text: "Filters: line ≠ Socks", role: "filters" },
    ]);
    expect(sheet.tableRow).toBe(5);
    const bare = pivotModelToSheet(buildPivotModel({ ...base, filters: [] }, rows), { title: "Other title", subtitle: null, units: null });
    expect(bare.preamble).toEqual([{ text: "Other title", role: "title" }]);
    expect(bare.tableRow).toBe(2);
    expect(pivotModelToSheet(buildPivotModel({ version: 1, rows: [{ field: "dept" }], measures: [{ id: "v", field: "v" }] }, rows)).tableRow).toBe(0);
  });

  it("compact labels carry an indent level instead of leading spaces (matrix output keeps the spaces)", () => {
    const sheet = pivotModelToSheet(buildPivotModel(base, rows));
    expect(sheet.cells[sheet.frozenRows + 2]![0]).toMatchObject({ v: "Tents", indent: 2 });
    expect(pivotSheetToMatrix(sheet)[3]![0]).toBe("    Tents");
    expect(pivotModelToSheet(buildPivotModel(base, rows), { indent: "  " }).cells[3]![0]).toMatchObject({ v: "    Tents" });
  });

  it("collapsed groups: hidden detail rows from the expanded report, + on the group row (summary above)", () => {
    const spec: PivotSpec = { ...base, expanded: [["North"], ["North", "Camp"], ["North", "Packs"]] };
    const { sheet } = buildPivotSheet(spec, rows);
    expect(outline(sheet)).toEqual([
      "North|0",
      "Camp|1",
      "Tents|2",
      "Chairs|2",
      "Packs|1",
      "Day|2",
      "South|0|collapsed",
      "Camp|1|hidden",
      "Tents|2|hidden",
      "Packs|1|hidden",
      "Day|2|hidden",
      "Grand Total|0",
    ]);
    expect(sheet.summaryBelow).toBe(false);
    expect(sheet.outlineLevels).toBe(2);
    // The view without detail drops them (what pivotModelToSheet(model) alone writes).
    expect(pivotModelToSheet(buildPivotModel(spec, rows)).bodyRows).toHaveLength(8);
    expect(pivotSheetToMatrix(sheet).length).toBe(sheet.frozenRows + 8);
    expect(pivotSheetToMatrix(sheet, { includeHidden: true }).length).toBe(sheet.frozenRows + 12);
  });

  it('subtotal: "end": the header is detail of its own group, the subtotal row below is the summary', () => {
    const spec: PivotSpec = { ...base, rows: [{ field: "region", subtotal: "end" }, { field: "dept" }], expanded: [["North"]] };
    const { sheet } = buildPivotSheet(spec, rows);
    expect(outline(sheet)).toEqual([
      "North|1",
      "Camp|1",
      "Packs|1",
      "North Total|0",
      "South|1|hidden",
      "Camp|1|hidden",
      "Packs|1|hidden",
      "South Total|0|collapsed",
      "Grand Total|0",
    ]);
    expect(sheet.summaryBelow).toBe(true);
  });

  it('subtotal: "none": a collapsed group shows the totals of the view row', () => {
    const spec: PivotSpec = { ...base, rows: [{ field: "region", subtotal: "none" }, { field: "dept" }], expanded: [["North"]] };
    const { sheet } = buildPivotSheet(spec, rows);
    const values = sheet.cells.slice(sheet.frozenRows).map((r) => `${r[0]!.v}:${r[1]!.v}`);
    expect(values).toEqual(["North:null", "Camp:30", "Packs:5", "South:10", "Camp:7", "Packs:3", "Grand Total:45"]);
    expect(outline(sheet).slice(3)).toEqual(["South|0|collapsed", "Camp|1|hidden", "Packs|1|hidden", "Grand Total|0"]);
  });

  it("statement profile: rules above subtotal values, thin above and double below the grand total", () => {
    const spec: PivotSpec = { ...base, rows: [{ field: "region", subtotal: "end" }, { field: "dept" }] };
    const sheet = pivotModelToSheet(buildPivotModel(spec, rows), { profile: "statement" });
    expect(sheet.profile).toBe("statement");
    const subtotal = sheet.cells[sheet.frozenRows + 3]!;
    expect(subtotal[0]!.border).toBeUndefined();
    expect(subtotal[1]!.border).toEqual({ top: "thin" });
    expect(sheet.cells.at(-1)!.every((c) => c.border?.bottom === "double" && c.border.top === "thin")).toBe(true);
    expect(pivotModelToSheet(buildPivotModel(spec, rows)).cells.flat().some((c) => c.border)).toBe(false);
  });

  it("subtotalFormulas: SUBTOTAL(9, …) over each group's detail (nested groups skipped by SUBTOTAL), cached values kept", () => {
    const spec: PivotSpec = {
      ...base,
      title: undefined,
      subtitle: undefined,
      units: undefined,
      filters: undefined,
      expanded: [["North"], ["North", "Camp"], ["North", "Packs"]],
      measures: [{ id: "v", field: "v" }, { id: "share", field: "v", showAs: "percentOfGrandTotal" }, { id: "n", aggregate: "count" }],
    };
    const { sheet } = buildPivotSheet(spec, rows, { subtotalFormulas: true });
    expect(sheet.tableRow).toBe(0);
    // Header on Excel row 1, body from row 2: North (2) … Day (7), South (8, collapsed) … (12), Grand Total (13).
    const f = (label: string, col: number) => sheet.cells.find((r) => r[0]!.v === label)![col]!;
    expect(f("North", 1)).toMatchObject({ v: 35, f: "SUBTOTAL(9,B3:B7)" });
    expect(f("South", 1)).toMatchObject({ v: 10, f: "SUBTOTAL(9,B9:B12)" });
    expect(f("Grand Total", 1)).toMatchObject({ v: 45, f: "SUBTOTAL(9,B2:B12)" });
    expect(f("Grand Total", 3)).toMatchObject({ v: 5, f: "SUBTOTAL(9,D2:D12)" });
    expect(f("Grand Total", 2).f).toBeUndefined(); // % of grand total is not additive
    expect(f("Tents", 1).f).toBeUndefined();
    expect(pivotSheetColumnLetter(0)).toBe("A");
    expect(pivotSheetColumnLetter(27)).toBe("AB");
    expect(pivotSheetColumnLetter(701)).toBe("ZZ");
  });

  it("outline levels stop at Excel's 7", () => {
    const deep: PivotDataRow[] = [{ a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1, i: 1, v: 1 }];
    const fields = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    const sheet = pivotModelToSheet(buildPivotModel({ version: 1, rows: fields.map((field) => ({ field })), measures: [{ id: "v", field: "v" }] }, deep));
    expect(Math.max(...sheet.bodyRows.map((r) => r.outlineLevel))).toBe(7);
  });
});
