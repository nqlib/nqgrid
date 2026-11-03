import { describe, expect, it } from "vitest";

import { pivotColumnFields } from "./columns";
import { generatePlanningPivotRows, planningPivotSpec } from "../../fixtures/planning-pivot-mock";
import { aggregatePivotRows } from "./aggregate";
import { buildPivotModel, createPivotModelBuilder, describePivotFilters, pivotModelFromCube } from "./build-model";
import { buildPivotCube, PIVOT_OTHER_KEY, pivotSpecDataKey } from "./cube";
import { createPivotRowEncoding } from "./encode";
import { pivotFilterAccepts, pivotMatchesLabel } from "./filter";
import {
  clearPivotFilter,
  clearPivotFilters,
  pivotFilterForSelection,
  setPivotFilter,
  setPivotFilterValues,
  setPivotSort,
  setPivotTopN,
  togglePivotFilterValue,
} from "./interaction";
import type { PivotDataRow, PivotFilter, PivotSpec } from "./types";
import { validatePivotSpec } from "./validate";

const rows = generatePlanningPivotRows();
const base: PivotSpec = { ...planningPivotSpec, expanded: "all" };
const lines = (spec: PivotSpec) => buildPivotModel(spec, rows).rows.filter((r) => r.kind === "leaf").map((r) => r.label);
const sumActual = (rs: readonly PivotDataRow[]) => rs.reduce((s, r) => s + (r.actual as number), 0);

describe("report / label filters", () => {
  it("filter records before aggregation; totals and % of total reflect the filtered data", () => {
    const spec: PivotSpec = { ...base, filters: [{ field: "department", include: ["Camp", "Packs"] }] };
    const m = buildPivotModel(spec, rows);
    expect(m.rows.filter((r) => r.kind === "group").map((r) => r.label)).toEqual(["Camp", "Packs"]);
    const kept = rows.filter((r) => r.department === "Camp" || r.department === "Packs");
    expect(m.grandTotal.sourceRowCount).toBe(kept.length);
    const nov = m.columns.findIndex((c) => c.columnKey === "Nov");
    expect(m.grandTotal.cells[nov]!.raw).toBe(sumActual(kept.filter((r) => r.month === "Nov")));
    // Group rows show % of the (filtered) month total → the two groups add up to 100%.
    const groups = m.rows.filter((r) => r.kind === "group");
    expect(groups.reduce((s, g) => s + g.cells[nov]!.value!, 0)).toBeCloseTo(1, 10);
    expect(m.recordCount).toEqual({ total: rows.length, matched: kept.length });
    expect(m.filters).toEqual([{ field: "department", label: "Department", kind: "items", text: "Department = Camp, Packs" }]);
    expect(m.rowDimensions[0]).toEqual({ field: "department", label: "Department", filtered: true });
    // KPIs too.
    const plan = m.kpis.find((k) => k.id === "plan")!;
    expect(plan.value).toBe(kept.reduce((s, r) => s + (r.plan as number), 0));
  });

  it("filters any field (also non-dimensions) and the column dimension; exclude + match combine", () => {
    const spec: PivotSpec = {
      ...base,
      filters: [
        { field: "owner", exclude: ["Maya Chen"] },
        { field: "month", include: ["Nov", "Dec"] },
        { field: "line", match: { op: "contains", value: "PACK" } },
      ],
    };
    const m = buildPivotModel(spec, rows);
    expect(m.columnKeys.map((k) => k.key)).toEqual(["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]); // keepEmpty
    expect(m.rows.filter((r) => r.kind === "leaf").map((r) => r.label)).toEqual(["Daypacks", "Backpacking"]);
    expect(m.grandTotal.cells[2]!.raw).toBeNull(); // Jan: filtered out
    expect(m.filters!.map((f) => f.text)).toEqual(["owner ≠ Maya Chen", "Month = Nov, Dec", 'Line contains "PACK"']);
    // keepEmpty off → only months with data.
    const noKeep = buildPivotModel({ ...spec, columns: { ...spec.columns!, keepEmpty: false } }, rows);
    expect(noKeep.columnKeys.map((k) => k.key)).toEqual(["Nov", "Dec"]);
  });

  it("label matching operators (case-insensitive by default)", () => {
    expect(pivotMatchesLabel("Sleeping Bags", { op: "contains", value: "bag" })).toBe(true);
    expect(pivotMatchesLabel("Sleeping Bags", { op: "contains", value: "bag", caseSensitive: true })).toBe(false);
    expect(pivotMatchesLabel("Sleeping Bags", { op: "notContains", value: "bag" })).toBe(false);
    expect(pivotMatchesLabel("Sleeping Bags", { op: "beginsWith", value: "sleep" })).toBe(true);
    expect(pivotMatchesLabel("Sleeping Bags", { op: "endsWith", value: "BAGS" })).toBe(true);
    expect(pivotMatchesLabel("Tents", { op: "equals", value: "tents" })).toBe(true);
    expect(pivotMatchesLabel("Tents", { op: "notEquals", value: "tents" })).toBe(false);
    expect(pivotFilterAccepts({ field: "x", include: ["a"], exclude: ["a"] }, "a")).toBe(false);
  });

  it("keys compare as strings (numbers, null → blank) and include: [] keeps nothing", () => {
    const data = [
      { year: 2024, k: "a", v: 1 },
      { year: 2025, k: "a", v: 2 },
      { year: null, k: "b", v: 4 },
    ];
    const spec: PivotSpec = { version: 1, rows: [{ field: "k" }], measures: [{ id: "v", field: "v" }] };
    expect(buildPivotModel({ ...spec, filters: [{ field: "year", include: ["2025"] }] }, data).grandTotal.cells[0]!.raw).toBe(2);
    expect(buildPivotModel({ ...spec, filters: [{ field: "year", include: [""] }] }, data).grandTotal.cells[0]!.raw).toBe(4);
    const none = buildPivotModel({ ...spec, filters: [{ field: "year", include: [] }] }, data);
    expect(none.rows.map((r) => r.kind)).toEqual(["grandTotal"]);
    expect(none.grandTotal.cells[0]!.raw).toBeNull();
    expect(none.filters![0]!.text).toBe("year = (none)");
    // A filter with nothing set is inactive: no summary, no recordCount.
    const inactive = buildPivotModel({ ...spec, filters: [{ field: "year", exclude: [] }] }, data);
    expect(inactive.filters).toBeUndefined();
    expect(inactive.recordCount).toBeUndefined();
  });
});

describe("facets", () => {
  it("distinct values with cross-filtered counts, selection and hasData", () => {
    const spec: PivotSpec = {
      ...base,
      filters: [{ field: "department", include: ["Camp"] }, { field: "month", exclude: ["Nov"] }],
      facets: ["department", "line", { field: "owner", label: "Owner" }],
    };
    const m = buildPivotModel(spec, rows);
    const [dept, line, owner] = m.facets!;
    expect(dept!.label).toBe("Department");
    expect(dept!.filtered).toBe(true);
    // Department ignores its own filter: counts reflect only "month ≠ Nov".
    expect(dept!.values.map((v) => [v.key, v.count, v.total, v.selected, v.hasData])).toEqual([
      ["Footwear", 55, 60, false, true],
      ["Apparel", 66, 72, false, true],
      ["Camp", 55, 60, true, true],
      ["Packs", 66, 72, false, true],
    ]);
    expect(line!.filtered).toBe(false);
    expect(line!.values.find((v) => v.key === "Tents")).toMatchObject({ count: 11, total: 12, selected: true, hasData: true });
    expect(line!.values.find((v) => v.key === "Jackets")).toMatchObject({ count: 0, total: 12, selected: true, hasData: false });
    expect(owner!.label).toBe("Owner");
    expect(owner!.values.map((v) => v.key)).toEqual(["Ingrid Solberg", "Luis Ortega", "Maya Chen", "Sam Okafor"]); // ascending
  });

  it("matches a brute-force count for random filter combinations", () => {
    const rand = (() => {
      let s = 3;
      return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    })();
    const fields = ["department", "line", "month", "owner"] as const;
    const keysOf = (f: string) => [...new Set(rows.map((r) => String(r[f])))];
    for (let trial = 0; trial < 25; trial++) {
      const filters: PivotFilter[] = fields
        .filter(() => rand() < 0.6)
        .map((field) => {
          const pick = keysOf(field).filter(() => rand() < 0.5);
          return rand() < 0.5 ? { field, include: pick } : { field, exclude: pick };
        });
      const m = buildPivotModel({ ...base, filters, facets: [...fields] }, rows);
      const passes = (r: PivotDataRow, skip?: string) => filters.every((f) => f.field === skip || pivotFilterAccepts(f, String(r[f.field])));
      expect(m.grandTotal.sourceRowCount).toBe(rows.filter((r) => passes(r)).length);
      for (const facet of m.facets!) {
        for (const v of facet.values) {
          expect(v.count).toBe(rows.filter((r) => String(r[facet.field]) === v.key && passes(r, facet.field)).length);
        }
      }
    }
  });
});

describe("Top N", () => {
  const topLines = (n: number, extra: Partial<NonNullable<PivotSpec["rows"][number]["topN"]>> = {}): PivotSpec => ({
    ...base,
    rows: [base.rows[0]!, { ...base.rows[1]!, topN: { measure: "actual", count: n, ...extra } }],
  });

  it("keeps the top N keys within each parent; excluded keys leave every total", () => {
    const m = buildPivotModel(topLines(2), rows);
    const byDept = new Map<string, string[]>();
    for (const r of m.rows) if (r.kind === "leaf") byDept.set(r.path[0]!, [...(byDept.get(r.path[0]!) ?? []), r.path[1]!]);
    for (const [dept, kept] of byDept) {
      const totals = new Map<string, number>();
      for (const r of rows) if (r.department === dept) totals.set(r.line, (totals.get(r.line) ?? 0) + r.actual);
      const expected = [...totals].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
      expect(new Set(kept)).toEqual(new Set(expected));
    }
    const keptRows = rows.filter((r) => byDept.get(r.department)!.includes(r.line));
    expect(m.grandTotal.sourceRowCount).toBe(keptRows.length);
    expect(m.kpis.find((k) => k.id === "plan")!.value).toBe(keptRows.reduce((s, r) => s + r.plan, 0));
    expect(m.filters!.map((f) => f.text)).toEqual(["Line: Top 2 by Actual"]);
    expect(m.recordCount).toEqual({ total: rows.length, matched: keptRows.length });
  });

  it("bottom N by a column key; 'Other' folds the rest so totals stay complete", () => {
    const bottom = buildPivotModel(topLines(1, { direction: "bottom", columnKey: "Dec" }), rows);
    const camp = bottom.rows.find((r) => r.kind === "leaf" && r.path[0] === "Camp")!;
    const campDec = new Map(rows.filter((r) => r.department === "Camp" && r.month === "Dec").map((r) => [r.line, r.actual]));
    expect(camp.label).toBe([...campDec].sort((a, b) => a[1] - b[1])[0]![0]);

    const other = buildPivotModel(topLines(2, { other: true, otherLabel: "All other lines" }), rows);
    const full = buildPivotModel(base, rows);
    expect(other.grandTotal.cells.map((c) => c.raw)).toEqual(full.grandTotal.cells.map((c) => c.raw));
    const otherRows = other.rows.filter((r) => r.path[1] === PIVOT_OTHER_KEY);
    expect(otherRows.map((r) => [r.path[0], r.label, r.otherCount])).toEqual([
      ["Footwear", "All other lines", 3],
      ["Apparel", "All other lines", 4],
      ["Camp", "All other lines", 3],
      ["Packs", "All other lines", 4],
    ]);
    // "Other" is always last in its group, also with sortBy asc.
    const asc = buildPivotModel(
      { ...topLines(2, { other: true }), rows: [base.rows[0]!, { ...topLines(2, { other: true }).rows[1]!, sortBy: { measure: "actual", direction: "asc" } }] },
      rows,
    );
    const camps = asc.rows.filter((r) => r.kind === "leaf" && r.path[0] === "Camp");
    expect(camps[camps.length - 1]!.label).toBe("Other");
    expect(camps[0]!.cells[0]!.raw! <= camps[1]!.cells[0]!.raw!).toBe(true);
    expect(other.filters![0]!.text).toBe("Line: Top 2 by Actual, rest as All other lines");
  });

  it("outer levels rank first; inner Top N ranks within what the outer level kept (incl. Other)", () => {
    const spec: PivotSpec = {
      ...base,
      rows: [
        { ...base.rows[0]!, topN: { measure: "actual", count: 2, other: true } },
        { ...base.rows[1]!, topN: { measure: "actual", count: 1 } },
      ],
    };
    const m = buildPivotModel(spec, rows);
    expect(m.rows.filter((r) => r.kind === "group").map((r) => r.label)).toEqual(["Footwear", "Apparel", "Other"]);
    const otherLeaves = m.rows.filter((r) => r.kind === "leaf" && r.path[0] === PIVOT_OTHER_KEY);
    expect(otherLeaves).toHaveLength(1);
    expect(m.rows.find((r) => r.path[0] === PIVOT_OTHER_KEY && r.kind === "group")!.otherCount).toBe(2);
  });

  it("count ≥ siblings is a no-op; ties are cut in natural order", () => {
    expect(lines(topLines(99))).toEqual(lines(base));
    const data = ["a", "b", "c"].map((k) => ({ g: "x", k, v: 1 }));
    const spec: PivotSpec = { version: 1, rows: [{ field: "g" }, { field: "k", topN: { measure: "v", count: 2 } }], measures: [{ id: "v", field: "v" }] };
    expect(buildPivotModel(spec, data).rows.filter((r) => r.kind === "leaf").map((r) => r.label)).toEqual(["a", "b"]);
  });
});

describe("sort by value", () => {
  it("orders siblings within each group by a measure (row total or one column), nulls last", () => {
    const spec: PivotSpec = { ...base, rows: [{ ...base.rows[0]!, sortBy: { measure: "actual", direction: "asc" } }, { ...base.rows[1]!, sortBy: { measure: "plan", columnKey: "Mar" } }] };
    const m = buildPivotModel(spec, rows);
    const groups = m.rows.filter((r) => r.kind === "group");
    const deptTotal = (d: string) => sumActual(rows.filter((r) => r.department === d));
    expect(groups.map((g) => deptTotal(g.label))).toEqual(groups.map((g) => deptTotal(g.label)).sort((a, b) => a - b));
    for (const g of groups) {
      const leaves = m.rows.filter((r) => r.kind === "leaf" && r.path[0] === g.label).map((r) => r.label);
      const mar = (line: string) => rows.find((r) => r.department === g.label && r.line === line && r.month === "Mar")!.plan;
      expect(leaves.map(mar)).toEqual(leaves.map(mar).sort((a, b) => b - a));
    }
    expect(m.rowDimensions[1]!.sortBy).toEqual({ measure: "plan", columnKey: "Mar" });

    const data = [
      { k: "a", v: null },
      { k: "b", v: 1 },
      { k: "c", v: 3 },
    ];
    for (const direction of ["asc", "desc"] as const) {
      const s: PivotSpec = { version: 1, rows: [{ field: "k", sortBy: { measure: "v", direction } }], measures: [{ id: "v", field: "v" }] };
      expect(buildPivotModel(s, data).rows.filter((r) => r.kind === "leaf").map((r) => r.label)).toEqual(direction === "asc" ? ["b", "c", "a"] : ["c", "b", "a"]);
    }
  });

  it("sortBy wins over order and sort, which only break ties", () => {
    const data = [
      { k: "a", v: 1 },
      { k: "b", v: 2 },
      { k: "c", v: 2 },
      { k: "d", v: 1 },
    ];
    const spec: PivotSpec = {
      version: 1,
      rows: [{ field: "k", order: ["d", "c"], sort: "asc", sortBy: { measure: "v" } }],
      measures: [{ id: "v", field: "v" }],
    };
    expect(buildPivotModel(spec, data).rows.filter((r) => r.kind === "leaf").map((r) => r.label)).toEqual(["c", "b", "d", "a"]);
  });
});

describe("engine parity with aggregatePivotRows", () => {
  it("every built-in aggregate, weighted average, ratio, count and custom match per node and column", () => {
    const rand = (() => {
      let s = 9;
      return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    })();
    const vals = [null, undefined, "", "12.5", "abc", 0, -3, 7.25, 100, Infinity];
    const data = Array.from({ length: 400 }, (_, i) => ({
      g: ["x", "y", null][Math.floor(rand() * 3)],
      h: ["p", "q", "r", "s"][Math.floor(rand() * 4)],
      c: ["c1", "c2", "c3"][i % 3],
      v: vals[Math.floor(rand() * vals.length)],
      w: vals[Math.floor(rand() * vals.length)],
    }));
    const aggregates = [
      "sum",
      "avg",
      "min",
      "max",
      "first",
      "last",
      "count",
      { type: "weightedAvg", weightField: "w" },
      { type: "ratio", numeratorField: "v", denominatorField: "w", offset: -1 },
      { type: "custom", name: "spread" },
    ] as const;
    const spec: PivotSpec = {
      version: 1,
      rows: [{ field: "g" }, { field: "h" }],
      columns: { field: "c" },
      measures: [...aggregates.map((aggregate, i) => ({ id: `m${i}`, field: "v", aggregate })), { id: "rows", aggregate: "count" as const }],
      totals: { rowTotal: true },
    };
    const aggregators = { spread: (values: readonly number[]) => (values.length ? Math.max(...values) - Math.min(...values) : null) };
    const m = buildPivotModel(spec, data, { aggregators });
    for (const row of m.rows) {
      const inRow = data.filter((r) => row.path.every((k, d) => String(r[d === 0 ? "g" : "h"] ?? "") === k));
      row.cells.forEach((cell, i) => {
        const col = m.columns[i]!;
        const measure = spec.measures.find((x) => x.id === col.measureId)!;
        const bucket = col.columnKey === null ? inRow : inRow.filter((r) => r.c === col.columnKey);
        const expected = bucket.length === 0 ? null : aggregatePivotRows(bucket, measure.aggregate, measure.field, aggregators);
        expect(cell.raw, `${row.id} ${col.id}`).toBe(expected);
      });
    }
  });
});

describe("tree building", () => {
  it("falls back to per-level lookups when the composite leaf key would overflow", () => {
    // 5 levels × 2000 distinct keys → radix product ≫ 2^52.
    const data = Array.from({ length: 2000 }, (_, i) => ({ a: `a${i}`, b: `b${i}`, c: `c${i}`, d: `d${i}`, e: `e${i}`, owner: i % 2 ? "x" : null, v: i }));
    const spec: PivotSpec = {
      version: 1,
      rows: ["a", "b", "c", "d", "e"].map((field) => ({ field, ...(field === "a" ? { attributes: ["owner"] } : {}) })),
      measures: [{ id: "v", field: "v" }, { id: "f", field: "v", aggregate: "first" }],
      expanded: "none",
    };
    const m = buildPivotModel(spec, data);
    expect(m.rows).toHaveLength(2001);
    expect(m.grandTotal.cells.map((c) => c.raw)).toEqual([(1999 * 2000) / 2, 0]);
    expect(m.rows[1]!.attributes).toEqual({ owner: "x" });
    expect(m.rows[0]!.attributes).toEqual({ owner: null });
  });
});

describe("spec helpers", () => {
  it("setPivotFilter / clearPivotFilter(s) keep the spec minimal", () => {
    const a = setPivotFilter(base, { field: "department", include: ["Camp"] });
    expect(a.filters).toEqual([{ field: "department", include: ["Camp"] }]);
    const b = setPivotFilter(setPivotFilter(a, { field: "line", match: { op: "contains", value: "s" } }), { field: "department", exclude: ["Packs"] });
    expect(b.filters!.map((f) => f.field)).toEqual(["department", "line"]); // replaced in place
    expect(clearPivotFilter(b, "line").filters).toEqual([{ field: "department", exclude: ["Packs"] }]);
    expect("filters" in clearPivotFilters(b)).toBe(false);
    expect("filters" in setPivotFilter(a, { field: "department" })).toBe(false);
    expect(clearPivotFilter(base, "nope")).toBe(base);
  });

  it("togglePivotFilterValue: Excel slicer semantics", () => {
    let s = togglePivotFilterValue(base, "department", "Camp", { mode: "only" });
    expect(s.filters).toEqual([{ field: "department", include: ["Camp"] }]);
    expect(togglePivotFilterValue(s, "department", "Camp", { mode: "only" })).toBe(s);
    s = togglePivotFilterValue(s, "department", "Packs");
    expect(s.filters).toEqual([{ field: "department", include: ["Camp", "Packs"] }]);
    s = togglePivotFilterValue(togglePivotFilterValue(s, "department", "Camp"), "department", "Packs");
    expect(s.filters).toBeUndefined(); // deselecting the last key shows everything
    s = togglePivotFilterValue(base, "department", "Camp"); // toggle from "all" → exclude
    expect(s.filters).toEqual([{ field: "department", exclude: ["Camp"] }]);
    expect(togglePivotFilterValue(s, "department", "Camp").filters).toBeUndefined();
    const withMatch = setPivotFilter(base, { field: "line", match: { op: "contains", value: "a" } });
    expect(togglePivotFilterValue(withMatch, "line", "Tents", { mode: "only" }).filters).toEqual([
      { field: "line", match: { op: "contains", value: "a" }, include: ["Tents"] },
    ]);
  });

  it("pivotFilterForSelection / setPivotFilterValues pick the shorter list", () => {
    const all = ["a", "b", "c", "d"];
    expect(pivotFilterForSelection("f", all, all)).toBeNull();
    expect(pivotFilterForSelection("f", all, ["a"])).toEqual({ field: "f", include: ["a"] });
    expect(pivotFilterForSelection("f", all, ["a", "b", "c"])).toEqual({ field: "f", exclude: ["d"] });
    expect(pivotFilterForSelection("f", all, [])).toEqual({ field: "f", include: [] });
    expect(setPivotFilterValues(base, "line", ["Tents", "Kids"], ["Kids"]).filters).toEqual([{ field: "line", include: ["Kids"] }]);
    expect(setPivotFilterValues(base, "line", ["Tents"], ["Tents"]).filters).toBeUndefined();
  });

  it("setPivotSort / setPivotTopN", () => {
    const v = setPivotSort(base, "line", { by: "value", measure: "actual", direction: "asc" });
    expect(v.rows[1]).toEqual({ field: "line", label: "Line", sortBy: { measure: "actual", direction: "asc" } });
    const l = setPivotSort(v, "line", { by: "label", direction: "desc" });
    expect(l.rows[1]).toEqual({ field: "line", label: "Line", sort: "desc" });
    expect(setPivotSort(l, "line", null).rows[1]).toEqual({ field: "line", label: "Line" });
    expect(pivotColumnFields(setPivotSort(base, "month", { by: "label", direction: "asc" }))[0]!.sort).toBe("asc");
    expect(() => setPivotSort(base, "month", { by: "value", measure: "actual" })).toThrow(/not supported/);
    expect(setPivotSort(base, "nope", null)).toBe(base);
    const t = setPivotTopN(base, "line", { measure: "actual", count: 3 });
    expect(t.rows[1]!.topN).toEqual({ measure: "actual", count: 3 });
    expect("topN" in setPivotTopN(t, "line", null).rows[1]!).toBe(false);
    expect(validatePivotSpec(t).ok).toBe(true);
  });
});

describe("validation", () => {
  it("reports bad filters, facets, sortBy and topN", () => {
    const bad = {
      ...base,
      columns: { ...base.columns!, sortBy: { measure: "actual" }, topN: { measure: "actual", count: 2 } },
      rows: [{ ...base.rows[0]!, sortBy: { measure: "nope", direction: "up" } }, { ...base.rows[1]!, topN: { measure: "actual", count: 0, direction: "middle" } }],
      filters: [{ field: "" }, { field: "line", include: [1] }, { field: "line", match: { op: "like", value: "x" } }],
      facets: ["line", { field: "line" }, 3],
    };
    const result = validatePivotSpec(bad);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toEqual([
      'rows[0].sortBy.direction must be "asc" | "desc"',
      "rows[1].topN.count must be an integer ≥ 1",
      'rows[1].topN.direction must be "top" | "bottom"',
      "columns.sortBy is only supported on row dimensions",
      "columns.topN is only supported on row dimensions",
      'rows[0].sortBy.measure references unknown measure "nope"',
      "filters[0].field must be a non-empty string",
      "filters[1].include must be an array of strings",
      "filters[2].match.op must be one of contains | notContains | beginsWith | endsWith | equals | notEquals",
      'facets[1] "line" is duplicated',
      "facets[2] must be a field name or { field, label? }",
    ]);
  });
});

describe("cube reuse", () => {
  it("view-only changes keep the data key; the builder skips re-reading records", () => {
    let reads = 0;
    const counted = rows.map((r) => {
      const o = { ...r };
      Object.defineProperty(o, "department", { enumerable: true, get: () => (reads++, r.department) });
      return o;
    });
    const builder = createPivotModelBuilder();
    const m1 = builder.build(base, counted);
    const afterFirst = reads;
    expect(afterFirst).toBeGreaterThan(0);
    const collapsed: PivotSpec = { ...base, expanded: "none", heat: { ...base.heat!, scope: "group" }, title: "Other title" };
    expect(pivotSpecDataKey(collapsed)).toBe(pivotSpecDataKey(base));
    const m2 = builder.build(collapsed, counted);
    expect(reads).toBe(afterFirst);
    expect(m2).toEqual(buildPivotModel(collapsed, rows));
    expect(builder.build(collapsed, counted)).toBe(m2); // same spec object → same model object
    expect(builder.build(base, counted)).toEqual(m1);
    // Filter change: new cube, but the department encoding is reused.
    const filtered = setPivotFilter(base, { field: "department", include: ["Camp"] });
    expect(builder.build(filtered, counted)).toEqual(buildPivotModel(filtered, rows));
    expect(reads).toBe(afterFirst);
    // New rows identity → re-encode.
    builder.build(base, [...counted]);
    expect(reads).toBeGreaterThan(afterFirst);
  });

  it("buildPivotCube + pivotModelFromCube equals buildPivotModel; describePivotFilters is spec-only", () => {
    const spec = setPivotTopN(setPivotFilter(base, { field: "month", exclude: ["Nov"] }), "line", { measure: "actual", count: 2, other: true });
    const cube = buildPivotCube(spec, rows, { encoding: createPivotRowEncoding(rows) });
    expect(pivotModelFromCube(cube, spec)).toEqual(buildPivotModel(spec, rows));
    expect(describePivotFilters(spec).map((f) => f.kind)).toEqual(["items", "value"]);
  });
});
