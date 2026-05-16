import type { CellContext } from "@tanstack/react-table";
import type { ReactNode } from "react";

/** Avatar stack entry (people column). */
export interface RichPerson {
  readonly id?: string;
  readonly name: string;
  readonly avatarUrl?: string;
  /** Alias for `avatarUrl` when sourcing fixture rows. */
  readonly image?: string;
}

export type RichPillVariant = "default" | "secondary" | "destructive" | "outline";

export interface RichStatusMapEntry {
  readonly label: string;
  /** Preset chip theme; used when custom color fields below are omitted. */
  readonly variant?: RichPillVariant;
  /** Text color (any CSS color); overrides variant foreground when set. */
  readonly color?: string;
  /** Background fill; overrides variant background when set. */
  readonly backgroundColor?: string;
  /** Border color; overrides variant border when set. */
  readonly borderColor?: string;
}

/** How a number column formats values (decimal uses prefix/suffix; currency/percent use Intl). */
export type RichNumberStyle = "decimal" | "currency" | "percent";

/**
 * Unified number column metadata. Prefer `kind: "number"` with `format.style` instead of separate
 * `currency` / `percent` column kinds (those kinds are still accepted and normalized).
 */
export interface RichNumberFormatOptions {
  /** Default `decimal` — use `prefix` / `suffix` for units (e.g. `"$"`, `" h"`, `" °C"`). */
  readonly style?: RichNumberStyle;
  readonly locale?: string;
  /** Decimal style: prepended string. Ignored when `style` is `currency` (use `currency` code). */
  readonly prefix?: string;
  /** Decimal: unit suffix; percent: defaults to `"%"` when omitted. */
  readonly suffix?: string;
  /** When `style` is `currency`, ISO 4217 code (e.g. `USD`, `EUR`). */
  readonly currency?: string;
  readonly minimumFractionDigits?: number;
  readonly maximumFractionDigits?: number;
  readonly notation?: Intl.NumberFormatOptions["notation"];
  /** When `notation` is `compact`, maps to Intl `compactDisplay` (default Intl behavior is `short`). */
  readonly compactDisplay?: "short" | "long";
  /** Passed to `Intl.NumberFormat` when supported by the runtime. */
  readonly roundingMode?: string;
  /** Percent style: `ratio` = 0–1, `hundred` = 0–100 (default `hundred`). */
  readonly valueScale?: "ratio" | "hundred";
  /** Percent style: plain label vs battery bar (default `plain`). */
  readonly percentDisplay?: "plain" | "battery";
  /** Percent + plain: round to integer before suffix. */
  readonly roundWhole?: boolean;
}

/**
 * @deprecated Use `RichNumberFormatOptions` with `style: "percent"` and `percentDisplay`.
 */
export interface RichPercentFormatOptions {
  readonly locale?: string;
  readonly valueScale?: "ratio" | "hundred";
  readonly display?: "plain" | "battery";
  readonly suffix?: string;
  readonly minimumFractionDigits?: number;
  readonly maximumFractionDigits?: number;
  readonly roundWhole?: boolean;
}

export type RichDateFormatOptions =
  | {
      readonly preset?: "dateShort" | "dateMedium" | "datetimeShort" | "timeShort";
      readonly locale?: string;
      readonly timeZone?: string;
    }
  | {
      readonly intl: Intl.DateTimeFormatOptions;
      readonly locale?: string;
      readonly timeZone?: string;
    };

export type AccessorOf<TData extends object> =
  | { readonly accessorKey: keyof TData & string; readonly accessorPath?: never }
  | { readonly accessorPath: string; readonly accessorKey?: never };

interface RichColumnBase {
  readonly id: string;
  /** Shown in header when `header` omitted. */
  readonly name: string;
  readonly header?: string;
  readonly width?: number;
  readonly enableSorting?: boolean;
}

export type TextRichColumn<TData extends object> = RichColumnBase &
  AccessorOf<TData> & {
    readonly kind: "text";
    readonly empty?: string;
    readonly maxLength?: number;
    readonly className?: string;
  };

export type NumberRichColumn<TData extends object> = RichColumnBase &
  AccessorOf<TData> & {
    readonly kind: "number";
    readonly format?: RichNumberFormatOptions;
    readonly empty?: string;
    readonly align?: "left" | "right";
  };

/** @deprecated Use `NumberRichColumn` with `format: { style: "currency", currency: "USD" }`. */
export type CurrencyRichColumn<TData extends object> = RichColumnBase &
  AccessorOf<TData> & {
    readonly kind: "currency";
    readonly currency: string;
    readonly locale?: string;
    readonly minimumFractionDigits?: number;
    readonly maximumFractionDigits?: number;
    readonly empty?: string;
    readonly align?: "left" | "right";
  };

/** @deprecated Use `NumberRichColumn` with `format: { style: "percent", percentDisplay: "battery" }`. */
export type PercentRichColumn<TData extends object> = RichColumnBase &
  AccessorOf<TData> & {
    readonly kind: "percent";
    readonly format?: RichPercentFormatOptions;
    readonly align?: "left" | "right";
  };

export type DateRichColumn<TData extends object> = RichColumnBase &
  AccessorOf<TData> & {
    readonly kind: "date";
    readonly format?: RichDateFormatOptions;
    readonly empty?: string;
  };

export type RichStatusValueChange<TData extends object> = (args: {
  readonly row: TData;
  readonly value: string;
  readonly previousValue: string;
}) => void;

export type StatusRichColumn<TData extends object> = RichColumnBase &
  AccessorOf<TData> & {
    readonly kind: "status";
    readonly map: Readonly<Record<string, RichStatusMapEntry>>;
    readonly fallback?: RichStatusMapEntry;
    /** Display order for dropdown options (defaults to map key order). */
    readonly choiceOrder?: readonly string[];
    /** When true, render a dropdown in the cell (requires `onValueChange`). */
    readonly editable?: boolean;
    readonly onValueChange?: RichStatusValueChange<TData>;
  };

export type TagRichColumn<TData extends object> = RichColumnBase &
  AccessorOf<TData> & {
    readonly kind: "tag";
    readonly map: Readonly<Record<string, RichStatusMapEntry>>;
    readonly fallback?: RichStatusMapEntry;
    /** Smaller chip chrome than `status`. */
    readonly compact?: boolean;
  };

export type RichPeopleValueChange<TData extends object> = (args: {
  readonly row: TData;
  readonly value: readonly RichPerson[];
}) => void;

export type PeopleRichColumn<TData extends object> = RichColumnBase &
  AccessorOf<TData> & {
    readonly kind: "people";
    readonly max?: number;
    readonly empty?: string;
    readonly avatarSizePx?: number;
    /** When true, cells use `RichColumnFactoryConfig.renderPeoplePicker` (required) plus `pickerOptions` and `onValueChange`. */
    readonly editable?: boolean;
    /** Directory of people shown in the picker (typically stable ids or names as keys). */
    readonly pickerOptions?: readonly RichPerson[];
    readonly onValueChange?: RichPeopleValueChange<TData>;
  };

export type FormulaPresentation =
  | { readonly type: "text"; readonly empty?: string; readonly maxLength?: number; readonly className?: string }
  | {
      readonly type: "number";
      readonly format?: RichNumberFormatOptions;
      readonly empty?: string;
      readonly align?: "left" | "right";
    }
  | {
      /** @deprecated Prefer `type: "number"` with `format.style: "currency"`. */
      readonly type: "currency";
      readonly currency: string;
      readonly locale?: string;
      readonly minimumFractionDigits?: number;
      readonly maximumFractionDigits?: number;
      readonly empty?: string;
      readonly align?: "left" | "right";
    }
  | {
      /** @deprecated Prefer `type: "number"` with `format.style: "percent"`. */
      readonly type: "percent";
      readonly format?: RichPercentFormatOptions;
      readonly align?: "left" | "right";
      readonly empty?: string;
    }
  | { readonly type: "date"; readonly format?: RichDateFormatOptions; readonly empty?: string }
  | {
      readonly type: "status";
      readonly map: Readonly<Record<string, RichStatusMapEntry>>;
      readonly fallback?: RichStatusMapEntry;
    }
  | {
      readonly type: "tag";
      readonly map: Readonly<Record<string, RichStatusMapEntry>>;
      readonly fallback?: RichStatusMapEntry;
      readonly compact?: boolean;
    }
  | { readonly type: "people"; readonly max?: number; readonly empty?: string; readonly avatarSizePx?: number };

export type FormulaRichColumn<TData extends object> = RichColumnBase & {
  readonly kind: "formula";
  readonly compute: (row: TData) => unknown;
  readonly presentation: FormulaPresentation;
  readonly enableSorting?: boolean;
};

export type CustomRichColumn<TData extends object> = RichColumnBase & {
  readonly kind: "custom";
  readonly cell: (ctx: CellContext<TData, unknown>) => ReactNode;
} & Partial<AccessorOf<TData>>;

export type RichSchemaColumnDef<TData extends object = Record<string, unknown>> =
  | TextRichColumn<TData>
  | NumberRichColumn<TData>
  | CurrencyRichColumn<TData>
  | PercentRichColumn<TData>
  | DateRichColumn<TData>
  | StatusRichColumn<TData>
  | TagRichColumn<TData>
  | PeopleRichColumn<TData>
  | FormulaRichColumn<TData>
  | CustomRichColumn<TData>;

export type RichColumnKind = RichSchemaColumnDef["kind"];

/** Optional TanStack `meta` marker for rich columns. */
export interface NqgridRichColumnMeta {
  readonly nqgridRich?: {
    readonly kind: RichColumnKind;
  };
}
