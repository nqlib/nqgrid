import { describe, expect, it } from "vitest";
import { compareCells, renderCell, cellInterval } from "../engine/column-types";
import { createRichRegistry, richDefToColumnSchema, richSchemaToColumns } from "./rich-schema-bridge";
import type { RichSchemaColumnDef } from "./rich-schema";

interface Row {
  title: string;
  state: string;
  amount: number;
  ratio: number;
  due: string;
  people: { name: string }[];
  qty: number;
  price: number;
}

const registry = createRichRegistry();

function render<TData extends object>(def: RichSchemaColumnDef<TData>, row: TData) {
  const { schema, accessor } = richDefToColumnSchema(def);
  const type = registry.require(schema.type);
  return { ...renderCell(accessor(row), type, schema), schema, type };
}

const baseRow: Row = {
  title: "Ship it",
  state: "in_progress",
  amount: 1234.5,
  ratio: 42,
  due: "2026-03-09",
  people: [{ name: "Ava" }, { name: "Ben" }],
  qty: 3,
  price: 10,
};

describe("rich bridge — number/currency parity", () => {
  it("currency formats through the shared formatter", () => {
    const out = render(
      {
        id: "amount",
        name: "Amount",
        kind: "currency",
        accessorKey: "amount",
        currency: "USD",
        maximumFractionDigits: 0,
      },
      baseRow,
    );
    expect(out.display).toBe("$1,235");
    expect(out.style.align).toBe("right");
  });

  it("percent yields a bar ratio in style", () => {
    const out = render(
      { id: "ratio", name: "Ratio", kind: "percent", accessorKey: "ratio", format: { valueScale: "hundred" } },
      baseRow,
    );
    expect(out.display).toContain("42");
    expect(out.style.bar).toBeCloseTo(0.42, 5);
  });
});

describe("rich bridge — status sorts by choiceOrder, not alphabetically", () => {
  const statusDef: RichSchemaColumnDef<Row> = {
    id: "state",
    name: "State",
    kind: "status",
    accessorKey: "state",
    choiceOrder: ["backlog", "in_progress", "done"],
    map: {
      backlog: { label: "Backlog", color: "#94a3b8" },
      in_progress: { label: "In Progress", color: "#3b82f6" },
      done: { label: "Done", color: "#22c55e" },
    },
  };

  it("renders the mapped label + color", () => {
    const out = render(statusDef, baseRow);
    expect(out.display).toBe("In Progress");
    expect(out.style.chipColor).toBe("#3b82f6");
  });

  it("compareCells orders by workflow position", () => {
    const { schema, type } = render(statusDef, baseRow);
    // "done" (idx 2) should sort AFTER "backlog" (idx 0), though "done" < "backlog" alphabetically.
    expect(compareCells("done", "backlog", type, schema)).toBeGreaterThan(0);
    expect(compareCells("backlog", "in_progress", type, schema)).toBeLessThan(0);
  });
});

describe("rich bridge — people & formula & date", () => {
  it("people renders joined names", () => {
    const out = render(
      { id: "people", name: "Team", kind: "people", accessorKey: "people" },
      baseRow,
    );
    expect(out.display).toBe("Ava, Ben");
  });

  it("formula computes from the row then presents", () => {
    const out = render(
      {
        id: "total",
        name: "Total",
        kind: "formula",
        compute: (r) => r.qty * r.price,
        presentation: { type: "currency", currency: "USD", maximumFractionDigits: 0 },
      },
      baseRow,
    );
    expect(out.display).toBe("$30");
  });

  it("date exposes the gantt toInterval seam", () => {
    const { schema, accessor } = richDefToColumnSchema<Row>({
      id: "due",
      name: "Due",
      kind: "date",
      accessorKey: "due",
    });
    const iv = cellInterval(accessor(baseRow), registry.require(schema.type), schema);
    expect(iv?.start.getTime()).toBe(iv?.end.getTime());
  });
});

describe("rich bridge — custom is not migratable", () => {
  it("throws for kind custom (UI escape hatch)", () => {
    expect(() =>
      richDefToColumnSchema<Row>({
        id: "x",
        name: "X",
        kind: "custom",
        cell: () => null,
      }),
    ).toThrow(/custom/);
  });

  it("richSchemaToColumns skips custom and reports its id", () => {
    const { columns, customIds } = richSchemaToColumns<Row>([
      { id: "title", name: "Title", kind: "text", accessorKey: "title" },
      { id: "x", name: "X", kind: "custom", cell: () => null },
    ]);
    expect(columns).toHaveLength(1);
    expect(customIds).toEqual(["x"]);
  });
});
