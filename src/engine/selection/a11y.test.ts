import { describe, expect, it } from "vitest";
import { getCellAria, getDragHandleAria, getRowAria } from "./a11y";

describe("getRowAria", () => {
  it("emits 1-based aria-rowindex with header offset", () => {
    expect(getRowAria({ index: 0 })["aria-rowindex"]).toBe(2);
    expect(getRowAria({ index: 0, headerOffset: 1 })["aria-rowindex"]).toBe(1);
  });

  it("only emits state attrs when provided", () => {
    expect(getRowAria({ index: 3 })).toEqual({ "aria-rowindex": 5 });
    expect(getRowAria({ index: 0, selected: true, expanded: false, grabbed: true })).toEqual({
      "aria-rowindex": 2,
      "aria-selected": true,
      "aria-expanded": false,
      "aria-grabbed": true,
    });
  });
});

describe("getCellAria", () => {
  it("emits 1-based aria-colindex", () => {
    expect(getCellAria({ colIndex: 0 })["aria-colindex"]).toBe(1);
    expect(getCellAria({ colIndex: 4, selected: true })).toEqual({
      "aria-colindex": 5,
      "aria-selected": true,
    });
  });
});

describe("getDragHandleAria", () => {
  it("flips dropeffect with grabbed state", () => {
    expect(getDragHandleAria({ label: "Reorder A" })).toEqual({
      role: "button",
      "aria-label": "Reorder A",
      "aria-grabbed": false,
      "aria-dropeffect": "none",
    });
    expect(getDragHandleAria({ label: "Reorder A", grabbed: true })["aria-dropeffect"]).toBe("move");
  });
});
