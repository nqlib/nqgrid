import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import {
  generatePlanningPivotRows,
  planningDateFieldCatalog,
  planningDatesPivotSpec,
  planningFieldCatalog,
  planningMultiColumnPivotSpec,
  planningPivotSpec,
} from "../../fixtures/planning-pivot-mock";
import { buildPivotFacet, buildPivotModel, createPivotModelBuilder, describePivotFilters } from "./build-model";
import { pivotColumnFields, pivotColumnKeyOf } from "./columns";
import { pivotSpecDataKey } from "./cube";
import {
  parsePivotIsoDay,
  pivotCivilFromDays,
  pivotDateFillKeys,
  pivotDateKeyComparator,
  pivotDateKeyOfDay,
  pivotDateLabel,
  pivotDateKeyWithin,
  pivotDayOf,
  pivotDaysFromCivil,
  PIVOT_INVALID_DAY,
  resolvePivotDateField,
} from "./dates";
import {
  movePivotField,
  pivotDateGroupingOf,
  pivotFieldListState,
  planPivotFieldMove,
  resolvePivotFields,
  setPivotDateGrouping,
} from "./fields";
import { setPivotColumnsExpandedAll, setPivotFilter, togglePivotColumnGroup } from "./interaction";
import { PIVOT_SPEC_JSON_SCHEMA } from "./schema";
import { pivotModelToSheet } from "./to-sheet";
import type { PivotDataRow, PivotSpec } from "./types";
import { validatePivotSpec } from "./validate";

const day = (iso: string) => parsePivotIsoDay(iso);

describe("date parsing (UTC, deterministic)", () => {
  it("parses ISO dates, datetimes, epoch ms and Dates; invalid values are blank", () => {
    expect(pivotCivilFromDays(day("2026-01-15"))).toEqual([2026, 1, 15]);
    expect(pivotDaysFromCivil(1970, 1, 1)).toBe(0);
    expect(pivotCivilFromDays(pivotDaysFromCivil(1600, 2, 29))).toEqual([1600, 2, 29]);
    expect(day("2026-01")).toBe(day("2026-01-01"));
    // Wall-clock datetimes keep their date; instants (Z / offsets) are converted to UTC days.
    expect(day("2026-01-15T23:30")).toBe(day("2026-01-15"));
    expect(day("2026-01-15 23:30:59.999")).toBe(day("2026-01-15"));
    expect(day("2026-01-15T23:30:00Z")).toBe(day("2026-01-15"));
    expect(day("2026-01-15T23:30:00-02:00")).toBe(day("2026-01-16"));
    expect(day("2026-01-16T01:00:00+0300")).toBe(day("2026-01-15"));
    expect(parsePivotIsoDay("2026-01-15T23:30:00Z", 60)).toBe(day("2026-01-16"));
    expect(pivotDayOf(Date.UTC(2026, 0, 15, 23, 59))).toBe(day("2026-01-15"));
    expect(pivotDayOf(new Date(Date.UTC(2026, 0, 15, 23, 59)), 120)).toBe(day("2026-01-16"));
    expect(pivotDayOf(" 2026-03-01 ")).toBe(day("2026-03-01"));
    for (const bad of ["2026-02-30", "2026-13-01", "26-01-01", "2026/01/15", "2026-01-15T25:00", "2026-01-15Tx", "", "Nov", null, undefined, NaN, Infinity, {}, true]) {
      expect(pivotDayOf(bad)).toBe(PIVOT_INVALID_DAY);
    }
    expect(pivotDayOf(new Date(NaN))).toBe(PIVOT_INVALID_DAY);
  });

  it("keys, labels and chronological order (fiscal years named by their end year)", () => {
    const nov = day("2025-11-03");
    expect(pivotDateKeyOfDay(nov, "year", 1)).toBe("2025");
    expect(pivotDateKeyOfDay(nov, "year", 11)).toBe("2026");
    expect(pivotDateKeyOfDay(nov, "quarter", 11)).toBe("Q1");
    expect(pivotDateKeyOfDay(day("2026-10-31"), "quarter", 11)).toBe("Q4");
    expect(pivotDateKeyOfDay(nov, "yearQuarter", 11)).toBe("2026-Q1");
    expect(pivotDateKeyOfDay(nov, "month", 11)).toBe("11");
    expect(pivotDateKeyOfDay(nov, "yearMonth", 11)).toBe("2025-11");
    expect(pivotDateKeyOfDay(nov, "day", 11)).toBe("2025-11-03");
    // ISO weeks: 2021-01-03 is in 2020's week 53; 2024-12-30 is in 2025's week 1.
    expect(pivotDateKeyOfDay(day("2021-01-03"), "week", 1)).toBe("2020-W53");
    expect(pivotDateKeyOfDay(day("2024-12-30"), "week", 1)).toBe("2025-W01");
    const fiscal = { group: "yearQuarter", fiscalYearStartMonth: 11, monthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] } as const;
    expect(pivotDateLabel("2026-Q1", fiscal)).toBe("Q1 FY26");
    expect(pivotDateLabel("2026-Q1", { ...fiscal, fiscalYearStartMonth: 1 })).toBe("Q1 2026");
    expect(pivotDateLabel("2026", { ...fiscal, group: "year" })).toBe("FY26");
    expect(pivotDateLabel("2025-11", { ...fiscal, group: "yearMonth" })).toBe("Nov 2025");
    expect(pivotDateLabel("2025-11-03", { ...fiscal, group: "day" })).toBe("3 Nov 2025");
    expect(pivotDateLabel("2020-W53", { ...fiscal, group: "week" })).toBe("W53 2020");
    const de = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    expect(pivotDateLabel("03", { ...fiscal, group: "month", monthNames: de })).toBe("Mär");
    // Months follow the fiscal year; blanks last.
    const months = ["01", "", "11", "10", "12"].sort(pivotDateKeyComparator({ group: "month", fiscalYearStartMonth: 11 }));
    expect(months).toEqual(["11", "12", "01", "10", ""]);
  });

  it("gap fill and nesting for keepEmpty", () => {
    const ym = { group: "yearMonth", fiscalYearStartMonth: 1 } as const;
    expect(pivotDateFillKeys(["2026-03", "2025-11"], ym)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02", "2026-03"]);
    expect(pivotDateFillKeys(["2026-Q2", "2025-Q4"], { group: "yearQuarter", fiscalYearStartMonth: 1 })).toEqual(["2025-Q4", "2026-Q1", "2026-Q2"]);
    expect(pivotDateFillKeys([], { group: "month", fiscalYearStartMonth: 11 })[0]).toBe("11");
    const def = (group: "year" | "quarter" | "month" | "yearMonth") => resolvePivotDateField({ fields: [{ field: "d", fiscalYearStartMonth: 11 }] }, `d:${group}`)!;
    expect(pivotDateKeyWithin(def("quarter"), "Q1", def("month"), "12")).toBe(true);
    expect(pivotDateKeyWithin(def("quarter"), "Q1", def("month"), "02")).toBe(false);
    expect(pivotDateKeyWithin(def("year"), "2026", def("yearMonth"), "2025-11")).toBe(true);
    expect(pivotDateKeyWithin(def("year"), "2026", def("yearMonth"), "2026-11")).toBe(false);
  });

  it("resolves derived fields: convention names, catalogue entries, inherited settings", () => {
    const spec = { fields: [{ field: "orderDate", type: "date" as const, fiscalYearStartMonth: 7 }, { field: "fy", source: "orderDate", dateGroup: "year" as const }] };
    expect(resolvePivotDateField(spec, "orderDate:quarter")).toMatchObject({ source: "orderDate", group: "quarter", fiscalYearStartMonth: 7 });
    expect(resolvePivotDateField(spec, "fy")).toMatchObject({ source: "orderDate", group: "year", fiscalYearStartMonth: 7 });
    expect(resolvePivotDateField(spec, "orderDate")).toBeNull();
    expect(resolvePivotDateField({ fields: [{ field: "a:year", type: "dimension" }] }, "a:year")).toBeNull();
  });
});

/** Two years of orders, deliberately out of order, with a blank date. */
const orders: PivotDataRow[] = [
  { region: "East", orderDate: "2026-02-10", amount: 5 },
  { region: "West", orderDate: "2025-01-20", amount: 1 },
  { region: "East", orderDate: "2025-04-02T10:00:00Z", amount: 2 },
  { region: "West", orderDate: Date.UTC(2025, 6, 4), amount: 3 },
  { region: "East", orderDate: new Date(Date.UTC(2026, 9, 30)), amount: 4 },
  { region: "West", orderDate: "not a date", amount: 10 },
];
const ordersSpec: PivotSpec = {
  version: 1,
  rows: [{ field: "region" }],
  columns: [{ field: "orderDate:year" }, { field: "orderDate:quarter" }],
  measures: [{ id: "amount", field: "amount" }],
  totals: { rowTotal: true },
};

describe("several column fields", () => {
  it("builds a chronological column tree with subtotals, a blank group and a grand total", () => {
    const m = buildPivotModel(ordersSpec, orders);
    expect(m.columnDimensions).toEqual([
      { field: "orderDate:year", label: "Year (Order Date)" },
      { field: "orderDate:quarter", label: "Quarter (Order Date)" },
    ]);
    expect(m.headerRows.map((r) => r.map((h) => [h.label, h.colSpan, h.rowSpan ?? 1]))).toEqual([
      [["2025", 3, 1], ["2025 Total", 1, 2], ["2026", 2, 1], ["2026 Total", 1, 2], ["(blank)", 1, 1], ["(blank) Total", 1, 2], ["Total", 1, 2]],
      [["Q1", 1, 1], ["Q2", 1, 1], ["Q3", 1, 1], ["Q1", 1, 1], ["Q4", 1, 1], ["(blank)", 1, 1]],
    ]);
    expect(m.columns.map((c) => c.columnKey)).toEqual(["2025/Q1", "2025/Q2", "2025/Q3", "2025", "2026/Q1", "2026/Q4", "2026", "/", "", null]);
    expect(m.grandTotal.cells.map((c) => c.raw)).toEqual([1, 2, 3, 6, 5, 4, 9, 10, 10, 25]);
    expect(m.columns[3]).toMatchObject({ id: "s:2025:amount", subtotal: true, columnPath: ["2025"], headerPath: ["2025 Total"] });
    expect(m.headerRows[0]![0]).toMatchObject({ columnPath: ["2025"], columnLevel: 0, expanded: true });
    expect(m.headerRows[0]![1]).toMatchObject({ subtotal: true, columnKey: "2025" });
    expect(m.columnKeys.map((k) => k.label)).toEqual(["2025 Q1", "2025 Q2", "2025 Q3", "2026 Q1", "2026 Q4", "(blank) (blank)"]);
    // A single object and a one-element array are the same spec.
    const one = buildPivotModel({ ...ordersSpec, columns: { field: "orderDate:year" } }, orders);
    expect(buildPivotModel({ ...ordersSpec, columns: [{ field: "orderDate:year" }] }, orders)).toEqual(one);
    expect(one.columnDimensions).toBeUndefined();
    expect(one.columns.map((c) => c.columnKey)).toEqual(["2025", "2026", "", null]);
  });

  it("subtotal placement per level, collapsed groups and the toggle helpers", () => {
    const start = buildPivotModel({ ...ordersSpec, columns: [{ field: "orderDate:year", subtotal: "start" }, { field: "orderDate:quarter" }] }, orders);
    expect(start.columns.slice(0, 4).map((c) => c.columnKey)).toEqual(["2025", "2025/Q1", "2025/Q2", "2025/Q3"]);
    const none = buildPivotModel({ ...ordersSpec, columns: [{ field: "orderDate:year", subtotal: "none" }, { field: "orderDate:quarter" }] }, orders);
    expect(none.columns.some((c) => c.subtotal)).toBe(false);
    expect(none.headerRows[0]!.find((h) => h.label === "Total")!.rowSpan).toBe(2);

    const m = buildPivotModel(ordersSpec, orders);
    const collapsed = togglePivotColumnGroup(ordersSpec, m, ["2025"]);
    expect(collapsed.columnsExpanded).toEqual([["2026"], [""]]);
    const cm = buildPivotModel(collapsed, orders);
    expect(cm.columns.map((c) => c.columnKey)).toEqual(["2025", "2026/Q1", "2026/Q4", "2026", "/", "", null]);
    expect(cm.columns[0]).toMatchObject({ id: "s:2025:amount", subtotal: true, collapsed: true, headerPath: ["2025"] });
    expect(cm.headerRows[0]![0]).toMatchObject({ label: "2025", rowSpan: 2, expanded: false });
    expect(cm.headerSeries).toBeNull();
    expect(togglePivotColumnGroup(collapsed, cm, ["2025"]).columnsExpanded).toEqual([["2026"], [""], ["2025"]]);
    const allCollapsed = buildPivotModel(setPivotColumnsExpandedAll(ordersSpec, false), orders);
    expect(allCollapsed.columns.map((c) => c.headerPath[0])).toEqual(["2025", "2026", "(blank)", "Total"]);
    // Collapsing is view state: the cube is reused.
    expect(pivotSpecDataKey(collapsed)).toBe(pivotSpecDataKey(ordersSpec));
    const builder = createPivotModelBuilder();
    builder.build(ordersSpec, orders);
    expect(builder.build(collapsed, orders).grandTotal.cells[0]!.raw).toBe(6);
  });

  it("showAs: % of column total is the leaf column's; % of parent column uses the enclosing group", () => {
    const spec: PivotSpec = {
      ...ordersSpec,
      rows: [{ field: "region" }],
      measures: [
        { id: "amount", field: "amount" },
        { id: "col", field: "amount", showAs: "percentOfColumnTotal" },
        { id: "parent", field: "amount", showAs: "percentOfParentColumn" },
      ],
      values: ["parent", "col"],
    };
    const m = buildPivotModel(spec, orders);
    const east = m.rows.find((r) => r.label === "East")!;
    const cell = (key: string | null, id: string) => east.cells[m.columns.findIndex((c) => c.columnKey === key && c.measureId === id)]!;
    expect(cell("2025/Q2", "parent").value).toBe(1); // East 2025 Q2 = 2 of East 2025 = 2
    expect(cell("2025", "parent").value).toBeCloseTo(2 / 11); // East 2025 of East total (11)
    expect(cell(null, "parent").value).toBe(1);
    expect(cell("2025/Q2", "col").value).toBe(1); // only East has 2025 Q2
    expect(cell("2026", "col").value).toBe(1);
    // With one column field the parent is the row total.
    const flat = buildPivotModel({ ...spec, columns: { field: "orderDate:year" } }, orders);
    const e = flat.rows.find((r) => r.label === "East")!;
    expect(e.cells[flat.columns.findIndex((c) => c.columnKey === "2026" && c.measureId === "parent")]!.value).toBeCloseTo(9 / 11);
  });

  it("heat: column scope is per (leaf or total) column; other scopes skip subtotals", () => {
    const spec: PivotSpec = { ...ordersSpec, heat: { measure: "amount", scope: "all", applyTo: "leaf" } };
    const m = buildPivotModel(spec, orders);
    const subtotalCols = m.columns.flatMap((c, i) => (c.subtotal ? [i] : []));
    for (const r of m.rows) for (const i of subtotalCols) expect(r.cells[i]!.heat).toBeUndefined();
    const col = buildPivotModel({ ...spec, heat: { measure: "amount", scope: "column" } }, orders);
    expect(col.rows.find((r) => r.label === "East")!.cells[3]!.heat).toBeDefined();
  });

  it("header series: one point per leaf / collapsed group, plus outer groups", () => {
    const spec: PivotSpec = { ...ordersSpec, headerCharts: { measure: "amount", breakdown: true } };
    const m = buildPivotModel(spec, orders);
    expect(m.headerSeries!.points.map((p) => [p.columnKey, p.value])).toEqual([["2025/Q1", 1], ["2025/Q2", 2], ["2025/Q3", 3], ["2026/Q1", 5], ["2026/Q4", 4], ["/", 10]]);
    expect(m.headerSeries!.groups!.map((p) => [p.label, p.value])).toEqual([["2025", 6], ["2026", 9], ["(blank)", 10]]);
    expect(m.headerSeries!.groupMax).toBe(10);
    const collapsed = buildPivotModel({ ...spec, columnsExpanded: [["2026"]] }, orders);
    expect(collapsed.headerSeries!.points[0]).toMatchObject({ columnId: "s:2025:amount", columnKey: "2025", value: 6 });
  });

  it("Σ Values between column levels and the sheet's row-spanning merges", () => {
    const rows = generatePlanningPivotRows(7, { extraFields: true });
    const m = buildPivotModel(planningMultiColumnPivotSpec, rows);
    expect(m.headerRows.map((r) => r.length)).toEqual([9, 8, 34]); // 4 × (2 × 3) leaves + 4 × 2 subtotal measures + 2 totals
    expect(m.columns[0]!.headerPath).toEqual(["North", "Actual", "Retail"]);
    expect(m.columns[6]!.headerPath).toEqual(["North Total", "Actual"]);
    const sheet = pivotModelToSheet(m);
    expect(sheet.merges).toContainEqual({ row: 0, col: 8, rowSpan: 2, colSpan: 2 }); // North Total over its measures
    expect(sheet.cells.every((r) => r.length === sheet.columnCount)).toBe(true);
    expect(sheet.cells[1]![8]!.v).toBeNull();
    expect(sheet.cells[2]![8]!.v).toBe("Actual");
    expect(sheet.frozenRows).toBe(3);
  });

  it("keepEmpty fills date gaps, nested consistently under date parents", () => {
    const spec: PivotSpec = {
      ...ordersSpec,
      columns: [{ field: "orderDate:year" }, { field: "orderDate:quarter", keepEmpty: true }],
      filters: [{ field: "orderDate:year", exclude: [""] }],
    };
    const m = buildPivotModel(spec, orders);
    expect(m.columns.filter((c) => !c.subtotal && c.columnKey !== null).map((c) => c.columnKey)).toEqual(["2025/Q1", "2025/Q2", "2025/Q3", "2025/Q4", "2026/Q1", "2026/Q2", "2026/Q3", "2026/Q4"]);
    const months = buildPivotModel({ ...spec, columns: [{ field: "orderDate:yearMonth", keepEmpty: true }] }, orders);
    expect(months.columnKeys.length).toBe(22); // Jan 2025 … Oct 2026
    expect(months.columnKeys[0]).toEqual({ key: "2025-01", label: "Jan 2025" });
    expect(months.columns.find((c) => c.columnKey === "2025-02")!.headerPath).toEqual(["Feb 2025"]);
    const nested = buildPivotModel({ ...spec, columns: [{ field: "orderDate:yearQuarter" }, { field: "orderDate:yearMonth", keepEmpty: true }] }, orders);
    const q1 = nested.columns.filter((c) => c.columnPath?.[0] === "2025-Q1" && !c.subtotal).map((c) => c.columnPath![1]);
    expect(q1).toEqual(["2025-01", "2025-02", "2025-03"]);
  });

  it("date fields filter, facet and describe with their labels", () => {
    const filtered = setPivotFilter(ordersSpec, { field: "orderDate:year", include: ["2026"] });
    const m = buildPivotModel(filtered, orders);
    expect(m.grandTotal.cells.at(-1)!.raw).toBe(9);
    expect(describePivotFilters(filtered)[0]!.text).toBe("Year (Order Date) = 2026");
    const fiscal: PivotSpec = { ...filtered, fields: [{ field: "orderDate", type: "date", fiscalYearStartMonth: 7 }] };
    expect(describePivotFilters(fiscal)[0]!.text).toBe("Year (Order Date) = FY26");
    const facet = buildPivotFacet(ordersSpec, orders, "orderDate:yearMonth");
    expect(facet.values.map((v) => v.label)).toEqual(["Jan 2025", "Apr 2025", "Jul 2025", "Feb 2026", "Oct 2026", "(blank)"]);
    // Fiscal settings change the cube; labels alone do not.
    expect(pivotSpecDataKey(fiscal)).not.toBe(pivotSpecDataKey(filtered));
    const renamed: PivotSpec = { ...filtered, fields: [{ field: "orderDate", monthNames: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"] }] };
    expect(pivotSpecDataKey(renamed)).toBe(pivotSpecDataKey(filtered));
  });

  it("sortBy / topN can rank by a column group key", () => {
    const spec: PivotSpec = { ...ordersSpec, rows: [{ field: "region", sortBy: { measure: "amount", columnKey: "2025", direction: "desc" } }] };
    expect(buildPivotModel(spec, orders).rows[0]!.label).toBe("West"); // West 2025 = 4 > East 2025 = 2
    const top: PivotSpec = { ...ordersSpec, rows: [{ field: "region", topN: { measure: "amount", count: 1, columnKey: "2026" } }] };
    expect(buildPivotModel(top, orders).rows.map((r) => r.label)).toEqual(["East", "Grand Total"]);
    const leaf = buildPivotModel({ ...spec, rows: [{ field: "region", sortBy: { measure: "amount", columnKey: pivotColumnKeyOf(["2026", "Q1"], 2) } }] }, orders);
    expect(leaf.rows[0]!.label).toBe("East");
  });

  it("the planning-dates golden: FY25 collapsed, FY26 by quarter with a subtotal", () => {
    const rows = generatePlanningPivotRows(7, { extraFields: true, orderDates: true });
    const m = buildPivotModel(planningDatesPivotSpec, rows);
    expect(m.columns.map((c) => c.headerPath.join(" › "))).toEqual(["FY25", "FY26 › Q1", "FY26 › Q2", "FY26 › Q3", "FY26 › Q4", "FY26 Total", "Total"]);
    const total = rows.reduce((s, r) => s + r.actual, 0);
    expect(m.grandTotal.cells.at(-1)!.raw).toBe(total);
    expect(m.grandTotal.cells[0]!.raw! + m.grandTotal.cells[5]!.raw!).toBe(total);
  });
});

describe("date grouping in the field list", () => {
  const rows = generatePlanningPivotRows(7, { extraFields: true, orderDates: true });
  const base: PivotSpec = { ...planningPivotSpec, fields: planningDateFieldCatalog };
  const fields = resolvePivotFields(base, rows);
  const opts = { fields };

  it("date fields offer groups only when their values parse", () => {
    expect(fields.find((f) => f.field === "orderDate")!.dateGroups).toEqual(["year", "yearQuarter", "quarter", "yearMonth", "month", "week", "day"]);
    expect(fields.find((f) => f.field === "month")!.dateGroups).toBeUndefined();
    const planning = resolvePivotFields({ ...planningPivotSpec, fields: planningFieldCatalog }, generatePlanningPivotRows(7, { extraFields: true }));
    expect(planning.find((f) => f.field === "month")!.dateGroups).toBeUndefined(); // "Nov" is not a date
    expect(resolvePivotFields({ ...base, fields: [{ field: "orderDate", type: "date", dateGroups: ["year"] }] }).find((f) => f.field === "orderDate")!.dateGroups).toEqual(["year"]);
  });

  it("dropping a date field groups it by default (Year → Quarter in Columns, Year → Month in Rows)", () => {
    const noMonth = movePivotField(base, { field: "month", from: "columns", to: "unused" }, opts);
    const plan = planPivotFieldMove(noMonth, { field: "orderDate", from: "unused", to: "columns" }, opts);
    expect(plan.grouped).toEqual(["orderDate:year", "orderDate:quarter"]);
    expect(plan.spec.columns).toEqual([
      { field: "orderDate:year", label: "Year (Order date)" },
      { field: "orderDate:quarter", label: "Quarter (Order date)" },
    ]);
    const m = buildPivotModel(plan.spec, rows);
    expect(m.headerRows[0]!.map((h) => h.label)).toEqual(["FY25", "FY25 Total", "FY26", "FY26 Total"]);
    // Rows get Year → Month; the Year already in Columns is skipped, so only Month is added.
    const inRows = planPivotFieldMove(plan.spec, { field: "orderDate", from: "unused", to: "rows", index: 0 }, opts);
    expect(inRows.grouped).toEqual(["orderDate:month"]);
    expect(inRows.spec.rows[0]!.field).toBe("orderDate:month");
    const months = buildPivotModel(inRows.spec, rows).rows.filter((r) => r.depth === 0).map((r) => r.label);
    expect(months.slice(0, 3)).toEqual(["Nov", "Dec", "Jan"]); // fiscal order
    // Opting out places the raw field.
    expect(movePivotField(noMonth, { field: "orderDate", from: "unused", to: "columns" }, { ...opts, dateGrouping: false }).columns).toEqual({ field: "orderDate", label: "Order date" });
  });

  it("setPivotDateGrouping regroups in place, ungroups and keeps the field list consistent", () => {
    const grouped = setPivotDateGrouping(movePivotField(base, { field: "month", from: "columns", to: "unused" }, opts), "orderDate", ["quarter", "year"], { ...opts, area: "columns" });
    expect(pivotColumnFields(grouped).map((d) => d.field)).toEqual(["orderDate:year", "orderDate:quarter"]);
    expect(pivotDateGroupingOf(grouped, "orderDate", opts)).toEqual({ area: "columns", groups: ["year", "quarter"], raw: false });
    const state = pivotFieldListState(grouped, fields);
    expect(state.columns.map((i) => [i.field, i.dateSource, i.dateGroup])).toEqual([
      ["orderDate:year", "orderDate", "year"],
      ["orderDate:quarter", "orderDate", "quarter"],
    ]);
    expect(state.fields.find((f) => f.field === "orderDate:year")).toMatchObject({ label: "Year (Order date)", checked: true, usedIn: ["columns"] });
    // Year → Month with a filter on the quarter: the quarter leaves (and loses its filter).
    const filtered = setPivotFilter(grouped, { field: "orderDate:quarter", include: ["Q1"] });
    const months = setPivotDateGrouping(filtered, "orderDate", ["year", "month"], opts);
    expect(pivotColumnFields(months).map((d) => d.field)).toEqual(["orderDate:year", "orderDate:month"]);
    expect(months.filters).toBeUndefined();
    const raw = setPivotDateGrouping(months, "orderDate", [], opts);
    expect(raw.columns).toEqual({ field: "orderDate", label: "Order date" });
    // Grouping a row field that is the only row: replaced in place, never refused for emptying Rows.
    const oneRow: PivotSpec = { ...base, rows: [{ field: "orderDate" }] };
    expect(setPivotDateGrouping(oneRow, "orderDate", ["year", "month"], opts).rows.map((d) => d.field)).toEqual(["orderDate:year", "orderDate:month"]);
    expect(validatePivotSpec(months).ok).toBe(true);
  });
});

describe("validation of the new shapes", () => {
  const validateSchema = new Ajv2020({ allErrors: true }).compile(PIVOT_SPEC_JSON_SCHEMA);
  const minimal = { version: 1, rows: [{ field: "a" }], measures: [{ id: "m", field: "v" }] };

  it("accepts columns arrays, subtotals, columnsExpanded and date fields", () => {
    for (const spec of [planningDatesPivotSpec, planningMultiColumnPivotSpec, ordersSpec, { ...minimal, columns: [{ field: "b", subtotal: "start" }, { field: "c" }], columnsExpanded: "none" }]) {
      expect(validateSchema(spec), JSON.stringify(validateSchema.errors)).toBe(true);
      expect(validatePivotSpec(spec)).toMatchObject({ ok: true });
    }
  });

  it.each(Object.entries({
    "empty columns array": { ...minimal, columns: [] },
    "column without field": { ...minimal, columns: [{ field: "b" }, { label: "x" }] },
    "bad subtotal": { ...minimal, columns: [{ field: "b", subtotal: "middle" }] },
    "bad columnsExpanded": { ...minimal, columnsExpanded: [[1]] },
    "bad dateGroup": { ...minimal, fields: [{ field: "x", source: "d", dateGroup: "decade" }] },
    "source without dateGroup": { ...minimal, fields: [{ field: "x", source: "d" }] },
    "bad fiscal month": { ...minimal, fields: [{ field: "d", fiscalYearStartMonth: 13 }] },
    "bad offset": { ...minimal, fields: [{ field: "d", timeZoneOffsetMinutes: 900 }] },
    "short month names": { ...minimal, fields: [{ field: "d", monthNames: ["J"] }] },
    "bad showAs": { ...minimal, measures: [{ id: "m", field: "v", showAs: "percentOfParentGroup" }] },
  }))("rejects %s in both validators", (_name, spec) => {
    expect(validateSchema(spec)).toBe(false);
    expect(validatePivotSpec(spec).ok).toBe(false);
  });

  it("referential rules the schema cannot express", () => {
    // Row subtotal positions are valid since step 4.
    expect(validatePivotSpec({ ...minimal, rows: [{ field: "a", subtotal: "end" }] })).toMatchObject({ ok: true });
    expect(validatePivotSpec({ ...minimal, rows: [{ field: "a", subtotal: "bottom" }] })).toMatchObject({ ok: false });
    const dup = validatePivotSpec({ ...minimal, columns: [{ field: "b" }, { field: "a" }] });
    expect(dup.ok ? [] : dup.errors).toEqual(['columns[1].field "a" is already used by rows[0]']);
  });
});
