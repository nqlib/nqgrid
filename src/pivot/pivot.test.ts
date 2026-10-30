import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTable, getCoreRowModel } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";

import { buildPivotModel } from "../core/pivot/build-model";
import type { PivotSpec } from "../core/pivot/types";
import { generatePlanningPivotRows, planningPivotSpec } from "../fixtures/planning-pivot-mock";
import { reducePivotGridSpec } from "./grid-state";
import { pivotHeatCellProps } from "./heat";
import {
  pivotBarPath,
  pivotBarSegments,
  pivotDimensionSlots,
  pivotHeaderSummary,
  pivotHeatStep,
  pivotInitials,
  pivotKpiPanelParts,
  pivotTableGeometry,
} from "./layout";
import { getPivotColumnMeta, pivotDimensionText, pivotModelToTanstack } from "./tanstack";
import { usePivotGrid } from "./use-pivot-grid";

const rows = generatePlanningPivotRows();
const model = buildPivotModel(planningPivotSpec, rows);

describe("reducePivotGridSpec", () => {
  it("routes actions to the core spec helpers", () => {
    const collapsed = reducePivotGridSpec(planningPivotSpec, model, { type: "toggleGroup", path: ["Camp"] });
    expect(collapsed.expanded).toEqual([["Packs"]]);
    const all = reducePivotGridSpec(planningPivotSpec, model, { type: "expandAll" });
    expect(all.expanded).toBe("all");
    expect(reducePivotGridSpec(all, model, { type: "collapseAll" }).expanded).toBe("none");
    const heat = reducePivotGridSpec(planningPivotSpec, model, { type: "setHeatScope", scope: "group" });
    expect(heat.heat).toEqual({ ...planningPivotSpec.heat, scope: "group" });
    // Spec in, spec out: nothing else is mutated.
    expect(planningPivotSpec.heat?.scope).toBe("all");
  });

  it("setSpec accepts a value or an updater", () => {
    const next: PivotSpec = { ...planningPivotSpec, title: "X" };
    expect(reducePivotGridSpec(planningPivotSpec, model, { type: "setSpec", spec: next })).toBe(next);
    expect(reducePivotGridSpec(planningPivotSpec, model, { type: "setSpec", spec: (s) => ({ ...s, title: "Y" }) }).title).toBe("Y");
  });
});

describe("usePivotGrid", () => {
  it("builds the model from the spec on first render (server render, no effects)", () => {
    let seen: ReturnType<typeof usePivotGrid> | null = null;
    function Probe() {
      seen = usePivotGrid(planningPivotSpec, rows);
      return createElement("span", null, seen.model.rows.length);
    }
    expect(renderToStaticMarkup(createElement(Probe))).toBe(`<span>${model.rows.length}</span>`);
    expect(seen!.spec).toBe(planningPivotSpec);
    expect(seen!.model).toEqual(model);
  });

  it("controlled mode reports the next spec instead of storing it", () => {
    const reported: PivotSpec[] = [];
    function Probe() {
      const grid = usePivotGrid(planningPivotSpec, rows, { onSpecChange: (s) => reported.push(s) });
      grid.setHeatScope("column");
      grid.toggleGroup(["Footwear"]);
      return null;
    }
    renderToStaticMarkup(createElement(Probe));
    expect(reported.map((s) => s.heat?.scope)).toEqual(["column", "all"]);
    expect(reported[1]!.expanded).toEqual([["Camp"], ["Packs"], ["Footwear"]]);
  });
});

describe("layout helpers", () => {
  it("geometry: fixed widths and sticky offsets", () => {
    const g = pivotTableGeometry(model);
    expect(g.dimensionWidths).toEqual([208, 172]);
    expect(g.dimensionOffsets).toEqual([0, 208]);
    expect(g.width).toBe(208 + 172 + 12 * 84);
    expect(pivotTableGeometry({ ...model, layout: "compact" }).dimensionColumns).toBe(1);
  });

  it("dimension slots follow model.spans (department spans, group summary, leaves)", () => {
    const slots = pivotDimensionSlots(model);
    const types = slots.map((s) => s.map((x) => (x.type === "span" ? `span${x.rowSpan}` : x.type)).join(","));
    expect(types.slice(0, 4)).toEqual(["span1,group", "span1,group", "span6,group", "covered,leaf"]);
    expect(types[8]).toBe("span7,group");
    expect(types[types.length - 1]).toBe("grandTotal");
    // One slot per dimension column (one grand-total slot spanning both).
    expect(slots.every((s, i) => s.length === (model.rows[i]!.kind === "grandTotal" ? 1 : 2))).toBe(true);
  });

  it("maps model heat levels onto the 9 CSS steps", () => {
    expect(pivotHeatStep(0, 9)).toBe(0);
    expect(pivotHeatStep(8, 9)).toBe(8);
    expect(pivotHeatStep(2, 5)).toBe(4);
    expect(pivotHeatStep(4, 5)).toBe(8);
    expect(pivotHeatStep(0, 1)).toBe(0);
    expect(pivotHeatCellProps({ value: 1, raw: 1, text: "1", heat: 3 }, 9)).toMatchObject({
      className: expect.stringContaining("nqg-heat-3"),
      "data-heat": 3,
      style: { backgroundColor: expect.stringContaining("var(--nqg-heat-3,") },
    });
    expect(pivotHeatCellProps({ value: 1, raw: 1, text: "1" }, 9)).toEqual({ className: "" });
  });

  it("stacked header bars are anchored to the baseline and scaled to the series max", () => {
    const series = model.headerSeries!;
    const tallest = series.points.find((p) => p.value === series.max)!;
    const segs = pivotBarSegments(tallest, series.max, { width: 84, height: 44, gap: 0 });
    expect(segs).toHaveLength(4);
    expect(segs[0]!.y + segs[0]!.height).toBeCloseTo(44);
    expect(segs[segs.length - 1]!.y).toBeCloseTo(0);
    expect(segs.map((s) => s.top)).toEqual([false, false, false, true]);
    expect(pivotBarSegments(tallest, null, { width: 84, height: 44 })).toEqual([]);
    expect(pivotBarPath({ x: 0, y: 0, width: 10, height: 20 }, 0)).toBe("M0,20V0H10V20Z");
  });

  it("header summary totals the series and carries the grand headline KPI", () => {
    const s = pivotHeaderSummary(model)!;
    expect(s.label).toBe("Actual");
    expect(s.total).toBe(model.headerSeries!.points.reduce((a, p) => a + (p.value ?? 0), 0));
    expect(s.totalText).toMatch(/^\$\d+(\.\d)?M$/);
    expect(s.headline?.id).toBe("growth");
  });

  it("KPI panel parts: headline, value rows and 'vs' deltas", () => {
    const camp = model.rows.find((r) => r.label === "Camp")!;
    const parts = pivotKpiPanelParts(camp.kpis!);
    expect(parts.headline?.label).toBe("Growth on FY25");
    expect(parts.values.map((k) => k.label)).toEqual(["Forecast", "Outlook", "Plan"]);
    expect(parts.deltas).toEqual([{ id: "outlook", label: "vs Plan", delta: expect.any(Number), text: "+0.4%" }]);
    expect(pivotKpiPanelParts(camp.kpis!, "plan").headline?.id).toBe("plan");
    expect(pivotInitials("Ingrid  Solberg")).toBe("IS");
  });
});

describe("pivotModelToTanstack", () => {
  it("dimension + value columns with left pinning and stable row ids", () => {
    const t = pivotModelToTanstack(model);
    expect(t.columns.map((c) => c.id).slice(0, 3)).toEqual(["dim:0", "dim:1", "c:Nov:actual"]);
    expect(t.columnPinning.left).toEqual(["dim:0", "dim:1"]);
    expect(getPivotColumnMeta(t.columns[2]!)).toMatchObject({ kind: "value", index: 0 });

    const table = createTable({
      data: t.data,
      columns: t.columns,
      getRowId: t.getRowId,
      getCoreRowModel: getCoreRowModel(),
      state: { columnPinning: t.columnPinning },
      onStateChange: () => {},
      renderFallbackValue: null,
    });
    expect(table.getLeftLeafColumns().map((c) => c.id)).toEqual(["dim:0", "dim:1"]);
    const tents = table.getRow(model.rows.find((r) => r.label === "Tents")!.id);
    expect(tents.getValue("dim:0")).toBe("Camp");
    expect(tents.getValue("dim:1")).toBe("Tents");
    expect(pivotDimensionText(model.grandTotal, 0)).toBe("Grand Total");
  });
});
