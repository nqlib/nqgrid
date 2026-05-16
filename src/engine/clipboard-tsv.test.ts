import { describe, expect, it } from "vitest";

import { matrixToTsv, tsvToMatrix } from "./clipboard-tsv";

describe("clipboard-tsv", () => {
  it("round-trips simple rows", () => {
    const rows = [
      ["a", "b"],
      ["c", "d"],
    ];
    expect(tsvToMatrix(matrixToTsv(rows))).toEqual(rows);
  });

  it("escapes tabs in cells", () => {
    const rows = [["a\tb", "c"]];
    const t = matrixToTsv(rows);
    expect(t).toContain('"a\tb"');
    expect(tsvToMatrix(t)).toEqual(rows);
  });
});
