import { describe, expect, it } from "vitest";
import {
  formatCellDisplay,
  toggleFormatForCells,
  type CellFormat,
} from "./format";

/**
 * The formatting toolbar's data layer: applying a format patch to the cells in
 * a selection. Toggle semantics (group on/off for text styles, set/clear for
 * align + numberFormat) are pure, so we lock them here; rendering/wiring are
 * exercised in the browser.
 */
describe("toggleFormatForCells", () => {
  const keys = ["r1:revenue", "r2:revenue", "r3:revenue"];

  it("turns a text style ON for all when the set is mixed", () => {
    const start: Record<string, CellFormat> = { "r1:revenue": { bold: true } };
    const next = toggleFormatForCells(start, keys, { bold: true });
    expect(next["r1:revenue"]?.bold).toBe(true);
    expect(next["r2:revenue"]?.bold).toBe(true);
    expect(next["r3:revenue"]?.bold).toBe(true);
  });

  it("turns a text style OFF for all when every cell already has it", () => {
    const start: Record<string, CellFormat> = {
      "r1:revenue": { bold: true },
      "r2:revenue": { bold: true },
      "r3:revenue": { bold: true },
    };
    const next = toggleFormatForCells(start, keys, { bold: true });
    // Prunes to empty entries → keys removed.
    expect(next["r1:revenue"]).toBeUndefined();
    expect(next["r2:revenue"]).toBeUndefined();
    expect(next["r3:revenue"]).toBeUndefined();
  });

  it("preserves other style flags when toggling one", () => {
    const start: Record<string, CellFormat> = {
      "r1:revenue": { bold: true, italic: true },
    };
    const next = toggleFormatForCells(start, ["r1:revenue"], { bold: true });
    expect(next["r1:revenue"]).toEqual({ italic: true });
  });

  it("sets numberFormat on all selected cells", () => {
    const next = toggleFormatForCells({}, keys, { numberFormat: "percent" });
    for (const k of keys) expect(next[k]?.numberFormat).toBe("percent");
  });

  it("overrides an existing numberFormat", () => {
    const start: Record<string, CellFormat> = {
      "r1:revenue": { numberFormat: "currency" },
    };
    const next = toggleFormatForCells(start, ["r1:revenue"], {
      numberFormat: "thousands",
    });
    expect(next["r1:revenue"]?.numberFormat).toBe("thousands");
  });

  it("clears numberFormat when every cell already equals the patch", () => {
    const start: Record<string, CellFormat> = {
      "r1:revenue": { numberFormat: "percent" },
      "r2:revenue": { numberFormat: "percent" },
      "r3:revenue": { numberFormat: "percent" },
    };
    const next = toggleFormatForCells(start, keys, { numberFormat: "percent" });
    for (const k of keys) expect(next[k]?.numberFormat).toBeUndefined();
  });

  it("sets align on all, then clears it when re-applied", () => {
    const set = toggleFormatForCells({}, keys, { align: "center" });
    for (const k of keys) expect(set[k]?.align).toBe("center");
    const cleared = toggleFormatForCells(set, keys, { align: "center" });
    for (const k of keys) expect(cleared[k]?.align).toBeUndefined();
  });

  it("is a no-op for an empty selection", () => {
    const start: Record<string, CellFormat> = { "r1:revenue": { bold: true } };
    expect(toggleFormatForCells(start, [], { bold: true })).toBe(start);
  });
});

describe("formatCellDisplay", () => {
  it("falls back to the column default when no override is set", () => {
    expect(formatCellDisplay(1234, undefined, "$1,234")).toBe("$1,234");
  });

  it("formats currency", () => {
    expect(formatCellDisplay(25476, "currency", "25,476")).toBe("$25,476");
  });

  it("formats percent", () => {
    expect(formatCellDisplay(28.7, "percent", "28.7")).toBe("28.7%");
  });

  it("formats thousands", () => {
    expect(formatCellDisplay(1234, "thousands", "$1,234")).toBe("1,234");
  });

  it("formats plain", () => {
    expect(formatCellDisplay(1234, "plain", "$1,234")).toBe("1234");
  });

  it("renders an em dash for nullish values under an override", () => {
    expect(formatCellDisplay(null, "currency", "—")).toBe("—");
  });
});
