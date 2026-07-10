import { describe, expect, it } from "vitest";
import { computeFill } from "@nqlib/nqgrid";

/**
 * The fill handle's data layer: given a source column of values + a target row
 * count, produce the filled values. This mirrors what `applyVerticalFill` in
 * grid-view does per column (numeric series vs. copy-cycle). Rendering/drag are
 * exercised in the browser; here we lock the pure data transform.
 */
function fillColumn(
  source: (string | number)[],
  targetCount: number,
  numeric: boolean,
): (string | number)[] {
  return computeFill(source, targetCount).map((v) => {
    if (!numeric) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : source[source.length - 1]!;
  });
}

describe("vertical fill data layer", () => {
  it("continues a numeric arithmetic series", () => {
    expect(fillColumn([10, 20], 3, true)).toEqual([30, 40, 50]);
  });

  it("copies a single numeric source value", () => {
    expect(fillColumn([7], 3, true)).toEqual([7, 7, 7]);
  });

  it("copy-cycles a non-numeric source pattern", () => {
    expect(fillColumn(["Won", "Lost"], 4, false)).toEqual(["Won", "Lost", "Won", "Lost"]);
  });

  it("increments a trailing-number text token", () => {
    expect(fillColumn(["SO-00009"], 2, false)).toEqual(["SO-00010", "SO-00011"]);
  });

  it("coerces numeric-column results back to number", () => {
    const out = fillColumn([1, 2, 3], 2, true);
    expect(out).toEqual([4, 5]);
    expect(out.every((v) => typeof v === "number")).toBe(true);
  });
});
