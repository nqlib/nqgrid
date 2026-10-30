import type { CellContext } from "@tanstack/react-table";
import type { ReactNode } from "react";

import type {
  FormulaPresentation,
  RichDateFormatOptions,
  RichNumberFormatOptions,
  RichPercentFormatOptions,
  RichPerson,
  RichStatusMapEntry,
} from "../core/format-types";

export type {
  FormulaPresentation,
  RichDateFormatOptions,
  RichNumberFormatOptions,
  RichNumberStyle,
  RichPercentFormatOptions,
  RichPerson,
  RichPillVariant,
  RichStatusMapEntry,
} from "../core/format-types";

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
