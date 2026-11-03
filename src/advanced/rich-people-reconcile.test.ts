import { describe, expect, it } from "vitest";

import { reconcileRichPeopleWithRoster, richPersonOptionKey } from "../core/rich-value-format";

describe("reconcileRichPeopleWithRoster", () => {
  it("aligns row value to roster when only name matches", () => {
    const roster = [
      { id: "u-1", name: "Ada Lovelace", image: "https://example.com/a.jpg" },
      { id: "u-2", name: "Ben Bitdiddle", image: "https://example.com/b.jpg" },
    ];
    const rowValue = [{ name: "Ada Lovelace", image: "https://other.com/old.png" }];
    const out = reconcileRichPeopleWithRoster(rowValue, roster);
    expect(out).toHaveLength(1);
    expect(richPersonOptionKey(out[0]!)).toBe("u-1");
    expect(out[0]!.image).toBe("https://example.com/a.jpg");
  });

  it("matches by option key when present on both sides", () => {
    const roster = [
      { id: "x", name: "Same" },
      { id: "y", name: "Other" },
    ];
    const out = reconcileRichPeopleWithRoster([{ id: "y", name: "Other" }], roster);
    expect(richPersonOptionKey(out[0]!)).toBe("y");
  });
});
