import { describe, expect, it } from "vitest";

import { colSpanCrossesFrozenBoundary } from "./col-span-frozen";

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
