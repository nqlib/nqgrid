import { describe, expect, it } from "vitest";
import {
  SELECT_CELL_MOVE_THRESHOLD_PX,
  SELECT_CELL_SCROLL_CANCEL_PX,
  selectCellDragExceededThreshold,
  selectCellMovementLooksLikeScroll,
} from "./use-select-cell-drag-intent";

describe("selectCellDragExceededThreshold", () => {
  it("returns false when movement is below threshold", () => {
    expect(
      selectCellDragExceededThreshold({ x: 0, y: 0 }, { x: 4, y: 4 }, SELECT_CELL_MOVE_THRESHOLD_PX),
    ).toBe(false);
  });

  it("returns true when movement meets threshold", () => {
    expect(
      selectCellDragExceededThreshold({ x: 0, y: 0 }, { x: 10, y: 0 }, SELECT_CELL_MOVE_THRESHOLD_PX),
    ).toBe(true);
  });
});

describe("selectCellMovementLooksLikeScroll", () => {
  it("returns true for mostly vertical movement", () => {
    expect(
      selectCellMovementLooksLikeScroll(
        { x: 0, y: 0 },
        { x: 1, y: SELECT_CELL_SCROLL_CANCEL_PX + 2 },
      ),
    ).toBe(true);
  });

  it("returns false for mostly horizontal movement", () => {
    expect(selectCellMovementLooksLikeScroll({ x: 0, y: 0 }, { x: 12, y: 2 })).toBe(false);
  });
});
