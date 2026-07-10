import { describe, expect, it } from "vitest";
import { buildSalesPivot } from "./pivot-demo";
import type { PivotResult } from "@nqlib/nqgrid";

/** Resolve a leaf key by its column path + measure (avoids the engine's SEP char). */
function leafKey(result: PivotResult, path: string[], measureKey: string): string {
  const leaf = result.columnLeaves.find(
    (l) => l.measureKey === measureKey && l.path.join("/") === path.join("/"),
  );
  if (!leaf) throw new Error(`no leaf for ${path.join("/")} / ${measureKey}`);
  return leaf.key;
}

describe("buildSalesPivot", () => {
  const result = buildSalesPivot();
  const q1Rev = leafKey(result, ["Q1"], "revenue");
  const q2Rev = leafKey(result, ["Q2"], "revenue");
  const q1Units = leafKey(result, ["Q1"], "units");

  it("intersection cell: East / Hardware / Q1 revenue = 100, units = 10", () => {
    const cell = result.rows.find(
      (r) => r.kind === "leaf" && r.path[0] === "East" && r.path[1] === "Hardware",
    );
    expect(cell).toBeDefined();
    expect(cell!.cells[q1Rev]).toBe(100);
    expect(cell!.cells[q1Units]).toBe(10);
  });

  it("subtotal row: East Q1 revenue = 360, East Q2 revenue = 420", () => {
    // East Q1 revenue = 100 (HW) + 200 (SW) + 60 (Svc) = 360
    // East Q2 revenue = 120 (HW) + 220 (SW) + 80 (Svc) = 420
    const subtotal = result.rows.find(
      (r) => r.kind === "subtotal" && r.path.length === 1 && r.path[0] === "East",
    );
    expect(subtotal).toBeDefined();
    expect(subtotal!.cells[q1Rev]).toBe(360);
    expect(subtotal!.cells[q2Rev]).toBe(420);
  });

  it("grand total: Q1 revenue = 840, Q2 revenue = 1040", () => {
    // Q1: East 360 + West 430 + North 50 = 840
    // Q2: East 420 + West 440 + North 180 = 1040
    expect(result.grandTotal).not.toBeNull();
    expect(result.grandTotal![q1Rev]).toBe(840);
    expect(result.grandTotal![q2Rev]).toBe(1040);

    const grandRow = result.rows.find((r) => r.kind === "grandTotal");
    expect(grandRow).toBeDefined();
    expect(grandRow!.cells[q1Rev]).toBe(840);
  });
});
