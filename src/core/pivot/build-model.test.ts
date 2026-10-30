import { describe, expect, it } from "vitest";

import { buildPivotModel, pivotPathId } from "./build-model";
import { setPivotExpandedAll, setPivotHeatScope, togglePivotGroup } from "./interaction";
import { computePivotRowSpans } from "./row-spans";
import { pivotModelToSheet, pivotSheetToMatrix } from "./to-sheet";
import type { PivotSpec } from "./types";

const data = [
  { dept: "Camp", line: "Tents", month: "Nov", sales: 300, plan: 280, owner: "Ingrid" },
  { dept: "Camp", line: "Tents", month: "Dec", sales: 400, plan: 420, owner: "Ingrid" },
  { dept: "Camp", line: "Chairs", month: "Nov", sales: 100, plan: 100, owner: "Ingrid" },
  { dept: "Footwear", line: "Boots", month: "Nov", sales: 600, plan: 500, owner: null },
  { dept: "Footwear", line: "Boots", month: "Dec", sales: 200, plan: 250, owner: "Maya" },
  { dept: "Footwear", line: "Boots", month: "Dec", sales: 50, plan: 0, owner: "Maya" },
];

const base: PivotSpec = {
  version: 1,
  rows: [{ field: "dept", label: "Department", attributes: ["owner"] }, { field: "line", label: "Line" }],
  columns: { field: "month", label: "Month", order: ["Nov", "Dec", "Jan"] },
  measures: [
    { id: "sales", field: "sales", label: "Sales" },
    { id: "plan", field: "plan", label: "Plan" },
  ],
  values: ["sales"],
};

const texts = (row: { cells: readonly { text: string }[] }) => row.cells.map((c) => c.text);

describe("buildPivotModel — structure", () => {
  it("groups in first-seen order with subtotals and a grand total", () => {
    const m = buildPivotModel(base, data);
    expect(m.rows.map((r) => `${r.kind}:${r.path.join(">")}`)).toEqual([
      "group:Camp",
      "leaf:Camp>Tents",
      "leaf:Camp>Chairs",
      "group:Footwear",
      "leaf:Footwear>Boots",
      "grandTotal:",
    ]);
    expect(m.columnKeys.map((k) => k.key)).toEqual(["Nov", "Dec"]);
    expect(texts(m.rows[0]!)).toEqual(["400", "400"]);
    expect(texts(m.rows[4]!)).toEqual(["600", "250"]);
    expect(texts(m.grandTotal)).toEqual(["1,000", "650"]);
    expect(m.rows[0]!.childCount).toBe(2);
    expect(m.rows[0]!.attributes).toEqual({ owner: "Ingrid" });
    expect(m.rows[3]!.attributes).toEqual({ owner: "Maya" });
  });

  it("leaves empty buckets as null and keeps ordered empty columns on request", () => {
    const m = buildPivotModel({ ...base, columns: { ...base.columns!, keepEmpty: true } }, data);
    expect(m.columnKeys.map((k) => k.key)).toEqual(["Nov", "Dec", "Jan"]);
    const chairs = m.rows.find((r) => r.label === "Chairs")!;
    expect(chairs.cells.map((c) => c.value)).toEqual([100, null, null]);
  });

  it("sorts keys and labels blanks", () => {
    const m = buildPivotModel(
      { ...base, rows: [{ field: "dept", sort: "desc", blankLabel: "Unassigned" }, { field: "line", sort: "asc" }] },
      [...data, { dept: null, line: "X", month: "Nov", sales: 1 }],
    );
    expect(m.rows.filter((r) => r.kind === "group").map((r) => r.label)).toEqual(["Footwear", "Camp", "Unassigned"]);
    expect(m.rows.filter((r) => r.path[0] === "Camp" && r.kind === "leaf").map((r) => r.label)).toEqual([
      "Chairs",
      "Tents",
    ]);
  });

  it("builds two header rows for multiple measures plus row totals", () => {
    const m = buildPivotModel({ ...base, values: ["sales", "plan"], totals: { rowTotal: true } }, data);
    expect(m.columns.map((c) => c.id)).toEqual([
      "c:Nov:sales",
      "c:Nov:plan",
      "c:Dec:sales",
      "c:Dec:plan",
      "t:sales",
      "t:plan",
    ]);
    expect(m.headerRows[0]!.map((h) => [h.label, h.colSpan])).toEqual([
      ["Nov", 2],
      ["Dec", 2],
      ["Total", 2],
    ]);
    expect(m.headerRows[1]!.map((h) => h.label)).toEqual(["Sales", "Plan", "Sales", "Plan", "Sales", "Plan"]);
    expect(m.grandTotal.cells.at(-2)!.value).toBe(1650);
  });

  it("works without a column dimension", () => {
    const m = buildPivotModel({ ...base, columns: undefined, values: ["sales", "plan"] }, data);
    expect(m.columns.map((c) => c.id)).toEqual(["m:sales", "m:plan"]);
    expect(m.headerRows).toEqual([
      [
        { label: "Sales", colSpan: 1, columnKey: null, measureId: "sales" },
        { label: "Plan", colSpan: 1, columnKey: null, measureId: "plan" },
      ],
    ]);
    expect(m.grandTotal.cells.map((c) => c.value)).toEqual([1650, 1550]);
  });

  it("treats a single row dimension as leaves", () => {
    const m = buildPivotModel({ ...base, rows: [{ field: "dept" }] }, data);
    expect(m.rows.map((r) => r.kind)).toEqual(["leaf", "leaf", "grandTotal"]);
  });
});

describe("buildPivotModel — show values as", () => {
  it("percentOfColumnTotal on groups, values on leaves", () => {
    const spec: PivotSpec = {
      ...base,
      measures: [{ id: "sales", field: "sales", groupShowAs: "percentOfColumnTotal" }],
    };
    const m = buildPivotModel(spec, data);
    expect(texts(m.rows[0]!)).toEqual(["40%", "62%"]);
    expect(m.rows[0]!.cells[0]).toMatchObject({ raw: 400, value: 0.4, showAs: "percentOfColumnTotal" });
    expect(texts(m.rows[1]!)).toEqual(["300", "400"]);
    expect(texts(m.grandTotal)).toEqual(["100%", "100%"]);
  });

  it("percentOfParentRow / percentOfRowTotal / percentOfGrandTotal", () => {
    const of = (showAs: "percentOfParentRow" | "percentOfRowTotal" | "percentOfGrandTotal") =>
      buildPivotModel({ ...base, measures: [{ id: "sales", field: "sales", showAs }] }, data);
    expect(texts(of("percentOfParentRow").rows[1]!)).toEqual(["75%", "100%"]);
    expect(texts(of("percentOfRowTotal").rows[1]!)).toEqual(["43%", "57%"]);
    expect(texts(of("percentOfGrandTotal").rows[1]!)).toEqual(["18%", "24%"]);
  });
});

describe("buildPivotModel — expansion, spans, interaction", () => {
  it("honors expanded paths and computes spans over visible rows", () => {
    const m = buildPivotModel({ ...base, expanded: [["Footwear"]] }, data);
    expect(m.rows.map((r) => r.label)).toEqual(["Camp", "Footwear", "Boots", "Grand Total"]);
    expect(m.rows[0]!.expanded).toBe(false);
    expect(m.spans[0]).toEqual([
      { rowIndex: 0, span: 1, path: ["Camp"] },
      { rowIndex: 1, span: 2, path: ["Footwear"] },
    ]);
    expect(computePivotRowSpans(m.rows, 1)).toEqual([{ rowIndex: 2, span: 1, path: ["Footwear", "Boots"] }]);
  });

  it("grand total can move to the top or be hidden", () => {
    expect(buildPivotModel({ ...base, totals: { grandTotalPosition: "top" } }, data).rows[0]!.kind).toBe("grandTotal");
    const hidden = buildPivotModel({ ...base, totals: { grandTotal: false } }, data);
    expect(hidden.rows.some((r) => r.kind === "grandTotal")).toBe(false);
    expect(hidden.grandTotal.cells[0]!.value).toBe(1000);
  });

  it("togglePivotGroup materializes 'all' then flips one path", () => {
    const m = buildPivotModel(base, data);
    const collapsed = togglePivotGroup(base, m, ["Camp"]);
    expect(collapsed.expanded).toEqual([["Footwear"]]);
    const m2 = buildPivotModel(collapsed, data);
    expect(togglePivotGroup(collapsed, m2, ["Camp"]).expanded).toEqual([["Footwear"], ["Camp"]]);
    expect(togglePivotGroup(setPivotExpandedAll(base, false), m2, ["Camp"]).expanded).toEqual([["Camp"]]);
  });

  it("setPivotHeatScope keeps other heat options and adds heat when absent", () => {
    expect(setPivotHeatScope({ ...base, heat: { levels: 5, applyTo: "all" } }, "row").heat).toEqual({
      levels: 5,
      applyTo: "all",
      scope: "row",
    });
    expect(setPivotHeatScope({ ...base, heat: null }, "column").heat).toEqual({ scope: "column" });
  });

  it("row ids are stable and unambiguous", () => {
    expect(pivotPathId(["a/b", "c"])).toBe("r:a%2Fb/c");
    expect(pivotPathId(["a", "b/c"])).toBe("r:a/b%2Fc");
  });
});

describe("buildPivotModel — heat, series, KPIs", () => {
  it("heat levels over all leaves by default, per column on request", () => {
    const m = buildPivotModel({ ...base, heat: { levels: 5 } }, data);
    const leafHeat = m.rows.filter((r) => r.kind === "leaf").map((r) => r.cells.map((c) => c.heat));
    // Leaves: Tents 300/400, Chairs 100/–, Boots 600/250 → domain 100…600.
    expect(leafHeat).toEqual([
      [2, 3],
      [0, undefined],
      [4, 1],
    ]);
    expect(m.rows[0]!.cells[0]!.heat).toBeUndefined();

    const perColumn = buildPivotModel({ ...base, heat: { scope: "column", levels: 5 } }, data);
    expect(perColumn.rows.find((r) => r.label === "Tents")!.cells.map((c) => c.heat)).toEqual([2, 4]);
    const fixed = buildPivotModel({ ...base, heat: { domain: [0, 1000], levels: 10 } }, data);
    expect(fixed.rows.find((r) => r.label === "Boots")!.cells.map((c) => c.heat)).toEqual([6, 2]);
  });

  it("header series with per-group breakdown", () => {
    const m = buildPivotModel({ ...base, headerCharts: { breakdown: true } }, data);
    expect(m.headerSeries).toEqual({
      measureId: "sales",
      type: "bar",
      max: 1000,
      points: [
        {
          columnId: "c:Nov:sales",
          columnKey: "Nov",
          label: "Nov",
          value: 1000,
          breakdown: [
            { key: "Camp", label: "Camp", value: 400 },
            { key: "Footwear", label: "Footwear", value: 600 },
          ],
        },
        {
          columnId: "c:Dec:sales",
          columnKey: "Dec",
          label: "Dec",
          value: 650,
          breakdown: [
            { key: "Camp", label: "Camp", value: 400 },
            { key: "Footwear", label: "Footwear", value: 250 },
          ],
        },
      ],
    });
  });

  it("KPIs with deltas on top-level groups and the grand total", () => {
    const m = buildPivotModel(
      {
        ...base,
        measures: [
          { id: "sales", field: "sales", format: { style: "currency", currency: "USD" } },
          { id: "plan", field: "plan" },
        ],
        kpis: [{ id: "vsPlan", label: "Sales", measure: "sales", compareTo: "plan" }],
      },
      data,
    );
    expect(m.rows[0]!.kpis).toEqual([
      { id: "vsPlan", label: "Sales", value: 800, text: "$800", delta: 0, deltaText: "0.0%", compareLabel: "plan" },
    ]);
    expect(m.rows[1]!.kpis).toBeUndefined();
    expect(m.kpis[0]).toMatchObject({ value: 1650, text: "$1,650", deltaText: "+6.5%" });
  });
});

describe("pivotModelToSheet", () => {
  it("tabular sheet keeps numbers numeric with merges for spans and headers", () => {
    const m = buildPivotModel(
      { ...base, measures: [{ id: "sales", field: "sales", groupShowAs: "percentOfColumnTotal" }] },
      data,
    );
    const sheet = pivotModelToSheet(m);
    expect(pivotSheetToMatrix(sheet)).toEqual([
      ["Department", "Line", "Nov", "Dec"],
      ["Camp", null, 0.4, 400 / 650],
      [null, "Tents", 300, 400],
      [null, "Chairs", 100, null],
      ["Footwear", null, 0.6, 250 / 650],
      [null, "Boots", 600, 250],
      ["Grand Total", null, 1, 1],
    ]);
    expect(sheet.cells[1]![2]!.numFmt).toBe("#,##0%");
    expect(sheet.cells[2]![2]!.numFmt).toBe("#,##0.00");
    expect(sheet.merges).toEqual([
      { row: 6, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 3, colSpan: 1 },
      { row: 4, col: 0, rowSpan: 2, colSpan: 1 },
    ]);
    expect(sheet).toMatchObject({ frozenRows: 1, frozenCols: 2, columnCount: 4 });
  });

  it("compact sheet indents a single hierarchy column; multi-row headers merge", () => {
    const m = buildPivotModel({ ...base, values: ["sales", "plan"], layout: "compact" }, data);
    const sheet = pivotModelToSheet(m);
    const matrix = pivotSheetToMatrix(sheet);
    expect(matrix[0]).toEqual([null, "Nov", null, "Dec", null]);
    expect(matrix[1]).toEqual(["Department / Line", "Sales", "Plan", "Sales", "Plan"]);
    expect(matrix.slice(2).map((r) => r[0])).toEqual(["Camp", "  Tents", "  Chairs", "Footwear", "  Boots", "Grand Total"]);
    expect(sheet.merges).toEqual([
      { row: 0, col: 1, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 3, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
    ]);
  });
});
