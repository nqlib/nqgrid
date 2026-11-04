import { describe, expect, it } from "vitest";
import { SALES_ORDERS } from "./mock-data";

describe("SALES_ORDERS fixture", () => {
  it("has 2,000 rows", () => {
    expect(SALES_ORDERS).toHaveLength(2000);
  });

  it("is deterministic — first row matches fixed expected values", () => {
    const first = SALES_ORDERS[0]!;
    expect(first.orderNo).toBe("SO-00000");
    expect(first.revenue).toBeCloseTo(25475.67, 2);
    expect(first.units).toBe(33);
    expect(first.unitPrice).toBeCloseTo(771.99, 2);
  });

  it("revenue ≈ units × unitPrice (rounding tolerant)", () => {
    for (const row of SALES_ORDERS) {
      expect(row.revenue).toBeCloseTo(row.units * row.unitPrice, 1);
    }
  });

  it("margin === revenue − cost (rounding tolerant)", () => {
    for (const row of SALES_ORDERS) {
      expect(row.margin).toBeCloseTo(row.revenue - row.cost, 1);
    }
  });
});
