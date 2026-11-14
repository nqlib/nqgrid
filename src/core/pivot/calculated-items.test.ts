import { describe, expect, it } from "vitest";

import { generateIncomePivotRows, incomePivotSpec } from "../../fixtures/income-pivot-mock";
import { buildPivotModel, createPivotModelBuilder, pivotCellDrillTarget } from "./build-model";
import {
  checkPivotCalculatedItem,
  pivotItemReferencers,
  planPivotCalculatedItem,
  removePivotCalculatedItem,
  setPivotCalculatedItem,
  setPivotSubtotalLabel,
} from "./calculated-items";
import { pivotDrillThrough, pivotSpecDataKey } from "./cube";
import { movePivotField } from "./fields";
import { pivotModelToSheet } from "./to-sheet";
import type { PivotBodyRow, PivotDataRow, PivotModel, PivotSpec } from "./types";
import { validatePivotSpec } from "./validate";

const rowOf = (model: PivotModel, label: string): PivotBodyRow => {
  const row = model.rows.find((r) => r.label === label);
  if (!row) throw new Error(`no row ${label}: ${model.rows.map((r) => r.label).join(", ")}`);
  return row;
};
const values = (model: PivotModel, label: string) => rowOf(model, label).cells.map((c) => c.value);
const texts = (model: PivotModel, label: string) => rowOf(model, label).cells.map((c) => c.text);
const outline = (model: PivotModel) => model.rows.map((r) => `${r.kind}:${"  ".repeat(Math.max(0, r.depth))}${r.label}`);

describe("income statement recipe (docs/pivot-recipes.md, calculated items)", () => {
  const model = buildPivotModel(incomePivotSpec, generateIncomePivotRows());

  it("places sections, subtotals, calculated items and the grand total in statement order", () => {
    expect(outline(model)).toEqual([
      "group:Revenue",
      "leaf:  Product revenue",
      "leaf:  Services revenue",
      "subtotal:Total revenue",
      "group:Cost of sales",
      "leaf:  COGS",
      "subtotal:Total cost of sales",
      "calculated:Gross margin",
      "calculated:Gross margin %",
      "group:Operating expenses",
      "leaf:  Salaries",
      "leaf:  Rent",
      "subtotal:Total operating expenses",
      "calculated:EBITDA",
      "group:Depreciation & amortization",
      "leaf:  Depreciation",
      "subtotal:Total depreciation & amortization",
      "grandTotal:Operating income",
    ]);
    expect(model.columns.map((c) => c.columnLabel)).toEqual(["Q1", "Q2", "Q3", "Q4", "FY 2026"]);
  });

  it("matches the result table of the recipe", () => {
    expect(texts(model, "Total revenue")).toEqual(["3,090", "3,360", "3,630", "3,900", "13,980"]);
    expect(texts(model, "Total cost of sales")).toEqual(["(1,245)", "(1,380)", "(1,515)", "(1,650)", "(5,790)"]);
    expect(texts(model, "Gross margin")).toEqual(["1,845", "1,980", "2,115", "2,250", "8,190"]);
    expect(texts(model, "Gross margin %")).toEqual(["59.7%", "58.9%", "58.3%", "57.7%", "58.6%"]);
    expect(texts(model, "Total operating expenses")).toEqual(["(900)", "(900)", "(900)", "(900)", "(3,600)"]);
    expect(texts(model, "EBITDA")).toEqual(["945", "1,080", "1,215", "1,350", "4,590"]);
    expect(texts(model, "Total depreciation & amortization")).toEqual(["(120)", "(120)", "(120)", "(120)", "(480)"]);
    // Items are left out of the grand total: Operating income = the four sections, not + Gross margin + EBITDA.
    expect(texts(model, "Operating income")).toEqual(["825", "960", "1,095", "1,230", "4,110"]);
  });

  it("evaluates the formula over the totals in the total column (Excel), not a sum of results", () => {
    const pct = values(model, "Gross margin %");
    expect(pct[4]).toBeCloseTo(8190 / 13980, 12);
    expect(pct[4]).not.toBeCloseTo((pct[0]! + pct[1]! + pct[2]! + pct[3]!) / 4, 6);
  });

  it("describes calculated rows (id, path, formula, format)", () => {
    const gm = rowOf(model, "Gross margin %");
    expect(gm).toMatchObject({
      id: "i:Gross%20margin%20%25",
      kind: "calculated",
      depth: 0,
      path: ["Gross margin %"],
      expandable: false,
      childCount: 0,
      sourceRowCount: 0,
      formula: "[Gross margin] / [Revenue]",
      format: { style: "percent", decimals: 1 },
      excelNumFmt: "#,##0.0%",
    });
    expect(rowOf(model, "Gross margin").format).toBeUndefined();
    expect(model.diagnostics).toBeUndefined();
  });

  it("supports the recipe's alternatives: % of Revenue on every row, a leaf-level item, per-key formats", () => {
    const rows = generateIncomePivotRows();
    const pct: PivotSpec = {
      ...incomePivotSpec,
      measures: [...incomePivotSpec.measures, { id: "pct", field: "AMOUNT", showAs: "percentOf", showAsBase: { field: "SECTION", item: "Revenue", scope: "all" }, percentFormat: { style: "percent", decimals: 1 } }],
      values: ["amount", "pct"],
    };
    const withPct = buildPivotModel(pct, rows);
    const col = withPct.columns.findIndex((c) => c.measureId === "pct" && c.columnKey === "Q1");
    expect(rowOf(withPct, "Gross margin").cells[col]!.text).toBe("59.7%");
    expect(rowOf(withPct, "EBITDA").cells[col]!.value).toBeCloseTo(945 / 3090, 12);
    expect(rowOf(withPct, "Operating income").cells[col]!.value).toBeCloseTo(825 / 3090, 12);
    const leaf: PivotSpec = {
      ...incomePivotSpec,
      rows: [incomePivotSpec.rows[0]!, { ...incomePivotSpec.rows[1]!, calculatedItems: [{ key: "Mix", formula: "[Product revenue] - [Services revenue]" }], itemFormats: { Rent: { decimals: 1 } } }],
    };
    const leafModel = buildPivotModel(leaf, rows);
    expect(leafModel.rows.filter((r) => r.label === "Mix").map((r) => r.path)).toEqual([["Revenue", "Mix"]]);
    expect(values(leafModel, "Mix")).toEqual([1830, 1920, 2010, 2100, 7860]);
    // An item format replaces the column format (no parentheses unless it asks for them).
    expect(texts(leafModel, "Rent")[0]).toBe("-150.0");
  });

  it("is view-only: items reuse the cached cube", () => {
    const plain: PivotSpec = { ...incomePivotSpec, rows: [{ ...incomePivotSpec.rows[0]!, calculatedItems: undefined, subtotalLabels: undefined }, incomePivotSpec.rows[1]!] };
    expect(pivotSpecDataKey(plain)).toBe(pivotSpecDataKey(incomePivotSpec));
  });
});

/** Two-level data: REGION → CITY, measure SALES / COST / CUST, by QUARTER. */
const salesRows: PivotDataRow[] = [
  { REGION: "EMEA", CITY: "Berlin", Q: "Q1", SALES: 100, COST: 60, CUST: "a" },
  { REGION: "EMEA", CITY: "Berlin", Q: "Q2", SALES: 120, COST: 70, CUST: "b" },
  { REGION: "EMEA", CITY: "Paris", Q: "Q1", SALES: 80, COST: 50, CUST: "a" },
  { REGION: "EMEA", CITY: "Paris", Q: "Q2", SALES: 40, COST: 30, CUST: "c" },
  { REGION: "APAC", CITY: "Tokyo", Q: "Q1", SALES: 200, COST: 90, CUST: "d" },
  { REGION: "APAC", CITY: "Tokyo", Q: "Q2", SALES: 220, COST: 100, CUST: "d" },
];
const salesSpec = (patch: Partial<PivotSpec> = {}, cityItems?: PivotSpec["rows"][number]["calculatedItems"]): PivotSpec => ({
  version: 1,
  rows: [{ field: "REGION" }, { field: "CITY", ...(cityItems ? { calculatedItems: cityItems } : {}) }],
  columns: { field: "Q" },
  measures: [{ id: "sales", field: "SALES" }],
  totals: { rowTotal: true },
  ...patch,
});

describe("calculated items: semantics", () => {
  it("evaluates leaf-level items per parent over sibling keys, shown only where a referenced key exists", () => {
    const model = buildPivotModel(salesSpec({}, [{ key: "Berlin - Paris", formula: "[Berlin] - [Paris]" }]), salesRows);
    expect(outline(model)).toEqual([
      "group:EMEA",
      "leaf:  Berlin",
      "leaf:  Paris",
      "calculated:  Berlin - Paris",
      "group:APAC",
      "leaf:  Tokyo",
      "grandTotal:Grand Total",
    ]);
    expect(rowOf(model, "Berlin - Paris").path).toEqual(["EMEA", "Berlin - Paris"]);
    expect(values(model, "Berlin - Paris")).toEqual([20, 80, 100]);
    // Not in the EMEA subtotal nor the grand total.
    expect(values(model, "EMEA")).toEqual([180, 160, 340]);
    expect(values(model, "Grand Total")).toEqual([380, 380, 760]);
  });

  it("shows items that read no key (constants) under every parent", () => {
    const model = buildPivotModel(salesSpec({}, [{ key: "Target", formula: "150", position: "start" }]), salesRows);
    expect(outline(model)).toEqual([
      "group:EMEA",
      "calculated:  Target",
      "leaf:  Berlin",
      "leaf:  Paris",
      "group:APAC",
      "calculated:  Target",
      "leaf:  Tokyo",
      "grandTotal:Grand Total",
    ]);
    expect(values(model, "Target")).toEqual([150, 150, 150]);
  });

  it("propagates null for missing keys; coalesce turns them into 0", () => {
    const spec = salesSpec({ filters: [{ field: "CITY", exclude: ["Paris"] }] }, [
      { key: "Strict", formula: "[Berlin] - [Paris]" },
      { key: "Lenient", formula: "[Berlin] - coalesce([Paris], 0)" },
    ]);
    const model = buildPivotModel(spec, salesRows);
    expect(values(model, "Strict")).toEqual([null, null, null]);
    expect(values(model, "Lenient")).toEqual([100, 120, 220]);
    // Every key an item reads filtered out: the item is not shown.
    const none = buildPivotModel(salesSpec({ filters: [{ field: "CITY", include: ["Tokyo"] }] }, [{ key: "Strict", formula: "[Berlin] - [Paris]" }]), salesRows);
    expect(none.rows.some((r) => r.kind === "calculated")).toBe(false);
  });

  it("includeInTotals adds the item into its parent's subtotal and every total above (Excel)", () => {
    const spec = salesSpec({ measures: [{ id: "sales", field: "SALES" }, { id: "cost", field: "COST" }, { id: "margin", calculate: "sales / cost" }] }, [
      { key: "Adjustment", formula: "10", includeInTotals: true },
    ]);
    const model = buildPivotModel(spec, salesRows);
    // Columns: Q1 sales, Q1 cost, Q1 margin, Q2 …, Total …
    const at = (label: string, i: number) => values(model, label)[i];
    expect(at("Adjustment", 0)).toBe(10); // two items (EMEA, APAC) of 10 each
    expect(at("EMEA", 0)).toBe(180 + 10);
    expect(at("APAC", 0)).toBe(200 + 10);
    expect(at("Grand Total", 0)).toBe(380 + 20);
    // Calculated measures on adjusted totals re-evaluate over the adjusted references.
    expect(at("Grand Total", 2)).toBeCloseTo((380 + 20) / (200 + 20), 12);
    expect(at("Adjustment", 2)).toBeCloseTo(1, 12);
    // Column total of the item and KPIs follow too.
    expect(at("Grand Total", 6)).toBe(760 + 20);
  });

  it("keeps anchored positions whatever sortBy / Top N do to the data keys", () => {
    const spec: PivotSpec = {
      ...salesSpec({ columns: undefined }),
      rows: [
        {
          field: "CITY",
          sortBy: { measure: "sales", direction: "asc" },
          calculatedItems: [
            { key: "Last", formula: "1", position: "end" },
            { key: "First", formula: "2", position: "start" },
            { key: "After Berlin", formula: "[Berlin] * 2", after: "Berlin" },
            { key: "Before Tokyo", formula: "[Tokyo] / 2", before: "Tokyo" },
            { key: "After item", formula: "[After Berlin] + 1", after: "After Berlin" },
            { key: "Lost anchor", formula: "3", after: "Madrid" },
          ],
        },
      ],
    };
    const model = buildPivotModel(spec, salesRows);
    expect(model.rows.map((r) => r.label)).toEqual(["First", "Paris", "Berlin", "After Berlin", "After item", "Before Tokyo", "Tokyo", "Last", "Lost anchor", "Grand Total"]);
    expect(values(model, "After item")).toEqual([441]);
    expect(model.diagnostics?.map((d) => [d.code, d.path, d.items])).toEqual([["itemKeyNotFound", "rows[0].calculatedItems[5].after", ["Madrid"]]]);
    // Top N cuts Paris: an item reading only Paris disappears, the others stay anchored.
    const top = buildPivotModel(
      { ...spec, rows: [{ ...spec.rows[0]!, topN: { measure: "sales", count: 2 }, calculatedItems: [{ key: "Paris x2", formula: "[Paris] * 2" }, { key: "Tokyo x2", formula: "[Tokyo] * 2", before: "Berlin" }] }] },
      salesRows,
    );
    expect(top.rows.map((r) => r.label)).toEqual(["Tokyo x2", "Berlin", "Tokyo", "Grand Total"]);
  });

  it("evaluates calculated measures over the item's values of the measures they reference", () => {
    const spec = salesSpec({ measures: [{ id: "sales", field: "SALES" }, { id: "cost", field: "COST" }, { id: "margin", calculate: "(sales - cost) / sales" }] }, [
      { key: "Berlin + Paris", formula: "[Berlin] + [Paris]" },
    ]);
    const model = buildPivotModel(spec, salesRows);
    const row = values(model, "Berlin + Paris");
    expect(row.slice(0, 3)).toEqual([180, 110, expect.closeTo(70 / 180, 12)]);
    // Not the sum of the two cities' margins.
    expect(row[2]).not.toBeCloseTo((40 / 100) + (30 / 80), 6);
  });

  it("applies non-additive aggregates' item values the same way (formula over the items' values)", () => {
    const spec = salesSpec({ measures: [{ id: "cust", field: "CUST", aggregate: "distinctCount" }] }, [{ key: "Both", formula: "[Berlin] + [Paris]" }]);
    const model = buildPivotModel(spec, salesRows);
    // Berlin {a} + Paris {a} in Q1 = 2 (the EMEA group counts 1 distinct customer).
    expect(values(model, "Both")).toEqual([2, 2, 4]);
    expect(values(model, "EMEA")).toEqual([1, 2, 3]);
  });

  it("applies showAs where an item has a base, and leaves row-field bases empty", () => {
    const measures: PivotSpec["measures"] = [
      { id: "sales", field: "SALES" },
      { id: "pctCol", field: "SALES", showAs: "percentOfColumnTotal" },
      { id: "pctRow", field: "SALES", showAs: "percentOfRowTotal" },
      { id: "pctParent", field: "SALES", showAs: "percentOfParentRow" },
      { id: "diffQ", field: "SALES", showAs: "differenceFrom", showAsBase: { field: "Q" } },
      { id: "runCity", field: "SALES", showAs: "runningTotal", showAsBase: { field: "CITY" } },
      { id: "runRegion", field: "SALES", groupShowAs: "runningTotal", showAsBase: { field: "REGION" } },
      { id: "pctBerlin", field: "SALES", showAs: "percentOf", showAsBase: { field: "CITY", item: "Berlin", scope: "all" } },
    ];
    const model = buildPivotModel(salesSpec({ measures, valuesIndex: 0 }, [{ key: "Both", formula: "[Berlin] + [Paris]" }]), salesRows);
    const cell = (measureId: string, columnKey: string | null) => {
      const i = model.columns.findIndex((c) => c.measureId === measureId && c.columnKey === columnKey);
      return rowOf(model, "Both").cells[i]!;
    };
    expect(cell("sales", "Q1").value).toBe(180);
    expect(cell("pctCol", "Q1").value).toBeCloseTo(180 / 380, 12);
    expect(cell("pctRow", "Q1").value).toBeCloseTo(180 / 340, 12);
    expect(cell("pctParent", "Q1").value).toBeCloseTo(180 / 180, 12);
    expect(cell("diffQ", "Q2").value).toBe(160 - 180);
    expect(cell("diffQ", "Q1").value).toBeNull();
    expect(cell("runCity", "Q1")).toMatchObject({ value: null, raw: 180, showAs: "runningTotal" });
    // A leaf-level item reads the leaf showAs (value) of runRegion.
    expect(cell("runRegion", "Q1").value).toBe(180);
    expect(cell("pctBerlin", "Q1").value).toBeCloseTo(180 / 100, 12);
  });

  it("gets no heat, and leaves heat domains to data rows", () => {
    const spec = salesSpec({ heat: { scope: "all" } }, [{ key: "Huge", formula: "[Berlin] * 1000" }]);
    const model = buildPivotModel(spec, salesRows);
    expect(rowOf(model, "Huge").cells.every((c) => c.heat === undefined)).toBe(true);
    expect(rowOf(model, "Tokyo").cells[1]!.heat).toBe(8);
  });

  it("hides items of collapsed parents and keeps outer-level items visible", () => {
    const spec: PivotSpec = {
      ...salesSpec({ expanded: [] }, [{ key: "Both", formula: "[Berlin] + [Paris]" }]),
      rows: [{ field: "REGION", calculatedItems: [{ key: "EMEA - APAC", formula: "EMEA - APAC" }] }, { field: "CITY", calculatedItems: [{ key: "Both", formula: "[Berlin] + [Paris]" }] }],
    };
    const model = buildPivotModel(spec, salesRows);
    expect(outline(model)).toEqual(["group:EMEA", "group:APAC", "calculated:EMEA - APAC", "grandTotal:Grand Total"]);
    expect(values(model, "EMEA - APAC")).toEqual([-20, -60, -80]);
  });

  it("drill-through of an item cell lists the records of the keys it reads", () => {
    const spec = salesSpec({}, [
      { key: "Both", formula: "[Berlin] + [Paris]" },
      { key: "Twice", formula: "[Both] * 2" },
    ]);
    const model = buildPivotModel(spec, salesRows);
    const row = rowOf(model, "Twice");
    const result = pivotDrillThrough(spec, salesRows, pivotCellDrillTarget(model, row, 0));
    expect(result.indices).toEqual([0, 2]);
    expect(pivotDrillThrough(spec, salesRows, { path: ["EMEA", "Both"] }).total).toBe(4);
    const constant = salesSpec({}, [{ key: "Target", formula: "150" }]);
    expect(pivotDrillThrough(constant, salesRows, { path: ["EMEA", "Target"] }).total).toBe(0);
  });

  it("treats keys as opaque strings: __proto__ / constructor work as data keys and item keys", () => {
    const rows: PivotDataRow[] = [
      { K: "__proto__", V: 5 },
      { K: "constructor", V: 7 },
      { K: "toString", V: 11 },
    ];
    const spec = JSON.parse(
      JSON.stringify({
        version: 1,
        rows: [{ field: "K", calculatedItems: [{ key: "prototype", formula: "[__proto__] + [constructor] + toString" }] }],
        measures: [{ id: "v", field: "V" }],
      }),
    ) as PivotSpec;
    // Labels and formats keyed by internals (JSON.parse makes "__proto__" an own key).
    const withMaps = JSON.parse(
      '{"version":1,"rows":[{"field":"K","subtotal":"end","subtotalLabels":{"__proto__":"P"},"itemFormats":{"__proto__":{"decimals":2}},"calculatedItems":[{"key":"prototype","formula":"[__proto__] + [constructor] + toString"}]}],"measures":[{"id":"v","field":"V"}]}',
    ) as PivotSpec;
    expect(validatePivotSpec(spec).ok).toBe(true);
    const model = buildPivotModel(spec, rows);
    expect(values(model, "prototype")).toEqual([23]);
    const formatted = buildPivotModel(withMaps, rows);
    expect(texts(formatted, "__proto__")).toEqual(["5.00"]);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    // An item named after a data key shadows it in formulas and is reported.
    const clash = buildPivotModel({ ...spec, rows: [{ field: "K", calculatedItems: [{ key: "constructor", formula: "[__proto__] * 2" }, { key: "x", formula: "[constructor] + 1" }] }] }, rows);
    expect(values(clash, "x")).toEqual([11]);
    expect(clash.diagnostics?.map((d) => d.code)).toEqual(["itemKeyConflict"]);
  });

  it("reports keys the data does not have (formula references, anchors, labels, formats)", () => {
    const spec: PivotSpec = {
      ...salesSpec(),
      rows: [
        { field: "REGION", subtotalLabels: { EMEA: "Europe", LATAM: "Latin America" }, itemFormats: { Mars: { decimals: 1 } } },
        { field: "CITY", calculatedItems: [{ key: "X", formula: "[Berlin] - [Berlinn] + [Y]" }, { key: "Y", formula: "1", before: "Rome" }] },
      ],
    };
    const model = buildPivotModel(spec, salesRows);
    expect(model.diagnostics?.map((d) => [d.code, d.path, d.items])).toEqual([
      ["itemKeyNotFound", "rows[0].subtotalLabels", ["LATAM"]],
      ["itemKeyNotFound", "rows[0].itemFormats", ["Mars"]],
      ["itemKeyNotFound", "rows[1].calculatedItems[0].formula", ["Berlinn"]],
      ["itemKeyNotFound", "rows[1].calculatedItems[1].before", ["Rome"]],
    ]);
    expect(model.diagnostics?.[2]?.message).toBe(
      'rows[1].calculatedItems[0].formula names "Berlinn", which is not a value of "CITY" nor calculated items (keys compare as case-sensitive strings); they read as no value.',
    );
  });
});

describe("per-group subtotal labels and item formats", () => {
  it("labels subtotal rows and columns per group, with {label}", () => {
    const spec: PivotSpec = {
      version: 1,
      rows: [{ field: "REGION", subtotal: "end", subtotalLabel: "{label} total", subtotalLabels: { EMEA: "Total Europe ({label})" } }, { field: "CITY" }],
      columns: [{ field: "Q", subtotalLabels: {} }, { field: "CUST" }],
      measures: [{ id: "sales", field: "SALES" }],
    };
    const model = buildPivotModel({ ...spec, columns: [{ field: "Q", subtotalLabels: { Q1: "First quarter" } }, { field: "CUST" }] }, salesRows);
    expect(model.rows.filter((r) => r.kind === "subtotal").map((r) => r.label)).toEqual(["Total Europe (EMEA)", "APAC total"]);
    expect(model.columns.filter((c) => c.subtotal).map((c) => c.columnLabel)).toEqual(["First quarter", "Q2 Total"]);
  });

  it("formats a key's rows with itemFormats (value cells only) and carries the Excel format to the sheet", () => {
    const spec: PivotSpec = {
      version: 1,
      rows: [{ field: "REGION", subtotal: "end", itemFormats: { APAC: { decimals: 2, suffix: " u" } } }, { field: "CITY", itemFormats: { Paris: { style: "percent" } } }],
      measures: [{ id: "sales", field: "SALES" }, { id: "share", field: "SALES", showAs: "percentOfGrandTotal" }],
    };
    const model = buildPivotModel(spec, salesRows);
    expect(texts(model, "APAC Total")).toEqual(["420.00 u", "55%"]);
    expect(texts(model, "Tokyo")).toEqual(["420", "55%"]);
    expect(texts(model, "Paris")).toEqual(["12,000%", "16%"]);
    expect(rowOf(model, "APAC Total")).toMatchObject({ format: { decimals: 2, suffix: ' u' }, excelNumFmt: expect.any(String) });
    const sheet = pivotModelToSheet(model);
    const body = sheet.cells.slice(sheet.frozenRows);
    const paris = body[model.rows.findIndex((r) => r.label === "Paris")]!;
    const first = sheet.rowHeaderColumnCount;
    expect(paris[first]!.numFmt).toBe(rowOf(model, "Paris").excelNumFmt);
    expect(paris[first + 1]!.numFmt).toBe(model.columns[1]!.excelPercentNumFmt);
  });
});

describe("calculated items in sheets and static output", () => {
  const model = buildPivotModel(incomePivotSpec, generateIncomePivotRows());

  it("writes item rows bold with a statement rule, the item's numFmt, and no SUBTOTAL over them", () => {
    const sheet = pivotModelToSheet(model, { profile: "statement", subtotalFormulas: true, spec: incomePivotSpec });
    const at = (label: string) => sheet.cells[sheet.frozenRows + model.rows.findIndex((r) => r.label === label)]!;
    expect(at("Gross margin %")[1]).toMatchObject({ v: expect.closeTo(1845 / 3090, 12), numFmt: "#,##0.0%", bold: true, role: "group", border: { top: "thin" } });
    expect(at("Gross margin")[1]!.f).toBeUndefined();
    // Section subtotals keep their formulas (no item inside), the grand total keeps values (items at level 0).
    expect(at("Total revenue")[1]!.f).toMatch(/^SUBTOTAL\(9,/);
    expect(at("Operating income")[1]!.f).toBeUndefined();
    expect(sheet.bodyRows[model.rows.findIndex((r) => r.label === "EBITDA")]).toMatchObject({ kind: "calculated", outlineLevel: 0 });
  });

  it("lays out tabular dimension slots for item rows at their own level", async () => {
    const { pivotDimensionSlots } = await import("../../pivot/layout");
    const tabular = buildPivotModel({ ...salesSpec({}, [{ key: "Both", formula: "[Berlin] + [Paris]" }]), layout: "tabular" }, salesRows);
    const slots = pivotDimensionSlots(tabular);
    const i = tabular.rows.findIndex((r) => r.label === "Both");
    expect(slots[i]).toEqual([{ type: "covered", level: 0 }, { type: "calculated", level: 1 }]);
    expect(tabular.spans[0]![0]).toEqual({ rowIndex: 0, span: 4, path: ["EMEA"] });
  });
});

describe("calculated item spec helpers", () => {
  const spec = salesSpec();

  it("adds, edits (renaming references) and removes items", () => {
    let next = setPivotCalculatedItem(spec, "CITY", { key: "Both", formula: "[Berlin] + [Paris]" });
    next = setPivotCalculatedItem(next, "CITY", { key: "Twice", formula: "Both * 2 + [Both]", after: "Both" });
    expect(next.rows[1]!.calculatedItems).toEqual([
      { key: "Both", formula: "[Berlin] + [Paris]" },
      { key: "Twice", formula: "Both * 2 + [Both]", after: "Both" },
    ]);
    const renamed = setPivotCalculatedItem(next, "CITY", { key: "Berlin and Paris", formula: "[Berlin] + [Paris]" }, "Both");
    expect(renamed.rows[1]!.calculatedItems).toEqual([
      { key: "Berlin and Paris", formula: "[Berlin] + [Paris]" },
      { key: "Twice", formula: "[Berlin and Paris] * 2 + [Berlin and Paris]", after: "Berlin and Paris" },
    ]);
    expect(validatePivotSpec(renamed).ok).toBe(true);
    expect(pivotItemReferencers(renamed, "CITY", "Berlin and Paris")).toEqual(["Twice"]);
    // Refused while referenced; allowed once the referencer is gone.
    expect(removePivotCalculatedItem(renamed, "CITY", "Berlin and Paris")).toBe(renamed);
    const removed = removePivotCalculatedItem(removePivotCalculatedItem(renamed, "CITY", "Twice"), "CITY", "Berlin and Paris");
    expect(removed.rows[1]).toEqual({ field: "CITY" });
  });

  it("refuses invalid items with the reason", () => {
    expect(checkPivotCalculatedItem(spec, "Q", { key: "x", formula: "1" })?.code).toBe("notRowField");
    expect(checkPivotCalculatedItem(spec, "CITY", { key: "x", formula: "[Berlin] +" })).toMatchObject({ code: "unexpectedEnd", position: 10 });
    const one = setPivotCalculatedItem(spec, "CITY", { key: "a", formula: "[b] + 1" });
    expect(checkPivotCalculatedItem(one, "CITY", { key: "b", formula: "[a] * 2" })).toMatchObject({ code: "cycle", message: "reference cycle a → b → a" });
    expect(checkPivotCalculatedItem(one, "CITY", { key: "a", formula: "1" })?.code).toBe("keyTaken");
    expect(checkPivotCalculatedItem(one, "CITY", { key: "a", formula: "1" }, "a")).toBeNull();
    expect(planPivotCalculatedItem(one, "CITY", { key: "", formula: "1" }).error?.code).toBe("emptyKey");
  });

  it("sets per-group subtotal labels and strips row-only keys on the way into Columns", () => {
    const labelled = setPivotSubtotalLabel(spec, "REGION", "EMEA", "Total Europe");
    expect(labelled.rows[0]).toEqual({ field: "REGION", subtotalLabels: { EMEA: "Total Europe" } });
    expect(setPivotSubtotalLabel(labelled, "REGION", "EMEA", null).rows[0]).toEqual({ field: "REGION" });
    const withItems = setPivotCalculatedItem({ ...spec, rows: [...spec.rows, { field: "CUST", itemFormats: { a: { decimals: 1 } } }] }, "CUST", { key: "ab", formula: "a + b" });
    const moved = movePivotField(withItems, { field: "CUST", from: "rows", to: "columns" });
    expect(validatePivotSpec(moved).ok).toBe(true);
    expect(JSON.stringify(moved.columns)).not.toContain("calculatedItems");
  });

  it("keeps the cube when only items change (builder reuse)", () => {
    const builder = createPivotModelBuilder();
    const a = builder.build(spec, salesRows);
    const b = builder.build(setPivotCalculatedItem(spec, "CITY", { key: "Both", formula: "[Berlin] + [Paris]" }), salesRows);
    expect(b.rows.length).toBe(a.rows.length + 1);
  });
});
