import { describe, expect, it } from "vitest";
import {
  DEFAULT_PINNED_Z,
  getPinnedCellZIndex,
  getPinnedDataAttr,
  getPinnedRowStickyStyle,
  resolvePinnedRegion,
} from "./pinned-cell-styles";

describe("resolvePinnedRegion", () => {
  it("classifies the four regions", () => {
    expect(resolvePinnedRegion({ columnPinned: false, rowPinned: false })).toBe("body");
    expect(resolvePinnedRegion({ columnPinned: true, rowPinned: false })).toBe("left");
    expect(resolvePinnedRegion({ columnPinned: false, rowPinned: "top" })).toBe("top");
    expect(resolvePinnedRegion({ columnPinned: false, rowPinned: "bottom" })).toBe("bottom");
    expect(resolvePinnedRegion({ columnPinned: true, rowPinned: "top" })).toBe("corner");
  });
});

describe("getPinnedCellZIndex", () => {
  it("layers corner > row > column > body", () => {
    const z = (r: Parameters<typeof getPinnedCellZIndex>[0]) => getPinnedCellZIndex(r);
    expect(z("corner")).toBeGreaterThan(z("top"));
    expect(z("top")).toBeGreaterThan(z("left"));
    expect(z("left")).toBeGreaterThan(z("body"));
    expect(z("bottom")).toBe(DEFAULT_PINNED_Z.row);
  });
});

describe("getPinnedDataAttr", () => {
  it("returns undefined for body, the region otherwise", () => {
    expect(getPinnedDataAttr("body")).toBeUndefined();
    expect(getPinnedDataAttr("left")).toBe("left");
    expect(getPinnedDataAttr("corner")).toBe("corner");
  });
});

describe("getPinnedRowStickyStyle", () => {
  it("sticks to the requested edge with offset + row z", () => {
    expect(getPinnedRowStickyStyle({ edge: "top", offsetPx: 32 })).toEqual({
      position: "sticky",
      top: 32,
      zIndex: DEFAULT_PINNED_Z.row,
    });
    expect(getPinnedRowStickyStyle({ edge: "bottom", offsetPx: 0, zIndex: 99 })).toEqual({
      position: "sticky",
      bottom: 0,
      zIndex: 99,
    });
  });
});
