import { describe, expect, it } from "vitest";

import {
  computePinnedLayout,
  isLastPinnedColumn,
  isPinnedColumn,
  resolvePinnedLeftPrefix,
} from "./pinned-layout";

describe("computePinnedLayout", () => {
  it("returns empty layout when no pins", () => {
    const r = computePinnedLayout(["a", "b"], [], () => 100);
    expect(r.pinned).toEqual([]);
    expect(r.totalPinnedWidthPx).toBe(0);
  });

  it("computes cumulative left and total width", () => {
    const widths: Record<string, number> = { a: 40, b: 60 };
    const r = computePinnedLayout(["a", "b", "c"], ["a", "b"], (id) => widths[id] ?? 0);
    expect(r.pinned).toEqual([
      { id: "a", leftPx: 0, widthPx: 40, pinIndex: 0 },
      { id: "b", leftPx: 40, widthPx: 60, pinIndex: 1 },
    ]);
    expect(r.totalPinnedWidthPx).toBe(100);
    expect(r.lastPinnedId).toBe("b");
  });

  it("throws when pinned ids are not a prefix of visible ids", () => {
    expect(() => computePinnedLayout(["a", "b", "c"], ["b"], () => 10)).toThrow();
  });
});

describe("resolvePinnedLeftPrefix", () => {
  it("returns empty when first pinned column is missing from the start", () => {
    expect(resolvePinnedLeftPrefix(["a", "b"], ["b"])).toEqual([]);
  });

  it("returns longest matching prefix", () => {
    expect(resolvePinnedLeftPrefix(["a", "b", "c"], ["a", "b", "d"])).toEqual(["a", "b"]);
  });
});

describe("isPinnedColumn", () => {
  it("detects pinned membership", () => {
    const layout = computePinnedLayout(["x", "y"], ["x"], () => 50);
    expect(isPinnedColumn(layout, "x")).toBe(true);
    expect(isPinnedColumn(layout, "y")).toBe(false);
  });
});

describe("isLastPinnedColumn", () => {
  it("detects edge column", () => {
    const layout = computePinnedLayout(["a", "b", "c"], ["a", "b"], () => 10);
    expect(isLastPinnedColumn(layout, "b")).toBe(true);
    expect(isLastPinnedColumn(layout, "a")).toBe(false);
  });
});
