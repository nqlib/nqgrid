import { describe, expect, it } from "vitest";
import { buildOrdersPivot, buildPivotFromZones } from "./pivot-view";
import type { PivotZones } from "./pivot-field-panel";
import { SALES_ORDERS } from "./mock-data";

describe("buildOrdersPivot (default config)", () => {
  const result = buildOrdersPivot();

  it("grand-total revenue equals the sum of all order revenues", () => {
    const expected = SALES_ORDERS.reduce((sum, r) => sum + r.revenue, 0);
    expect(result.grandTotal).not.toBeNull();
    const grandRevenue = Object.entries(result.grandTotal!)
      .filter(([key]) =>
        result.columnLeaves.some((l) => l.key === key && l.measureKey === "revenue"),
      )
      .reduce((sum, [, value]) => sum + (value ?? 0), 0);
    expect(grandRevenue).toBeCloseTo(expected, 1);
  });

  it("emits region → category leaf rows plus subtotals and a grand total", () => {
    expect(result.rows.some((r) => r.kind === "leaf")).toBe(true);
    expect(result.rows.some((r) => r.kind === "subtotal")).toBe(true);
    expect(result.rows.some((r) => r.kind === "grandTotal")).toBe(true);
  });
});

describe("buildPivotFromZones (field-list mapping)", () => {
  const baseZones: PivotZones = {
    filters: [],
    rows: ["region"],
    columns: ["quarter"],
    values: ["revenue"],
  };

  it("grand-total revenue equals the sum of all order revenues", () => {
    const result = buildPivotFromZones(baseZones);
    const expected = SALES_ORDERS.reduce((sum, r) => sum + r.revenue, 0);
    expect(result.grandTotal).not.toBeNull();
    const grandRevenue = Object.entries(result.grandTotal!)
      .filter(([key]) =>
        result.columnLeaves.some((l) => l.key === key && l.measureKey === "revenue"),
      )
      .reduce((sum, [, value]) => sum + (value ?? 0), 0);
    expect(grandRevenue).toBeCloseTo(expected, 1);
  });

  it("moving category into Columns increases the column-leaf count", () => {
    const before = buildPivotFromZones(baseZones).columnLeaves.length;
    const after = buildPivotFromZones({
      ...baseZones,
      columns: ["quarter", "category"],
    }).columnLeaves.length;
    expect(after).toBeGreaterThan(before);
  });
});
