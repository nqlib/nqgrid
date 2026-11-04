import type { ColumnDef as TanStackColumnDef } from "@tanstack/react-table";

import { buildRichColumnFromDef } from "./build-rich-column";
import type { ColumnFactoryConfig } from "@nqlib/nqgrid";
import type { DateRichColumn, NumberRichColumn, RichSchemaColumnDef, TextRichColumn } from "@nqlib/nqgrid";

export type { ColumnFactoryConfig } from "@nqlib/nqgrid";

export type ColumnType = "text" | "number" | "currency" | "date";

export interface SchemaColumnDef {
  readonly key: string;
  readonly name: string;
  readonly type: ColumnType;
  readonly width?: number;
}

function legacySchemaToRich<T extends object>(def: SchemaColumnDef): RichSchemaColumnDef<T> {
  const base = { id: def.key, name: def.name, header: def.name, width: def.width };
  const accessorKey = def.key as keyof T & string;
  switch (def.type) {
    case "text":
      return { ...base, kind: "text", accessorKey } as TextRichColumn<T>;
    case "number":
      return { ...base, kind: "number", accessorKey, align: "right" } as NumberRichColumn<T>;
    case "currency":
      return {
        ...base,
        kind: "number",
        accessorKey,
        align: "right",
        format: { style: "currency", currency: "USD" },
      } as NumberRichColumn<T>;
    case "date":
      return { ...base, kind: "date", accessorKey, format: { preset: "dateShort" } } as DateRichColumn<T>;
  }
}

/**
 * Legacy minimal schema → TanStack column (delegates to `buildRichColumnFromDef`).
 */
export function buildColumnFromDef<T extends object>(
  def: SchemaColumnDef,
  config: ColumnFactoryConfig = {},
): TanStackColumnDef<T, unknown> {
  return buildRichColumnFromDef(legacySchemaToRich<T>(def), config);
}
