import { describe, expect, it } from "vitest";

import { freezePanesFromExcelCell, resolveFrozenLeftPrefix } from "./freeze-panes";

describe("freezePanesFromExcelCell", () => {
  const leafIds = ["name", "owner", "status", "due"];

  it("maps Excel cell B3 to one frozen column and two frozen body rows", () => {
    const state = freezePanesFromExcelCell(3, 2, leafIds);
    expect(state.headerRowCount).toBe(1);
    expect(state.frozenTopBodyRowCount).toBe(2);
    // Slices the real leaf ids, not fabricated `col-0` placeholders.
    expect(state.frozenLeftColumnIds).toEqual(["name"]);
  });

  it("slices a real-id prefix that resolveFrozenLeftPrefix actually freezes", () => {
    const state = freezePanesFromExcelCell(1, 3, leafIds);
    expect(state.frozenLeftColumnIds).toEqual(["name", "owner"]);
    // The output is usable end-to-end: it resolves against the visible ids.
    expect(resolveFrozenLeftPrefix(leafIds, state.frozenLeftColumnIds)).toEqual([
      "name",
      "owner",
    ]);
  });

  it("validates the 1-based cell bounds", () => {
    expect(() => freezePanesFromExcelCell(0, 1, leafIds)).toThrow();
    expect(() => freezePanesFromExcelCell(1, 0, leafIds)).toThrow();
  });
});

describe("resolveFrozenLeftPrefix", () => {
  it("delegates to pinned prefix resolution", () => {
    expect(resolveFrozenLeftPrefix(["a", "b"], ["a", "x"])).toEqual(["a"]);
  });
});
