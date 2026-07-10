import { describe, expect, it } from "vitest";
import {
  EMPTY_ROW_SELECTION,
  TANSTACK_ROW_MODEL_PRESETS,
  createGlobalFilterFn,
  withCoreDataTable,
  withCoreSortingFaceted,
  withCoreSortingFiltered,
  withCoreSortingGroupedExpanded,
  withCoreSortingPaginated,
  withCoreSortingRowSelection,
  withFreezePanesSupport,
} from "./tanstack-defaults";

describe("EMPTY_ROW_SELECTION", () => {
  it("is the canonical empty TanStack rowSelection map", () => {
    expect(EMPTY_ROW_SELECTION).toEqual({});
  });
});

describe("TANSTACK_ROW_MODEL_PRESETS", () => {
  it("lists preset export names", () => {
    expect(TANSTACK_ROW_MODEL_PRESETS).toContain("withCoreSortingFiltered");
    expect(TANSTACK_ROW_MODEL_PRESETS).toContain("withCoreDataTable");
    expect(TANSTACK_ROW_MODEL_PRESETS).toContain("withFreezePanesSupport");
  });
});

describe("withFreezePanesSupport", () => {
  it("enables column and row pinning defaults", () => {
    const opts = withFreezePanesSupport({ data: [], columns: [] });
    expect(opts.enableRowPinning).toBe(true);
    expect(opts.enableColumnPinning).toBe(true);
    expect(opts.getSortedRowModel).toBeTypeOf("function");
  });
});

describe("createGlobalFilterFn", () => {
  it("matches substring on listed keys", () => {
    const fn = createGlobalFilterFn<{ name: string; code: string }>(["name", "code"]);
    const row = {
      original: { name: "Alpha", code: "X1" },
    } as Parameters<typeof fn>[0];
    expect(fn(row, "global", "alp", () => undefined as never)).toBe(true);
    expect(fn(row, "global", "zzz", () => undefined as never)).toBe(false);
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
});

describe("row model presets", () => {
  it("withCoreSortingFiltered wires filter + sort", () => {
    const opts = withCoreSortingFiltered({
      data: [],
      columns: [],
    });
    expect(opts.getFilteredRowModel).toBeTypeOf("function");
    expect(opts.getSortedRowModel).toBeTypeOf("function");
  });

  it("withCoreSortingPaginated wires pagination", () => {
    const opts = withCoreSortingPaginated({ data: [], columns: [] });
    expect(opts.getPaginationRowModel).toBeTypeOf("function");
  });

  it("withCoreSortingGroupedExpanded wires group + expand", () => {
    const opts = withCoreSortingGroupedExpanded({ data: [], columns: [] });
    expect(opts.getGroupedRowModel).toBeTypeOf("function");
    expect(opts.getExpandedRowModel).toBeTypeOf("function");
  });

  it("withCoreSortingFaceted wires faceting", () => {
    const opts = withCoreSortingFaceted({ data: [], columns: [] });
    expect(opts.getFacetedRowModel).toBeTypeOf("function");
    expect(opts.getFacetedUniqueValues).toBeTypeOf("function");
  });

  it("withCoreDataTable wires full pipeline", () => {
    const opts = withCoreDataTable({ data: [], columns: [] });
    expect(opts.getPaginationRowModel).toBeTypeOf("function");
    expect(opts.getGroupedRowModel).toBeTypeOf("function");
    expect(opts.enableRowSelection).toBe(true);
  });
});
