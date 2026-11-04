import { describe, expect, it } from "vitest";

import { getOutlineRowIndentPx, getOutlineRowIndentStyle } from "./row-outline";

describe("getOutlineRowIndentPx", () => {
  it("increases padding by depth", () => {
    expect(getOutlineRowIndentPx(0)).toBe(8);
    expect(getOutlineRowIndentPx(2)).toBe(40);
  });
});

describe("getOutlineRowIndentStyle", () => {
  it("returns paddingInlineStart", () => {
    expect(getOutlineRowIndentStyle(1)).toEqual({ paddingInlineStart: 24 });
  });
});
