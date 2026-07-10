import { describe, expect, it } from "vitest";

import { getBottomPinnedRowStyle } from "./virtual-table-row-styles";

describe("getBottomPinnedRowStyle", () => {
  it("positions bottom-pinned row in absolute tbody band", () => {
    expect(getBottomPinnedRowStyle(1200, 28)).toMatchObject({
      position: "absolute",
      top: 1200,
      height: 28,
    });
  });
});
