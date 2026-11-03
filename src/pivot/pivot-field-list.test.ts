import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { pivotColumnFields } from "../core/pivot/columns";
import { buildPivotModel, createPivotModelBuilder } from "../core/pivot/build-model";
import { PIVOT_VALUES_FIELD, resolvePivotFields } from "../core/pivot/fields";
import type { PivotSpec } from "../core/pivot/types";
import { generatePlanningPivotRows, planningDatesPivotSpec, planningFieldCatalog, planningFieldsPivotSpec, planningPivotSpec } from "../fixtures/planning-pivot-mock";
import { pivotAutoScrollStep, pivotDropIndex, pivotDropZoneProps, pivotFieldDragHandleProps } from "./field-drag";
import { reducePivotGridSpec } from "./grid-state";
import { PivotFieldList, pivotFieldListProps, pivotKeyboardDragStep, pivotKeyboardDropIndex, type PivotKeyboardDrag } from "./pivot-field-list";
import { PivotTable } from "./pivot-table";
import type { PivotGridState } from "./use-pivot-grid";
import type { PivotLayoutDraftState } from "./use-pivot-layout-draft";

const rows = generatePlanningPivotRows(7, { extraFields: true });
const spec: PivotSpec = { ...planningPivotSpec, fields: planningFieldCatalog };
const fields = resolvePivotFields(spec);
const model = buildPivotModel(spec, rows);
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe("reducePivotGridSpec: field-list actions", () => {
  it("routes to the core move helpers", () => {
    const moved = reducePivotGridSpec(spec, model, { type: "moveField", move: { field: "line", from: "rows", to: "columns" }, fields });
    expect(pivotColumnFields(moved).map((d) => d.field)).toEqual(["month", "line"]);
    const added = reducePivotGridSpec(spec, model, { type: "addMeasure", field: "units", fields });
    expect(added.values).toEqual(["actual", "units"]);
    const avg = reducePivotGridSpec(added, model, { type: "setMeasureAggregate", measureId: "units", aggregate: "avg", fields });
    expect(avg.measures.at(-1)!.aggregate).toBe("avg");
    expect(reducePivotGridSpec(added, model, { type: "setValuesPosition", index: 0 }).valuesIndex).toBe(0);
    expect(pivotColumnFields(reducePivotGridSpec(spec, model, { type: "swapRowsColumns" })).at(-1)?.field).toBe("line");
    expect(reducePivotGridSpec(spec, model, { type: "toggleField", field: "region", checked: true, fields }).rows.at(-1)!.field).toBe("region");
    expect(reducePivotGridSpec(spec, model, { type: "reorderField", area: "rows", field: "line", index: 0, fields }).rows[0]!.field).toBe("line");
    expect(reducePivotGridSpec(added, model, { type: "removeField", field: "units", from: "values", fields }).values).toEqual(["actual"]);
  });

  it("the builder serves facets for any field without rebuilding the model", () => {
    const builder = createPivotModelBuilder();
    const m = builder.build(spec, rows);
    const region = builder.facet(spec, rows, "region");
    expect(region.values.map((v) => v.key)).toEqual(["East", "North", "South", "West"]);
    expect(region.values.reduce((s, v) => s + v.count, 0)).toBe(rows.length);
    expect(builder.facet(spec, rows, "region")).toBe(region); // memoized per spec
    expect(builder.build(spec, rows)).toBe(m);
    const filtered: PivotSpec = { ...spec, filters: [{ field: "region", include: ["North"] }, { field: "department", include: ["Camp"] }] };
    const f = builder.facet(filtered, rows, "region");
    expect(f.filtered).toBe(true);
    expect(f.values.find((v) => v.key === "North")!.selected).toBe(true);
    expect(f.values.find((v) => v.key === "South")!.selected).toBe(false);
    expect(f.values.reduce((s, v) => s + v.count, 0)).toBe(rows.filter((r) => r.department === "Camp").length); // ignores its own filter
  });
});

describe("drag geometry (pure)", () => {
  it("insertion index by midpoint", () => {
    const rects = [
      { start: 0, end: 20 },
      { start: 24, end: 44 },
      { start: 48, end: 68 },
    ];
    expect(pivotDropIndex(rects, -5)).toBe(0);
    expect(pivotDropIndex(rects, 9)).toBe(0);
    expect(pivotDropIndex(rects, 11)).toBe(1);
    expect(pivotDropIndex(rects, 40)).toBe(2);
    expect(pivotDropIndex(rects, 100)).toBe(3);
    expect(pivotDropIndex([], 3)).toBe(0);
  });

  it("auto-scroll speeds up towards the edges", () => {
    expect(pivotAutoScrollStep(150, 100, 300)).toBe(0);
    expect(pivotAutoScrollStep(101, 100, 300)).toBeLessThan(0);
    expect(pivotAutoScrollStep(115, 100, 300)).toBeGreaterThan(pivotAutoScrollStep(101, 100, 300));
    expect(pivotAutoScrollStep(299, 100, 300)).toBeGreaterThan(0);
    expect(pivotAutoScrollStep(110, 100, 140)).toBe(0); // too small to scroll
  });

  it("zone and handle props", () => {
    expect(pivotDropZoneProps("rows", { axis: "x", offset: 1 })).toEqual({ "data-nqg-drop-zone": "rows", "data-nqg-drop-axis": "x", "data-nqg-drop-offset": "1" });
    const handle = pivotFieldDragHandleProps({ source: { field: "line", from: "rows", label: "Line" }, onDrop: () => {} });
    expect(handle["data-nqg-drag-source"]).toBe("line");
    expect(handle.style.touchAction).toBe("manipulation");
  });
});

describe("keyboard moves (pure)", () => {
  const lengths = { filters: 0, columns: 1, rows: 1, values: 1 } as const;
  const accepts = () => true;
  const start: PivotKeyboardDrag = { field: "line", from: "rows", to: "rows", position: 1 };

  it("arrows step within a zone and continue into neighbours", () => {
    expect(pivotKeyboardDragStep(start, "ArrowUp", { lengths, accepts })).toEqual({ ...start, position: 0 });
    expect(pivotKeyboardDragStep(start, "ArrowDown", { lengths, accepts })).toEqual({ ...start, to: "values", position: 0 });
    expect(pivotKeyboardDragStep({ ...start, position: 0 }, "ArrowUp", { lengths, accepts })).toEqual({ ...start, to: "columns", position: 1 });
    expect(pivotKeyboardDragStep(start, "ArrowLeft", { lengths, accepts })).toEqual({ ...start, to: "columns", position: 1 });
    expect(pivotKeyboardDragStep(start, "ArrowRight", { lengths, accepts })).toEqual({ ...start, to: "values", position: 1 });
    expect(pivotKeyboardDragStep({ ...start, to: "values" }, "ArrowRight", { lengths, accepts })).toBeNull();
    expect(pivotKeyboardDragStep(start, "Home", { lengths, accepts })).toEqual({ ...start, position: 0 });
    expect(pivotKeyboardDragStep(start, "x", { lengths, accepts })).toBeNull();
  });

  it("skips zones that refuse the chip", () => {
    const onlyRowsColumns = (a: string) => a === "columns";
    expect(pivotKeyboardDragStep(start, "ArrowDown", { lengths, accepts: onlyRowsColumns })).toBeNull();
    expect(pivotKeyboardDragStep(start, "ArrowLeft", { lengths, accepts: onlyRowsColumns })).toEqual({ ...start, to: "columns", position: 1 });
  });

  it("final position → insertion index", () => {
    expect(pivotKeyboardDropIndex({ ...start, position: 0 }, 1)).toBe(0);
    expect(pivotKeyboardDropIndex({ field: "a", from: "rows", to: "rows", position: 2 }, 0)).toBe(3);
    expect(pivotKeyboardDropIndex({ ...start, to: "columns", position: 1 }, 1)).toBe(1);
  });
});

describe("PivotFieldList markup", () => {
  const html = renderToStaticMarkup(createElement(PivotFieldList, { spec: planningFieldsPivotSpec, fields: resolvePivotFields(planningFieldsPivotSpec), onSpecChange: () => {} }));

  it("renders the checklist, four zones with chips and Σ Values", () => {
    for (const area of ["filters", "columns", "rows", "values", "unused"]) expect(html).toContain(`data-nqg-drop-zone="${area}"`);
    expect(count(html, /data-nqg-drop-item=""/g)).toBe(1 + 2 + 3 + 2); // region | Σ, month | department, channel, line | actual, units
    expect(html).toContain('data-nqg-chip-key="columns:Σ"');
    expect(html.indexOf('data-nqg-chip-key="columns:Σ"')).toBeLessThan(html.indexOf('data-nqg-chip-key="columns:month"'));
    expect(count(html, /type="checkbox"/g)).toBe(12 + 1 + 1); // fields + growth + defer
    expect(html).toContain('aria-roledescription="draggable field"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain("Defer layout update");
    expect(html).not.toContain("data-nqg-update"); // Update only while deferred
  });

  it("deferred mode shows a disabled Update button; class slots and labels apply", () => {
    const deferred = renderToStaticMarkup(
      createElement(PivotFieldList, {
        spec,
        fields,
        onSpecChange: () => {},
        defaultDeferLayout: true,
        classNames: { zone: "my-zone" },
        labels: { areas: { filters: "Filter", columns: "Spalten", rows: "Zeilen", values: "Werte" } },
      }),
    );
    expect(deferred).toMatch(/<button[^>]*disabled=""[^>]*data-nqg-update=""/);
    expect(count(deferred, /my-zone/g)).toBe(4);
    expect(deferred).toContain("Spalten");
    expect(deferred).not.toContain(`chip-key="columns:${PIVOT_VALUES_FIELD}"`);
  });

  it("the grid's dimension headers can be drag handles and drop zones (renderDimensionHeader)", () => {
    const table = renderToStaticMarkup(
      createElement(PivotTable, {
        model,
        renderDimensionHeader: (ctx) =>
          createElement(
            "span",
            { ...pivotDropZoneProps("rows", { axis: "x", offset: ctx.level }), "data-nqg-drop-item": "" },
            createElement("span", pivotFieldDragHandleProps({ source: { field: ctx.dimension.field, from: "rows", label: ctx.label }, onDrop: () => {} }), ctx.label),
          ),
      }),
    );
    expect(table).toContain('data-nqg-drop-zone="rows" data-nqg-drop-axis="x" data-nqg-drop-item=""');
    expect(table).toContain('data-nqg-drop-offset="1"');
    expect(table).toContain('data-nqg-drag-source="line"');
  });
});

describe("PivotFieldList: shared deferred draft and date fields", () => {
  it("a controlled draft (usePivotLayoutDraft) is what the areas show while deferred", () => {
    const draft = reducePivotGridSpec(spec, model, { type: "moveField", move: { field: "region", from: "unused", to: "columns" }, fields });
    const deferred = renderToStaticMarkup(createElement(PivotFieldList, { spec, fields, onSpecChange: () => {}, deferLayout: true, draft }));
    expect(deferred).toContain('data-nqg-chip-key="columns:region"');
    expect(deferred).toMatch(/data-nqg-update=""(?![^>]*disabled)/);
    const live = renderToStaticMarkup(createElement(PivotFieldList, { spec, fields, onSpecChange: () => {}, deferLayout: false, draft }));
    expect(live).not.toContain('data-nqg-chip-key="columns:region"');
  });

  it("pivotFieldListProps(grid, layout) binds the layout draft", () => {
    const grid = { spec, fields, setSpec: () => {}, facet: () => undefined, model } as unknown as PivotGridState;
    const layout = { deferred: true, draft: spec, setDeferred: () => {}, setDraft: () => {} } as unknown as PivotLayoutDraftState;
    expect(pivotFieldListProps(grid, layout)).toMatchObject({ deferLayout: true, draft: spec, onDeferLayoutChange: layout.setDeferred, onDraftChange: layout.setDraft });
    expect(pivotFieldListProps(grid)).not.toHaveProperty("draft");
  });

  it("derived date chips are labelled from their source field", () => {
    const dateRows = generatePlanningPivotRows(7, { extraFields: true, orderDates: true });
    const dateFields = resolvePivotFields(planningDatesPivotSpec, dateRows);
    const out = renderToStaticMarkup(createElement(PivotFieldList, { spec: planningDatesPivotSpec, fields: dateFields, onSpecChange: () => {} }));
    expect(out).toContain('data-nqg-chip-key="columns:orderDate:year"');
    expect(out).toContain(">Year (Order date)<");
    expect(out).toContain(">Quarter (Order date)<");
  });
});
