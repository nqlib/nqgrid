import { describe, expect, it } from "vitest";

import { computeSheetViewport } from "./use-sheet-viewport";

describe("computeSheetViewport", () => {
  it("computes frozen width from prefix columns", () => {
    const widths = Array.from({ length: 20 }, () => 50);
    const r = computeSheetViewport({
      rowCount: 100,
      columnCount: 20,
      rowHeight: 20,
      columnWidths: widths,
      viewportWidth: 300,
      viewportHeight: 200,
      frozenColumnCount: 2,
      scrollTop: 0,
      scrollLeft: 0,
    });
    expect(r.frozenWidth).toBe(100);
    expect(r.rowStart).toBe(0);
  });
});
