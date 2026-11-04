import type { CSSProperties, ReactElement } from "react";

import { tableRichPillBaseClass, tableRichPillVariantClass, tableRichStatusSelectClass } from "./styles";
import type { RichPillVariant, RichStatusMapEntry } from "@nqlib/nqgrid";
import { resolveStatusEntry } from "@nqlib/nqgrid";

/** Inline styles from optional `RichStatusMapEntry` color fields (undefined if none set). */
export function richStatusEntryInlineStyle(entry: RichStatusMapEntry): CSSProperties | undefined {
  const style: CSSProperties = {};
  if (entry.color) style.color = entry.color;
  if (entry.backgroundColor) style.backgroundColor = entry.backgroundColor;
  if (entry.borderColor) style.borderColor = entry.borderColor;
  return Object.keys(style).length > 0 ? style : undefined;
}

function joinClasses(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function pillVariantClass(v: RichPillVariant | undefined): string {
  const key = v ?? "outline";
  return tableRichPillVariantClass[key as keyof typeof tableRichPillVariantClass] ?? tableRichPillVariantClass.outline;
}

export function statusChoiceKeys(
  map: Readonly<Record<string, RichStatusMapEntry>>,
  choiceOrder?: readonly string[],
): readonly string[] {
  if (choiceOrder?.length) {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const k of choiceOrder) {
      if (k in map && !seen.has(k)) {
        seen.add(k);
        ordered.push(k);
      }
    }
    for (const k of Object.keys(map)) {
      if (!seen.has(k)) ordered.push(k);
    }
    return ordered;
  }
  return Object.keys(map);
}

export function RichStatusCell({
  value,
  map,
  fallback,
  choiceOrder,
  editable,
  onValueChange,
  ariaLabel,
}: {
  readonly value: unknown;
  readonly map: Readonly<Record<string, RichStatusMapEntry>>;
  readonly fallback?: RichStatusMapEntry;
  readonly choiceOrder?: readonly string[];
  readonly editable?: boolean;
  readonly onValueChange?: (nextKey: string) => void;
  readonly ariaLabel?: string;
}): ReactElement {
  const key = value == null ? "" : String(value);
  const entry = resolveStatusEntry(value, map, fallback);
  const keys = statusChoiceKeys(map, choiceOrder);
  const canEdit = editable === true && onValueChange != null && keys.length > 0;

  const customStyle = richStatusEntryInlineStyle(entry);

  if (!canEdit) {
    return (
      <span
        className={joinClasses(tableRichPillBaseClass, pillVariantClass(entry.variant))}
        style={customStyle}
      >
        {entry.label}
      </span>
    );
  }

  return (
    <select
      value={key}
      onChange={(e) => onValueChange(e.target.value)}
      className={joinClasses(tableRichStatusSelectClass, pillVariantClass(entry.variant))}
      style={customStyle}
      aria-label={ariaLabel ?? `Status: ${entry.label}`}
    >
      {keys.map((k) => {
        const opt = map[k];
        return (
          <option key={k} value={k}>
            {opt?.label ?? k}
          </option>
        );
      })}
    </select>
  );
}
