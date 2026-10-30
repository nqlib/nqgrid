/**
 * Framework-free formatting option types shared by rich columns (React) and the pivot core.
 * Keep this file free of React / TanStack / DOM imports — it is part of `@nqlib/nqgrid/core`.
 */

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
