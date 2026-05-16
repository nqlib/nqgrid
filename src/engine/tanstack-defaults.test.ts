import { describe, expect, it } from "vitest";
import { EMPTY_ROW_SELECTION, withCoreSortingRowSelection } from "./tanstack-defaults";

describe("EMPTY_ROW_SELECTION", () => {
  it("is the canonical empty TanStack rowSelection map", () => {
    expect(EMPTY_ROW_SELECTION).toEqual({});
  });
});

describe("withCoreSortingRowSelection", () => {
  it("enables row selection by default and merges row models", () => {
    const opts = withCoreSortingRowSelection({
      data: [{ id: "a", v: 1 }],
      columns: [{ accessorKey: "v", header: "V" }],
    });
    expect(opts.enableRowSelection).toBe(true);
    expect(opts.enableMultiRowSelection).toBe(true);
    expect(opts.getCoreRowModel).toBeTypeOf("function");
    expect(opts.getSortedRowModel).toBeTypeOf("function");
  });

  it("allows callers to disable row selection", () => {
    const opts = withCoreSortingRowSelection({
      data: [{ id: "x", v: 0 }],
      columns: [{ accessorKey: "v", header: "V" }],
      enableRowSelection: false,
    });
    expect(opts.enableRowSelection).toBe(false);
  });
});
