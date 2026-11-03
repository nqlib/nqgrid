import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { buildPivotModel } from "../core/pivot/build-model";
import type { PivotFacet, PivotSpec } from "../core/pivot/types";
import { generatePlanningPivotRows, planningFilteredPivotSpec, planningPivotSpec } from "../fixtures/planning-pivot-mock";
import { reducePivotGridSpec } from "./grid-state";
import {
  PivotFilterMenu,
  PivotHeaderMenu,
  pivotFilterMenuMatches,
  pivotFilterMenuProps,
  pivotSelectAllState,
  pivotSlicerProps,
} from "./pivot-filter-menu";
import { pivotAriaSort, pivotDimensionStatus } from "./pivot-header-indicator";
import { PivotSlicer, pivotFacetOf, pivotSlicerItems } from "./pivot-slicer";
import { PivotTable } from "./pivot-table";
import type { PivotGridState } from "./use-pivot-grid";

const rows = generatePlanningPivotRows();
const model = buildPivotModel(planningPivotSpec, rows);
const filtered = buildPivotModel(planningFilteredPivotSpec, rows);
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe("reducePivotGridSpec: filter / sort actions", () => {
  it("routes to the core helpers", () => {
    const a = reducePivotGridSpec(planningPivotSpec, model, { type: "toggleFilterValue", field: "department", key: "Camp", mode: "only" });
    expect(a.filters).toEqual([{ field: "department", include: ["Camp"] }]);
    const b = reducePivotGridSpec(a, model, { type: "setFilter", filter: { field: "line", match: { op: "contains", value: "s" } } });
    expect(b.filters).toHaveLength(2);
    expect(reducePivotGridSpec(b, model, { type: "clearFilter", field: "line" }).filters).toEqual(a.filters);
    expect(reducePivotGridSpec(b, model, { type: "clearFilters" }).filters).toBeUndefined();
    const values = reducePivotGridSpec(planningPivotSpec, model, { type: "setFilterValues", field: "department", allKeys: ["A", "B", "C"], selected: ["A", "B"] });
    expect(values.filters).toEqual([{ field: "department", exclude: ["C"] }]);
    const sorted = reducePivotGridSpec(planningPivotSpec, model, { type: "setSort", field: "line", sort: { by: "value", measure: "actual" } });
    expect(sorted.rows[1]!.sortBy).toEqual({ measure: "actual" });
    const top = reducePivotGridSpec(planningPivotSpec, model, { type: "setTopN", field: "line", topN: { measure: "actual", count: 3 } });
    expect(top.rows[1]!.topN).toEqual({ measure: "actual", count: 3 });
  });
});

describe("PivotSlicer", () => {
  const dept = pivotFacetOf(filtered, "department");
  const line = pivotFacetOf(filtered, "line");

  it("is a labelled multi-select listbox of option buttons reflecting the facet", () => {
    const markup = html(createElement(PivotSlicer, { facet: dept, onToggleValue: () => {}, onClear: () => {} }));
    expect(markup).toContain('role="group"');
    expect(markup).toContain('role="listbox" aria-multiselectable="true"');
    expect(count(markup, /role="option"/g)).toBe(4);
    expect(count(markup, /aria-selected="true"/g)).toBe(2); // Camp, Packs
    expect(markup).toMatch(/aria-label="Camp"[^>]*tabindex="0"/i);
    expect(count(markup, /tabindex="0"/gi)).toBe(1); // one roving tab stop
    expect(markup).toContain('aria-label="Clear Department filter"');
    expect(markup).not.toMatch(/aria-label="Clear Department filter"[^>]*disabled/);
    expect(markup).toContain("nqg-pivot-slicer-item-selected");
  });

  it("greys out values with no data under the other filters and lists them last", () => {
    // Line is not filtered by value (only by label), but Department = Camp, Packs leaves other lines empty.
    const items = pivotSlicerItems(line);
    expect(items.slice(0, 11).every((v) => v.hasData)).toBe(true);
    expect(items.slice(11).every((v) => !v.hasData)).toBe(true);
    expect(items.find((v) => v.key === "Kids")).toMatchObject({ hasData: true, selected: false }); // label filter on itself
    expect(pivotSlicerItems(line, { hideItemsWithNoData: true })).toHaveLength(11);
    expect(pivotSlicerItems(line, { noDataLast: false })[0]!.key).toBe("Trail Runners");
    const markup = html(createElement(PivotSlicer, { facet: line, showCounts: true, columns: 3 }));
    expect(count(markup, /data-no-data=""/g)).toBe(11);
    expect(markup).toContain('aria-label="Jackets, 0, no data"');
    expect(markup).toContain("repeat(3, minmax(0, 1fr))");
    expect(markup).not.toContain("Clear"); // no onClear → no button
  });

  it("unfiltered facets select every value; clear is disabled; optional multi-select toggle", () => {
    const facet: PivotFacet = { field: "x", label: "X", filtered: false, values: [{ key: "a", label: "a", count: 1, total: 1, hasData: true, selected: true }] };
    const markup = html(createElement(PivotSlicer, { facet, onClear: () => {}, onMultiSelectChange: () => {}, multiSelect: true }));
    expect(markup).toMatch(/aria-label="Clear X filter"[^>]*disabled=""/);
    expect(markup).toContain('aria-pressed="true" aria-label="Multi-select"');
    expect(html(createElement(PivotSlicer, { facet, title: null }))).toContain('role="listbox" aria-multiselectable="true" aria-label="X"');
  });

  it("pivotFacetOf throws a hint for fields missing from spec.facets", () => {
    expect(() => pivotFacetOf(model, "line")).toThrow(/spec\.facets/);
  });
});

describe("PivotFilterMenu", () => {
  const facet = pivotFacetOf(filtered, "line");
  const dimension = filtered.rowDimensions[1]!;
  const measures = [
    { id: "actual", label: "Actual" },
    { id: "plan", label: "Plan" },
  ];

  it("renders sort, Top N and a searchable checklist reflecting the spec", () => {
    const markup = html(
      createElement(PivotFilterMenu, { facet, dimension, measures, onSortChange: () => {}, onTopNChange: () => {}, onApplyValues: () => {} }),
    );
    expect(markup).toContain('aria-label="Line filter"');
    expect(markup).toContain('aria-pressed="true" aria-label="Sort by value: Largest"'); // sortBy actual desc
    expect(markup).toMatch(/type="checkbox"[^>]*checked=""[^>]*\/>Show only/); // Top N on
    expect(markup).toContain('value="3"');
    expect(markup).toContain("Group the rest as “Other”");
    expect(markup).toContain('type="search"');
    expect(count(markup, /<li>/g)).toBe(facet.values.length);
    expect(markup).toContain('aria-checked="mixed"'); // Kids unchecked, others checked
    expect(markup).toMatch(/Apply<\/button>/);
    expect(markup).toMatch(/disabled=""[^>]*>Apply/); // nothing changed yet
  });

  it("hides sort and Top N without a dimension or callbacks", () => {
    const markup = html(createElement(PivotFilterMenu, { facet, search: false, showCounts: false }));
    expect(markup).not.toContain("Sort");
    expect(markup).not.toContain("Show only");
    expect(markup).not.toContain('type="search"');
  });

  it("pure helpers: search and select-all state", () => {
    expect(pivotFilterMenuMatches(facet.values, " PACK ").map((v) => v.key)).toEqual(["Daypacks", "Backpacking"]);
    const two = facet.values.slice(0, 2);
    expect(pivotSelectAllState(two, new Set())).toBe(false);
    expect(pivotSelectAllState(two, new Set([two[0]!.key]))).toBe("mixed");
    expect(pivotSelectAllState(two, new Set(two.map((v) => v.key)))).toBe(true);
  });

  it("PivotHeaderMenu: inline disclosure (closed by default, dialog when open)", () => {
    const closed = html(createElement(PivotHeaderMenu, { label: "Filter Line", active: true, children: "panel" }));
    expect(closed).toContain('aria-haspopup="dialog" aria-expanded="false"');
    expect(closed).toContain("data-active");
    expect(closed).not.toContain("panel");
    const open = html(createElement(PivotHeaderMenu, { label: "Filter Line", open: true, children: (close: () => void) => (typeof close === "function" ? "panel" : "") }));
    expect(open).toContain('role="dialog" aria-label="Filter Line"');
    expect(open).toContain(">panel</div>");
  });
});

describe("grid bindings", () => {
  const grid = {
    spec: planningFilteredPivotSpec,
    model: filtered,
    toggleFilterValue: vi.fn(),
    clearFilter: vi.fn(),
    setFilterValues: vi.fn(),
    setTopN: vi.fn(),
    setSort: vi.fn(),
    setSpec: vi.fn(),
  } as unknown as PivotGridState;

  it("pivotSlicerProps / pivotFilterMenuProps call the grid actions", () => {
    const s = pivotSlicerProps(grid, "department");
    s.onToggleValue!("Camp", "only");
    s.onClear!();
    expect(grid.toggleFilterValue).toHaveBeenCalledWith("department", "Camp", "only");
    expect(grid.clearFilter).toHaveBeenCalledWith("department");

    const m = pivotFilterMenuProps(grid, "line");
    expect(m.measures!.map((x) => x.id)).toEqual(["actual", "plan", "forecast", "outlook", "growth"]);
    m.onApplyValues!(["Tents"], ["Tents", "Kids"]);
    expect(grid.setFilterValues).toHaveBeenCalledWith("line", ["Tents", "Kids"], ["Tents"]);
    m.onTopNChange!(null);
    expect(grid.setTopN).toHaveBeenCalledWith("line", null);
    m.onSortChange!({ by: "label", direction: "asc" });
    expect(grid.setSort).toHaveBeenCalledWith("line", { by: "label", direction: "asc" });
    m.onClear!();
    const updater = vi.mocked(grid.setSpec).mock.calls[0]![0] as (s: PivotSpec) => PivotSpec;
    const cleared = updater(planningFilteredPivotSpec);
    expect(cleared.filters).toEqual([{ field: "department", include: ["Camp", "Packs"] }]);
    expect(cleared.rows[1]!.topN).toBeUndefined();
    // Department is a row dimension too, but a non-dimension field gets no sort / Top N callbacks.
    const owner = pivotFilterMenuProps({ ...grid, model: buildPivotModel({ ...planningPivotSpec, facets: ["owner"] }, rows) } as PivotGridState, "owner");
    expect(owner.dimension).toBeUndefined();
    expect(owner.onSortChange).toBeUndefined();
  });
});

describe("header indicators", () => {
  it("dimension status, aria-sort and the indicator in PivotTable headers", () => {
    const status = pivotDimensionStatus(filtered, 1);
    expect(status).toMatchObject({ sort: "desc", sortedByValue: true, filtered: true });
    expect(status.description).toBe('Sorted by Actual, descending · Line does not contain "kids" · Line: Top 3 by Actual, rest as Other');
    expect(pivotAriaSort(status)).toBe("descending");
    expect(pivotDimensionStatus(filtered, 0)).toMatchObject({ sort: null, filtered: true, description: "Department = Camp, Packs" });
    expect(pivotDimensionStatus(model, 0)).toMatchObject({ sort: null, filtered: false, description: "" });

    const markup = html(createElement(PivotTable, { model: filtered, mode: "static" }));
    expect(markup).toContain('aria-sort="descending"');
    expect(count(markup, /data-nqg-indicator=""/g)).toBe(2);
    // Inactive headers stay plain text.
    expect(html(createElement(PivotTable, { model, mode: "static" }))).not.toContain("data-nqg-indicator");

    const custom = html(
      createElement(PivotTable, {
        model: filtered,
        renderDimensionHeader: ({ label, level, indicator }) => createElement("span", { "data-custom": level }, label, indicator),
      }),
    );
    expect(custom).toContain('data-custom="0"');
    expect(custom).toContain('data-custom="1"');
    // Other row ("\u0000other" key) renders with its label.
    expect(markup).toContain(">Other<");
  });
});
