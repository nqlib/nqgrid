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

  it("treats a bare quote mid-cell as a literal, not a field opener", () => {
    // `a"b<TAB>c` must split into two cells; the inch-mark quote must NOT
    // toggle quoting and swallow the following tab.
    expect(tsvToMatrix('a"b\tc')).toEqual([['a"b', "c"]]);
  });

  it("still parses properly quoted and escaped fields", () => {
    expect(tsvToMatrix('"a\tb"\tc')).toEqual([["a\tb", "c"]]);
    expect(tsvToMatrix('"a""b"\tc')).toEqual([['a"b', "c"]]);
  });

  it("round-trips cells that start with a quote (would otherwise merge columns)", () => {
    // A leading `"` opens a quoted field on read, so the writer must quote it —
    // otherwise `"x<TAB>y` parses back as a single merged column.
    const rows = [['"x', "y"], ['"', "z"], ['"quoted"', "w"]];
    expect(tsvToMatrix(matrixToTsv(rows))).toEqual(rows);
  });

  it("keeps newlines inside quoted cells (Excel multi-line cells)", () => {
    expect(tsvToMatrix('a\t"line1\nline2"\tc\r\nd\te\tf\r\n')).toEqual([
      ["a", "line1\nline2", "c"],
      ["d", "e", "f"],
    ]);
    const rows = [["x", "two\nlines"], ["y", "z"]];
    expect(tsvToMatrix(matrixToTsv(rows))).toEqual(rows);
  });

  it("ignores the trailing newline Excel appends", () => {
    expect(tsvToMatrix("1\t2\n3\t4\n")).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
    expect(tsvToMatrix("1\t2\r\n")).toEqual([["1", "2"]]);
  });

  it("keeps empty cells and empty middle rows", () => {
    expect(tsvToMatrix("a\t\tc\n\nd")).toEqual([["a", "", "c"], [""], ["d"]]);
    expect(tsvToMatrix("a\t")).toEqual([["a", ""]]);
  });
});
