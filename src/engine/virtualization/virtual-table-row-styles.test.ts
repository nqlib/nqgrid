import { describe, expect, it } from "vitest";

import { getVirtualTableRowStyle } from "./virtual-table-row-styles";

describe("getVirtualTableRowStyle", () => {
  it("positions with top instead of transform so pinned cells can stick", () => {
    expect(getVirtualTableRowStyle(120)).toEqual({
      display: "flex",
      position: "absolute",
      top: 120,
      left: 0,
      width: "100%",
    });
    expect(getVirtualTableRowStyle(120)).not.toHaveProperty("transform");
  });

  it("uses explicit row width when virtual tbody breaks table layout", () => {
    expect(getVirtualTableRowStyle(120, 1204)).toEqual({
      display: "flex",
      position: "absolute",
      top: 120,
      left: 0,
      width: 1204,
      minWidth: 1204,
    });
  });

  it("adds bandOffsetPx for freeze-pane virtual bands", () => {
    expect(getVirtualTableRowStyle(100, undefined, { bandOffsetPx: 52 })).toMatchObject({
      top: 152,
    });
  });
});
