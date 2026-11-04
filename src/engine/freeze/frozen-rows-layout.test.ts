import { describe, expect, it } from "vitest";

import {
  computeFrozenTopLayout,
  isFrozenTopRow,
  isLastFrozenTopRow,
  resolveFrozenTopPrefix,
} from "./frozen-rows-layout";

describe("computeFrozenTopLayout", () => {
  it("returns empty layout when no frozen rows", () => {
    const r = computeFrozenTopLayout(["r0", "r1"], [], () => 28);
    expect(r.frozen).toEqual([]);
    expect(r.totalFrozenHeightPx).toBe(0);
  });

  it("computes cumulative top and total height", () => {
    const heights: Record<string, number> = { r0: 30, r1: 40 };
    const r = computeFrozenTopLayout(["r0", "r1", "r2"], ["r0", "r1"], (id) => heights[id] ?? 0);
    expect(r.frozen).toEqual([
      { id: "r0", topPx: 0, heightPx: 30, freezeIndex: 0 },
      { id: "r1", topPx: 30, heightPx: 40, freezeIndex: 1 },
    ]);
    expect(r.totalFrozenHeightPx).toBe(70);
    expect(r.lastFrozenId).toBe("r1");
  });

  it("throws when frozen ids are not a prefix of visible ids", () => {
    expect(() => computeFrozenTopLayout(["r0", "r1"], ["r1"], () => 28)).toThrow();
  });
});

describe("resolveFrozenTopPrefix", () => {
  it("returns longest matching prefix", () => {
    expect(resolveFrozenTopPrefix(["r0", "r1", "r2"], ["r0", "r9"])).toEqual(["r0"]);
  });
});

describe("isFrozenTopRow", () => {
  it("detects frozen membership", () => {
    const layout = computeFrozenTopLayout(["r0", "r1"], ["r0"], () => 28);
    expect(isFrozenTopRow(layout, "r0")).toBe(true);
    expect(isFrozenTopRow(layout, "r1")).toBe(false);
  });
});

describe("isLastFrozenTopRow", () => {
  it("detects edge row", () => {
    const layout = computeFrozenTopLayout(["r0", "r1", "r2"], ["r0", "r1"], () => 28);
    expect(isLastFrozenTopRow(layout, "r1")).toBe(true);
    expect(isLastFrozenTopRow(layout, "r0")).toBe(false);
  });
});
