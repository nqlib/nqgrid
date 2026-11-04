import { describe, expect, it } from "vitest";
import { moveRowBefore, moveRowDown, moveRowToIndex, moveRowUp } from "./row-reorder";

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

describe("moveRowToIndex", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

  it("moves to an absolute index", () => {
    expect(moveRowToIndex(rows, "a", 2).map((r) => r.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("clamps out-of-range indices", () => {
    expect(moveRowToIndex(rows, "a", 99).map((r) => r.id)).toEqual(["b", "c", "d", "a"]);
    expect(moveRowToIndex(rows, "d", -5).map((r) => r.id)).toEqual(["d", "a", "b", "c"]);
  });

  it("no-ops when already at index", () => {
    expect(moveRowToIndex(rows, "b", 1).map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("returns a copy when id is missing", () => {
    expect(moveRowToIndex(rows, "z", 0).map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("moveRowUp / moveRowDown", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("moves up one position", () => {
    expect(moveRowUp(rows, "c").map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("no-ops at the top", () => {
    expect(moveRowUp(rows, "a").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("moves down one position", () => {
    expect(moveRowDown(rows, "a").map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("no-ops at the bottom", () => {
    expect(moveRowDown(rows, "c").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});
