import { describe, expect, it } from "vitest";

import { getFreezePaneCellStickyStyle } from "./freeze-pane-cell-styles";
import { computeFrozenTopLayout } from "./frozen-rows-layout";
import { computePinnedLayout } from "../pinning/pinned-layout";

describe("getFreezePaneCellStickyStyle", () => {
  const columnLayout = computePinnedLayout(["a", "b", "c"], ["a", "b"], (id) =>
    id === "a" ? 40 : 60,
  );
  const rowLayout = computeFrozenTopLayout(["r0", "r1", "r2"], ["r0", "r1"], () => 26);

  it("returns column-only sticky for header", () => {
    const style = getFreezePaneCellStickyStyle({
      columnLayout,
      rowLayout,
      columnId: "a",
      rowId: "r0",
      variant: "head",
    });
    expect(style).toMatchObject({ position: "sticky", left: 0, top: 0 });
    expect(style?.zIndex).toBeGreaterThan(40);
  });

  it("merges left and top for corner body cell", () => {
    const style = getFreezePaneCellStickyStyle({
      columnLayout,
      rowLayout,
      columnId: "b",
      rowId: "r1",
      variant: "body",
      headerOffsetPx: 32,
    });
    expect(style).toMatchObject({
      position: "sticky",
      left: 40,
      top: 32 + 26,
      height: 26,
    });
    expect(style?.zIndex).toBeGreaterThanOrEqual(29);
  });

  it("returns row-only sticky when column is not pinned", () => {
    const style = getFreezePaneCellStickyStyle({
      columnLayout,
      rowLayout,
      columnId: "c",
      rowId: "r0",
      variant: "body",
    });
    expect(style).toMatchObject({ position: "sticky", top: 0 });
    expect(style?.zIndex).toBe(21);
  });
});
