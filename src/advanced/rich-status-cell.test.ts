import { describe, expect, it } from "vitest";

import { richStatusEntryInlineStyle, statusChoiceKeys } from "./rich-status-cell";

describe("richStatusEntryInlineStyle", () => {
  it("returns undefined when no custom colors", () => {
    expect(richStatusEntryInlineStyle({ label: "x" })).toBeUndefined();
  });

  it("merges defined color fields", () => {
    expect(
      richStatusEntryInlineStyle({
        label: "x",
        color: "#111",
        backgroundColor: "#eee",
        borderColor: "#999",
      }),
    ).toEqual({
      color: "#111",
      backgroundColor: "#eee",
      borderColor: "#999",
    });
  });
});

describe("statusChoiceKeys", () => {
  it("respects choiceOrder and appends unknown keys", () => {
    const map = { b: { label: "B" }, a: { label: "A" }, c: { label: "C" } };
    expect(statusChoiceKeys(map, ["c", "a"])).toEqual(["c", "a", "b"]);
  });

  it("falls back to map keys", () => {
    const map = { x: { label: "X" }, y: { label: "Y" } };
    expect(statusChoiceKeys(map)).toEqual(["x", "y"]);
  });
});
