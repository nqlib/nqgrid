import { describe, expect, it } from "vitest";
import { computeFill } from "./fill";

describe("computeFill", () => {
  it("copies a single value", () => {
    expect(computeFill(["x"], 3)).toEqual(["x", "x", "x"]);
    expect(computeFill([5], 3)).toEqual([5, 5, 5]);
  });

  it("continues a numeric arithmetic series", () => {
    expect(computeFill([1, 2], 3)).toEqual([3, 4, 5]);
    expect(computeFill([10, 20, 30], 2)).toEqual([40, 50]);
    expect(computeFill([2, 4], 2)).toEqual([6, 8]);
  });

  it("copy-cycles a non-constant numeric pattern", () => {
    expect(computeFill([1, 4, 9], 4)).toEqual([1, 4, 9, 1]);
  });

  it("continues a decimal series despite float rounding in the step", () => {
    // 0.3 - 0.2 !== 0.1 in IEEE-754; an exact === step check would wrongly
    // treat this as non-constant and fall back to copy-cycle.
    expect(computeFill([0.1, 0.2, 0.3], 2)).toEqual([0.4, 0.5]);
    expect(computeFill([1.1, 2.2, 3.3], 2)).toEqual([4.4, 5.5]);
  });

  it("continues month and weekday cycles", () => {
    expect(computeFill(["Jan", "Feb"], 3)).toEqual(["Mar", "Apr", "May"]);
    expect(computeFill(["Nov", "Dec"], 2)).toEqual(["Jan", "Feb"]);
    expect(computeFill(["Mon"], 2)).toEqual(["Tue", "Wed"]);
  });

  it("increments a trailing number in a single text value", () => {
    expect(computeFill(["Item 1"], 2)).toEqual(["Item 2", "Item 3"]);
    expect(computeFill(["SO-00009"], 2)).toEqual(["SO-00010", "SO-00011"]);
  });

  it("repeats the source pattern for arbitrary text", () => {
    expect(computeFill(["Won", "Lost"], 4)).toEqual(["Won", "Lost", "Won", "Lost"]);
  });

  it("handles edge inputs", () => {
    expect(computeFill([], 3)).toEqual([]);
    expect(computeFill(["x"], 0)).toEqual([]);
  });
});
