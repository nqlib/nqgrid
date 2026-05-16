import type { ReactNode } from "react";

import type { RichPerson } from "./rich-schema";

export interface ColumnFactoryConfig {
  /** Passed through to rich columns as default `locale` for Intl formatters. */
  readonly locale?: string;
}

/** Args passed to {@link RichColumnFactoryConfig.renderPeoplePicker} (consumer-owned UI). */
export interface RichPeoplePickerRenderArgs<TData extends object> {
  readonly row: TData;
  readonly value: readonly RichPerson[];
  readonly options: readonly RichPerson[];
  readonly max: number;
  readonly empty?: string;
  readonly avatarSizePx: number;
  readonly onChange: (next: readonly RichPerson[]) => void;
}

export type RenderRichPeoplePicker<TData extends object> = (
  args: RichPeoplePickerRenderArgs<TData>,
) => ReactNode;

export interface RichColumnFactoryConfig extends ColumnFactoryConfig {
  /** Alias / explicit default when you want `locale` + a separate fallback (optional). */
  readonly defaultLocale?: string;
  /**
   * Replace default people-column cells when the column sets `editable`, `pickerOptions`, and `onValueChange`.
   * Implement with your design system (e.g. `@nqlib/nqui` Combobox).
   */
  readonly renderPeoplePicker?: RenderRichPeoplePicker<object>;
}
