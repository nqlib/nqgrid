import type {
  CurrencyRichColumn,
  NumberRichColumn,
  PercentRichColumn,
  RichNumberFormatOptions,
  RichNumberStyle,
  RichPercentFormatOptions,
  RichSchemaColumnDef,
} from "./rich-schema";

export function effectiveNumberStyle(opts?: RichNumberFormatOptions): RichNumberStyle {
  return opts?.style ?? "decimal";
}

/** Map legacy percent options into unified number format. */
export function percentFormatToNumberFormat(fmt?: RichPercentFormatOptions): RichNumberFormatOptions | undefined {
  if (!fmt) return undefined;
  return {
    style: "percent",
    locale: fmt.locale,
    valueScale: fmt.valueScale,
    percentDisplay: fmt.display,
    suffix: fmt.suffix,
    minimumFractionDigits: fmt.minimumFractionDigits,
    maximumFractionDigits: fmt.maximumFractionDigits,
    roundWhole: fmt.roundWhole,
  };
}

function accessorOf<T extends object>(
  def: CurrencyRichColumn<T> | PercentRichColumn<T>,
): Pick<NumberRichColumn<T>, "accessorKey"> | Pick<NumberRichColumn<T>, "accessorPath"> {
  if ("accessorPath" in def && def.accessorPath) {
    return { accessorPath: def.accessorPath };
  }
  return { accessorKey: def.accessorKey };
}

/**
 * Normalize legacy `currency` / `percent` column defs to `kind: "number"` with `format.style`.
 * Safe to call before `buildRichColumnFromDef` / `RichColumnCell`.
 */
export function normalizeRichSchemaColumnDef<T extends object>(
  def: RichSchemaColumnDef<T>,
): RichSchemaColumnDef<T> {
  if (def.kind === "currency") {
    const c = def as CurrencyRichColumn<T>;
    return {
      id: c.id,
      name: c.name,
      header: c.header,
      width: c.width,
      enableSorting: c.enableSorting,
      ...accessorOf(c),
      kind: "number",
      align: c.align ?? "right",
      empty: c.empty,
      format: {
        style: "currency",
        currency: c.currency,
        locale: c.locale,
        minimumFractionDigits: c.minimumFractionDigits,
        maximumFractionDigits: c.maximumFractionDigits,
      },
    } as NumberRichColumn<T>;
  }

  if (def.kind === "percent") {
    const p = def as PercentRichColumn<T>;
    return {
      id: p.id,
      name: p.name,
      header: p.header,
      width: p.width,
      enableSorting: p.enableSorting,
      ...accessorOf(p),
      kind: "number",
      align: p.align ?? "right",
      format: percentFormatToNumberFormat(p.format),
    } as NumberRichColumn<T>;
  }

  return def;
}
