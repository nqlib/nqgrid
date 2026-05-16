import { describe, expect, it } from "vitest";

import { buildRichColumnFromDef, buildRichColumnsFromDefs } from "./build-rich-column";

type Row = { qty: number; price: number; code: string };

describe("buildRichColumnFromDef", () => {
  it("wires formula accessorFn and meta", () => {
    const col = buildRichColumnFromDef<Row>({
      id: "ext",
      name: "Extended",
      kind: "formula",
      compute: (r) => r.qty * r.price,
      presentation: { type: "currency", currency: "USD" },
    });
    expect(col.id).toBe("ext");
    expect(col.accessorFn?.({ qty: 2, price: 3 })).toBe(6);
    expect(col.meta).toEqual({ nqgridRich: { kind: "formula" } });
  });

  it("normalizes legacy currency kind to number", () => {
    const col = buildRichColumnFromDef<Row>({
      id: "amt",
      name: "Amount",
      kind: "currency",
      accessorKey: "price",
      currency: "EUR",
    });
    expect(col.meta).toEqual({ nqgridRich: { kind: "number" } });
  });

  it("uses accessorPath", () => {
    const col = buildRichColumnFromDef<{ nested: { v: number } }>({
      id: "p",
      name: "P",
      kind: "number",
      accessorPath: "nested.v",
      align: "right",
    });
    expect(col.accessorFn?.({ nested: { v: 9 } })).toBe(9);
  });
});

describe("buildRichColumnsFromDefs", () => {
  it("returns one ColumnDef per schema entry", () => {
    const cols = buildRichColumnsFromDefs<Row>([
      { id: "code", name: "Code", kind: "text", accessorKey: "code" },
      { id: "qty", name: "Qty", kind: "number", accessorKey: "qty", align: "right" },
    ]);
    expect(cols).toHaveLength(2);
    expect(cols[0]?.accessorKey).toBe("code");
    expect(cols[1]?.accessorKey).toBe("qty");
  });
});
