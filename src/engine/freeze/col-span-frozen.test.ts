import { describe, expect, it } from "vitest";

import { colSpanCrossesFrozenBoundary, spanCrossesFreezeBoundary } from "./col-span-frozen";

describe("colSpanCrossesFrozenBoundary", () => {
  it("flags span from frozen into scrollable", () => {
    expect(colSpanCrossesFrozenBoundary(true, 0, 3, 1)).toBe(true);
  });

  it("allows span fully inside frozen region", () => {
    expect(colSpanCrossesFrozenBoundary(true, 0, 2, 1)).toBe(false);
  });

  it("flags span from scrollable into frozen", () => {
    expect(colSpanCrossesFrozenBoundary(false, 1, 2, 1)).toBe(true);
  });
});

describe("spanCrossesFreezeBoundary", () => {
  it("flags rowspan crossing frozen row boundary", () => {
    expect(
      spanCrossesFreezeBoundary({
        columnFrozen: false,
        columnIndex: 2,
        colSpan: 1,
        lastFrozenColumnIndex: 0,
        rowFrozen: true,
        rowIndex: 0,
        rowSpan: 3,
        lastFrozenRowIndex: 1,
      }),
    ).toBe(true);
  });
});
