import { describe, expect, it } from "vitest";
import { moveRowBefore } from "./row-reorder";

describe("moveRowBefore", () => {
  const rows = [
    { id: "a", v: 1 },
    { id: "b", v: 2 },
    { id: "c", v: 3 },
    { id: "d", v: 4 },
  ];

  it("no-ops when ids match", () => {
    expect(moveRowBefore(rows, "b", "b")).toEqual(rows);
  });

  it("moves later row before an earlier row", () => {
    expect(moveRowBefore(rows, "d", "b")).toEqual([
      { id: "a", v: 1 },
      { id: "d", v: 4 },
      { id: "b", v: 2 },
      { id: "c", v: 3 },
    ]);
  });

  it("moves earlier row before a later row", () => {
    expect(moveRowBefore(rows, "b", "d")).toEqual([
      { id: "a", v: 1 },
      { id: "c", v: 3 },
      { id: "b", v: 2 },
      { id: "d", v: 4 },
    ]);
  });
});
