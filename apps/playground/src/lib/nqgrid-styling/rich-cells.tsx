import type { ReactElement, ReactNode } from "react";
import { Fragment } from "react";

import { TablePercentBattery } from "./table-percent-battery";
import {
  tableNumericMutedClass,
  tableNumericStrongClass,
  tableRichPillBaseClass,
  tableRichPillVariantClass,
  tableRichTagBaseClass,
} from "./styles";
import { effectiveNumberStyle, normalizeRichSchemaColumnDef } from "@nqlib/nqgrid";
import { RichStatusCell, richStatusEntryInlineStyle } from "./rich-status-cell";
import type { FormulaPresentation, RichNumberFormatOptions, RichPillVariant, RichSchemaColumnDef } from "@nqlib/nqgrid";
import {
  avatarSrc,
  formatDateValue,
  formatNumberValue,
  formatPercentPlain,
  initials,
  mergeRichDateFormatLocale,
  normalizePeopleList,
  normalizePercentToHundred,
  resolveStatusEntry,
} from "@nqlib/nqgrid";

function joinClasses(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function pillVariantClass(v: RichPillVariant | undefined): string {
  const key = v ?? "outline";
  return tableRichPillVariantClass[key as keyof typeof tableRichPillVariantClass] ?? tableRichPillVariantClass.outline;
}

function withLocale<T extends { locale?: string }>(fmt: T | undefined, defaultLocale?: string): T | undefined {
  if (!fmt && !defaultLocale) return fmt;
  return { ...(fmt ?? ({} as T)), locale: fmt?.locale ?? defaultLocale };
}

function rightWrap(children: ReactNode, align?: "left" | "right"): ReactNode {
  if (align === "right") {
    return <div className="text-right">{children}</div>;
  }
  return children;
}

export function RichNumberCell({
  raw,
  format,
  align,
  empty,
  defaultLocale,
}: {
  readonly raw: unknown;
  readonly format?: RichNumberFormatOptions;
  readonly align?: "left" | "right";
  readonly empty?: string;
  readonly defaultLocale?: string;
}): ReactElement {
  const opts = withLocale(format, defaultLocale);
  const emptyText = empty ?? "—";
  const style = effectiveNumberStyle(opts);

  if (style === "percent") {
    const display = opts?.percentDisplay ?? "plain";
    const hundred = normalizePercentToHundred(raw, opts);
    if (hundred == null) {
      return <span className={joinClasses("text-right", tableNumericMutedClass)}>{emptyText}</span>;
    }
    if (display === "battery") {
      return (
        <TablePercentBattery
          value={hundred}
          suffix={opts?.suffix}
          className={align === "left" ? "justify-start" : undefined}
        />
      );
    }
    const { text } = formatPercentPlain(raw, opts, emptyText);
    return <div className={joinClasses("text-right", tableNumericMutedClass)}>{text}</div>;
  }

  const inner = (
    <span className={align === "right" ? tableNumericStrongClass : tableNumericMutedClass}>
      {formatNumberValue(raw, opts, emptyText)}
    </span>
  );
  return <Fragment>{rightWrap(inner, align)}</Fragment>;
}

export function RichFormulaPresentationCell({
  raw,
  presentation,
  defaultLocale,
}: {
  readonly raw: unknown;
  readonly presentation: FormulaPresentation;
  readonly defaultLocale?: string;
}): ReactElement {
  switch (presentation.type) {
    case "text": {
      if (raw == null || raw === "") {
        return <span className="text-muted-foreground">{presentation.empty ?? "—"}</span>;
      }
      let s = String(raw);
      if (presentation.maxLength != null) s = s.slice(0, presentation.maxLength);
      return <span className={presentation.className}>{s}</span>;
    }
    case "number":
      return (
        <RichNumberCell
          raw={raw}
          format={withLocale(presentation.format, defaultLocale)}
          align={presentation.align}
          empty={presentation.empty}
          defaultLocale={defaultLocale}
        />
      );
    case "currency":
      return (
        <RichNumberCell
          raw={raw}
          format={{
            style: "currency",
            currency: presentation.currency,
            locale: presentation.locale ?? defaultLocale,
            minimumFractionDigits: presentation.minimumFractionDigits,
            maximumFractionDigits: presentation.maximumFractionDigits,
          }}
          align={presentation.align}
          empty={presentation.empty}
          defaultLocale={defaultLocale}
        />
      );
    case "percent":
      return (
        <RichNumberCell
          raw={raw}
          format={{
            style: "percent",
            locale: presentation.format?.locale ?? defaultLocale,
            valueScale: presentation.format?.valueScale,
            percentDisplay: presentation.format?.display,
            suffix: presentation.format?.suffix,
            minimumFractionDigits: presentation.format?.minimumFractionDigits,
            maximumFractionDigits: presentation.format?.maximumFractionDigits,
            roundWhole: presentation.format?.roundWhole,
          }}
          align={presentation.align}
          empty={presentation.empty}
          defaultLocale={defaultLocale}
        />
      );
    case "date":
      return (
        <span className={tableNumericMutedClass}>
          {formatDateValue(raw, mergeRichDateFormatLocale(presentation.format, defaultLocale), presentation.empty ?? "—")}
        </span>
      );
    case "status":
      return (
        <RichStatusCell
          value={raw}
          map={presentation.map}
          fallback={presentation.fallback}
        />
      );
    case "tag": {
      const e = resolveStatusEntry(raw, presentation.map, presentation.fallback);
      const base = presentation.compact ? tableRichTagBaseClass : tableRichPillBaseClass;
      return (
        <span
          className={joinClasses(base, pillVariantClass(e.variant))}
          style={richStatusEntryInlineStyle(e)}
        >
          {e.label}
        </span>
      );
    }
    case "people": {
      const list = normalizePeopleList(raw);
      if (list.length === 0) {
        return <span className="text-muted-foreground">{presentation.empty ?? "—"}</span>;
      }
      const max = presentation.max ?? 6;
      const slice = list.slice(0, max);
      const size = presentation.avatarSizePx ?? 28;
      const names = slice.map((p) => p.name).join(", ");
      return (
        <div className="flex -space-x-2 p-0.5" role="group" aria-label={names}>
          {slice.map((p, i) => {
            const src = avatarSrc(p);
            const label = p.name;
            return (
              <span
                key={p.id ?? `${label}-${i}`}
                className="relative inline-flex shrink-0 rounded-full border-2 border-background bg-muted outline-none ring-offset-background"
                title={label}
                style={{ width: size, height: size, zIndex: slice.length - i }}
              >
                {src ? (
                  <img src={src} alt="" className="size-full rounded-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex size-full items-center justify-center rounded-full text-[10px] font-medium text-muted-foreground">
                    {initials(label)}
                  </span>
                )}
                <span className="sr-only">{label}</span>
              </span>
            );
          })}
        </div>
      );
    }
    default:
      return <span className="text-muted-foreground">—</span>;
  }
}

export function RichColumnCell(props: {
  readonly def: RichSchemaColumnDef<object>;
  readonly raw: unknown;
  readonly defaultLocale?: string;
  readonly row?: object;
  readonly onStatusValueChange?: (value: string) => void;
}): ReactElement {
  const { raw, defaultLocale, row, onStatusValueChange } = props;
  const def = normalizeRichSchemaColumnDef(props.def);

  switch (def.kind) {
    case "text": {
      if (raw == null || raw === "") {
        return <span className={joinClasses("text-muted-foreground", def.className)}>{def.empty ?? "—"}</span>;
      }
      let s = String(raw);
      if (def.maxLength != null) s = s.slice(0, def.maxLength);
      return <span className={def.className}>{s}</span>;
    }
    case "number":
      return (
        <RichNumberCell
          raw={raw}
          format={def.format}
          align={def.align}
          empty={def.empty}
          defaultLocale={defaultLocale}
        />
      );
    case "date":
      return (
        <span className={tableNumericMutedClass}>
          {formatDateValue(raw, mergeRichDateFormatLocale(def.format, defaultLocale), def.empty ?? "—")}
        </span>
      );
    case "status":
      return (
        <RichStatusCell
          value={raw}
          map={def.map}
          fallback={def.fallback}
          choiceOrder={def.choiceOrder}
          editable={def.editable}
          onValueChange={onStatusValueChange}
          ariaLabel={row && "name" in row ? `Status for ${String((row as { name?: string }).name)}` : undefined}
        />
      );
    case "tag": {
      const e = resolveStatusEntry(raw, def.map, def.fallback);
      const base = def.compact ? tableRichTagBaseClass : tableRichPillBaseClass;
      return (
        <span
          className={joinClasses(base, pillVariantClass(e.variant))}
          style={richStatusEntryInlineStyle(e)}
        >
          {e.label}
        </span>
      );
    }
    case "people": {
      const list = normalizePeopleList(raw);
      if (list.length === 0) {
        return <span className="text-muted-foreground">{def.empty ?? "—"}</span>;
      }
      const max = def.max ?? 6;
      const slice = list.slice(0, max);
      const size = def.avatarSizePx ?? 28;
      const names = slice.map((p) => p.name).join(", ");
      return (
        <div className="flex -space-x-2 p-0.5" role="group" aria-label={names}>
          {slice.map((p, i) => {
            const src = avatarSrc(p);
            const label = p.name;
            return (
              <span
                key={p.id ?? `${label}-${i}`}
                className="relative inline-flex shrink-0 rounded-full border-2 border-background bg-muted outline-none"
                title={label}
                style={{ width: size, height: size, zIndex: slice.length - i }}
              >
                {src ? (
                  <img src={src} alt="" className="size-full rounded-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex size-full items-center justify-center rounded-full text-[10px] font-medium text-muted-foreground">
                    {initials(label)}
                  </span>
                )}
                <span className="sr-only">{label}</span>
              </span>
            );
          })}
        </div>
      );
    }
    case "formula":
      return <RichFormulaPresentationCell raw={raw} presentation={def.presentation} defaultLocale={defaultLocale} />;
    case "custom":
      throw new Error("`RichColumnCell` does not handle `custom` — use `cell` from `buildRichColumnFromDef` directly.");
    default:
      return <span className="text-muted-foreground">—</span>;
  }
}
