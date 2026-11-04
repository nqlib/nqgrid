/**
 * Migration bridge — the legacy rich-column union expressed as the ColumnType
 * contract.
 *
 * The `RichSchemaColumnDef` union (a `kind`-discriminated shape with a `switch`
 * over kinds) is the exact pattern the contract forbids in engine core. This file
 * is the one allowed place that switch may live: a boundary adapter that maps each
 * legacy `kind` to a `ColumnSchema` + a registry `ColumnType`, so existing rich
 * defs render through the same `renderCell` / `compareCells` / `groupRowsByColumn`
 * pipeline as native schemas. New code should author `ColumnSchema` directly; this
 * bridge exists so the deprecated union has a mechanical migration path.
 *
 * Formatting fidelity is preserved by delegating to the existing pure formatters in
 * `rich-value-format` — there is no second number/date formatter.
 */
import {
  TypeRegistry,
  createDefaultRegistry,
  typeError,
  type ColumnSchema,
  type ColumnType,
  type Interval,
  type SelectOption,
} from "../engine/column-types";
import { normalizeRichSchemaColumnDef } from "./normalize-rich-schema";
import type {
  FormulaPresentation,
  NumberRichColumn,
  RichDateFormatOptions,
  RichNumberFormatOptions,
  RichPerson,
  RichSchemaColumnDef,
  RichStatusMapEntry,
} from "./rich-schema";
import {
  coerceDate,
  coerceNumber,
  formatDateValue,
  formatFormulaValue,
  formatNumberValue,
  getByPath,
  normalizePeopleList,
  resolveStatusEntry,
} from "../core/rich-value-format";

/* -- schema-carried config (read off ColumnSchema by the rich types below) -- */

interface RichNumberSchema extends ColumnSchema {
  readonly numberFormat?: RichNumberFormatOptions;
  readonly empty?: string;
  readonly align?: "left" | "right";
}
interface RichDateSchema extends ColumnSchema {
  readonly dateFormat?: RichDateFormatOptions;
  readonly empty?: string;
}
interface RichStatusSchema extends ColumnSchema {
  readonly map: Readonly<Record<string, RichStatusMapEntry>>;
  readonly fallback?: RichStatusMapEntry;
  readonly choiceOrder?: readonly string[];
}
interface RichPeopleSchema extends ColumnSchema {
  readonly max?: number;
  readonly empty?: string;
}
interface RichFormulaSchema extends ColumnSchema {
  readonly presentation: FormulaPresentation;
  readonly empty?: string;
}

function styleFromStatusEntry(entry: RichStatusMapEntry) {
  return {
    chipColor: entry.color,
    chipBackground: entry.backgroundColor,
    chipBorder: entry.borderColor,
    // When the entry themes by named variant only, pass it through as data.
    variant: entry.color || entry.backgroundColor ? undefined : entry.variant,
  };
}

function statusOrder(key: string, schema: RichStatusSchema): number {
  if (schema.choiceOrder) {
    const i = schema.choiceOrder.indexOf(key);
    if (i >= 0) return i;
  }
  const i = Object.keys(schema.map).indexOf(key);
  return i >= 0 ? i : Number.MAX_SAFE_INTEGER;
}

/* ----------------------------------------------------------- rich types -- */

/** number/currency/percent — delegates to `formatNumberValue` for exact parity. */
const richNumberType: ColumnType<unknown, number> = {
  name: "number",
  parse(raw) {
    const n = coerceNumber(raw);
    return n == null ? typeError("not a number", raw) : n;
  },
  format(parsed, schema) {
    const s = schema as RichNumberSchema;
    return formatNumberValue(parsed, s.numberFormat, s.empty ?? "");
  },
  style(parsed, schema) {
    const f = (schema as RichNumberSchema).numberFormat;
    if (f?.style === "percent") {
      const scaled = (f.valueScale ?? "hundred") === "ratio" ? parsed : parsed / 100;
      return { align: "right", bar: Math.min(1, Math.max(0, scaled)) };
    }
    return { align: (schema as RichNumberSchema).align ?? "right" };
  },
  compareKey: (parsed) => parsed,
  editor: () => ({ control: "number" }),
};

/** date — delegates to `formatDateValue`; exposes the gantt `toInterval` seam. */
const richDateType: ColumnType<unknown, Date> = {
  name: "date",
  parse(raw) {
    const d = coerceDate(raw);
    return d ?? typeError("not a date", raw);
  },
  format(parsed, schema) {
    const s = schema as RichDateSchema;
    return formatDateValue(parsed, s.dateFormat, s.empty ?? "");
  },
  style: () => ({}),
  compareKey: (parsed) => parsed.getTime(),
  editor: () => ({ control: "date" }),
  toInterval: (parsed): Interval => ({ start: parsed, end: parsed }),
};

/**
 * status / tag — map-based label+color; sorts by `choiceOrder` (workflow order).
 * `parse` returns `{ key, entry }` so format/style are trivial while `compareKey`
 * still has the raw key to derive workflow order from.
 */
const richStatusType: ColumnType<unknown, { key: string; entry: RichStatusMapEntry }> = {
  name: "status",
  parse(raw, schema) {
    const s = schema as RichStatusSchema;
    const key = raw == null ? "" : String(raw);
    return { key, entry: resolveStatusEntry(raw, s.map, s.fallback) };
  },
  format: (v) => v.entry.label,
  style: (v) => styleFromStatusEntry(v.entry),
  compareKey: (v, schema) => statusOrder(v.key, schema as RichStatusSchema),
  editor(schema) {
    const s = schema as RichStatusSchema;
    const options: SelectOption[] = Object.entries(s.map).map(([id, entry]) => ({
      id,
      label: entry.label,
      color: entry.color ?? entry.backgroundColor,
      order: statusOrder(id, s),
    }));
    return { control: "select", options };
  },
};

const richTagType: ColumnType<unknown, { key: string; entry: RichStatusMapEntry }> = {
  ...richStatusType,
  name: "tag",
};

/** people — avatar stack; renders names headlessly, sorts by first name. */
const richPeopleType: ColumnType<unknown, readonly RichPerson[]> = {
  name: "people",
  parse: (raw) => normalizePeopleList(raw),
  format(parsed, schema) {
    const s = schema as RichPeopleSchema;
    if (parsed.length === 0) return s.empty ?? "";
    return parsed
      .slice(0, s.max ?? 6)
      .map((p) => p.name)
      .join(", ");
  },
  style: (parsed) => (parsed.length === 0 ? { muted: true } : {}),
  compareKey: (parsed) => (parsed[0]?.name ?? "").toLowerCase(),
  editor: () => ({ control: "select" }),
};

/** formula — the accessor runs `compute`; this type just presents the result. */
const richFormulaType: ColumnType<unknown, unknown> = {
  name: "formula",
  parse: (raw) => raw,
  format(parsed, schema) {
    const s = schema as RichFormulaSchema;
    return formatFormulaValue(parsed, s.presentation, s.empty ?? "");
  },
  style(_parsed, schema) {
    const p = (schema as RichFormulaSchema).presentation;
    return p.type === "number" || p.type === "currency" || p.type === "percent"
      ? { align: "right" }
      : {};
  },
  compareKey(parsed) {
    const n = coerceNumber(parsed);
    if (n != null) return n;
    return parsed == null ? "" : String(parsed).toLowerCase();
  },
  editor: () => ({ control: "none" }),
};

/* The maxLength/empty-aware text variant (core `text` is otherwise fine). */
interface RichTextSchema extends ColumnSchema {
  readonly maxLength?: number;
  readonly empty?: string;
}
const richTextType: ColumnType<unknown, string> = {
  name: "text",
  parse: (raw) => (raw == null ? "" : String(raw)),
  format(parsed, schema) {
    const s = schema as RichTextSchema;
    if (parsed.length === 0) return s.empty ?? "";
    return s.maxLength != null ? parsed.slice(0, s.maxLength) : parsed;
  },
  style: (parsed) => (parsed.length === 0 ? { muted: true } : {}),
  compareKey: (parsed) => parsed.toLowerCase(),
  editor: () => ({ control: "text" }),
};

/**
 * A registry that understands the rich kinds. Core types (`select`, `dateRange`)
 * remain available; `text`/`number`/`date` are replaced with parity-preserving
 * variants and `status`/`tag`/`people`/`formula` are added.
 */
export function createRichRegistry(): TypeRegistry {
  return createDefaultRegistry()
    .register(richTextType)
    .register(richNumberType)
    .register(richDateType)
    .register(richStatusType)
    .register(richTagType)
    .register(richPeopleType)
    .register(richFormulaType);
}

/* ------------------------------------------------------------ the bridge -- */

export interface BridgedColumn<TData extends object> {
  /** A contract schema renderable through the rich registry. */
  readonly schema: ColumnSchema;
  /** Reads the raw cell value (the SSOT scalar) off a row. */
  readonly accessor: (row: TData) => unknown;
}

function accessorFor<TData extends object>(def: RichSchemaColumnDef<TData>): (row: TData) => unknown {
  if (def.kind === "formula") return (row) => def.compute(row);
  if ("accessorPath" in def && def.accessorPath) {
    const path = def.accessorPath;
    return (row) => getByPath(row, path);
  }
  if ("accessorKey" in def && def.accessorKey) {
    const key = def.accessorKey;
    return (row) => (row as Record<string, unknown>)[key as string];
  }
  return () => undefined;
}

/**
 * Convert one legacy rich column def into a contract `ColumnSchema` + an accessor.
 * Currency/percent kinds are normalized to `number` first. The `custom` kind has no
 * contract equivalent (it returns an arbitrary ReactNode, bypassing the headless
 * pipeline) and throws — keep custom cells in the consuming app's renderer.
 */
export function richDefToColumnSchema<TData extends object>(
  def: RichSchemaColumnDef<TData>,
): BridgedColumn<TData> {
  const normalized = normalizeRichSchemaColumnDef(def);
  const base = { id: normalized.id, label: normalized.header ?? normalized.name };
  const accessor = accessorFor(def);

  switch (normalized.kind) {
    case "text":
      return {
        accessor,
        schema: { ...base, type: "text", maxLength: normalized.maxLength, empty: normalized.empty } as ColumnSchema,
      };
    // currency / percent are normalized to `number` at runtime; list them so the
    // switch is exhaustive over the union TypeScript still sees.
    case "currency":
    case "percent":
    case "number": {
      const n = normalized as NumberRichColumn<TData>;
      return {
        accessor,
        schema: {
          ...base,
          type: "number",
          numberFormat: n.format,
          empty: n.empty,
          align: n.align,
        } as ColumnSchema,
      };
    }
    case "date":
      return {
        accessor,
        schema: { ...base, type: "date", dateFormat: normalized.format, empty: normalized.empty } as ColumnSchema,
      };
    case "status":
      return {
        accessor,
        schema: {
          ...base,
          type: "status",
          map: normalized.map,
          fallback: normalized.fallback,
          choiceOrder: normalized.choiceOrder,
        } as ColumnSchema,
      };
    case "tag":
      return {
        accessor,
        schema: { ...base, type: "tag", map: normalized.map, fallback: normalized.fallback } as ColumnSchema,
      };
    case "people":
      return {
        accessor,
        schema: { ...base, type: "people", max: normalized.max, empty: normalized.empty } as ColumnSchema,
      };
    case "formula":
      return {
        accessor,
        schema: { ...base, type: "formula", presentation: normalized.presentation } as ColumnSchema,
      };
    case "custom":
      throw new Error(
        `nqgrid: rich column "${normalized.id}" is kind "custom" — it renders an arbitrary ReactNode and has no headless ColumnType. Render it in your app, not through the contract pipeline.`,
      );
    default: {
      const exhaustive: never = normalized;
      throw new Error(`nqgrid: unsupported rich kind ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Convert a whole rich schema, skipping `custom` columns (returned separately). */
export function richSchemaToColumns<TData extends object>(
  defs: readonly RichSchemaColumnDef<TData>[],
): { columns: BridgedColumn<TData>[]; customIds: string[] } {
  const columns: BridgedColumn<TData>[] = [];
  const customIds: string[] = [];
  for (const def of defs) {
    if (normalizeRichSchemaColumnDef(def).kind === "custom") {
      customIds.push(def.id);
      continue;
    }
    columns.push(richDefToColumnSchema(def));
  }
  return { columns, customIds };
}
