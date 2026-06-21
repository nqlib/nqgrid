import { effectiveNumberStyle, normalizeRichSchemaColumnDef } from "./normalize-rich-schema";
import { statusChoiceKeys } from "./rich-status-cell";
import type { FormulaPresentation, RichSchemaColumnDef } from "./rich-schema";
import type { RichNumberFormatOptions } from "./rich-schema";
import {
  coerceDate,
  coerceNumber,
  normalizePeopleList,
  normalizePercentToHundred,
  parseTimelineRaw,
} from "./rich-value-format";

/** Sorts/groups place missing numeric values last in ascending order. */
const MISSING_NUMBER = Number.POSITIVE_INFINITY;

function numberCompareKey(raw: unknown, format?: RichNumberFormatOptions): number {
  const n =
    effectiveNumberStyle(format) === "percent" ? normalizePercentToHundred(raw, format) : coerceNumber(raw);
  return n ?? MISSING_NUMBER;
}

function statusOrderKey(
  raw: unknown,
  map: Readonly<Record<string, { label: string }>>,
  choiceOrder?: readonly string[],
): number {
  const keys = statusChoiceKeys(map, choiceOrder);
  const idx = keys.indexOf(raw == null ? "" : String(raw));
  // Unknown / unmapped values sort after every defined option.
  return idx === -1 ? keys.length : idx;
}

function presentationCompareKey(raw: unknown, presentation: FormulaPresentation): number | string {
  switch (presentation.type) {
    case "number":
      return numberCompareKey(raw, presentation.format);
    case "currency":
      return coerceNumber(raw) ?? MISSING_NUMBER;
    case "percent":
      return normalizePercentToHundred(raw) ?? MISSING_NUMBER;
    case "date":
      return coerceDate(raw)?.getTime() ?? MISSING_NUMBER;
    case "status":
    case "tag":
      return statusOrderKey(raw, presentation.map);
    case "people": {
      const list = normalizePeopleList(raw);
      return (list[0]?.name ?? "").toLowerCase();
    }
    case "text":
    default:
      return String(raw ?? "").toLowerCase();
  }
}

/**
 * The ordering key the engine sorts/groups on — derived from the **parsed** value, never
 * the rendered display string. This is what makes a `status` column sort by workflow
 * `order` instead of alphabetically, and what a board view groups its columns by.
 *
 * Keys are intra-column comparable: numeric kinds return numbers, label kinds return
 * their option order index, text/people return lowercased strings.
 */
export function richCompareKey<TData extends object>(
  def: RichSchemaColumnDef<TData>,
  raw: unknown,
): number | string {
  const d = normalizeRichSchemaColumnDef(def);
  switch (d.kind) {
    case "number":
      return numberCompareKey(raw, d.format);
    case "date":
      return coerceDate(raw)?.getTime() ?? MISSING_NUMBER;
    case "timeline":
      return parseTimelineRaw(raw)?.start.getTime() ?? MISSING_NUMBER;
    case "status":
    case "tag":
      return statusOrderKey(raw, d.map, "choiceOrder" in d ? d.choiceOrder : undefined);
    case "people": {
      const list = normalizePeopleList(raw);
      return (list[0]?.name ?? "").toLowerCase();
    }
    case "formula":
      return presentationCompareKey(raw, d.presentation);
    case "text":
    case "custom":
    default:
      return String(raw ?? "").toLowerCase();
  }
}

/**
 * A TanStack-compatible comparator built from {@link richCompareKey}. Use as a column's
 * `sortingFn` so sorting honors the type contract rather than raw cell order.
 */
export function richSortingFn<TData extends object>(def: RichSchemaColumnDef<TData>) {
  return (rawA: unknown, rawB: unknown): number => {
    const ka = richCompareKey(def, rawA);
    const kb = richCompareKey(def, rawB);
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return 0;
  };
}
