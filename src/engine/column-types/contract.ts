/**
 * The ColumnType contract — the single data-model seam every view engine shares.
 *
 * A cell stores ONE value: `raw`. Type, format, and style are pure functions OVER
 * `raw`, never stored copies of it. Editors write `raw` back and nothing else.
 * Sort / filter / group / board placement operate on `compareKey(parse(raw))`,
 * never on the rendered display string.
 *
 * This layer is intentionally headless: every function returns data or geometry —
 * numbers, strings, colors, intervals — never a look. A `CellStyle.chipColor` is a
 * raw color value (`"#16a34a"`, `"oklch(...)"`), NOT a class string. The consuming
 * app decides how that data becomes pixels.
 *
 * See `references/columntype-contract.md` (nqlib SKILL) for the worked rationale.
 */

/** A closed status/label option. Style is data carried by the option, defined once. */
export interface SelectOption {
  /** STABLE id — cells store this, never the label. Rename labels freely. */
  readonly id: string | number;
  readonly label: string;
  /** Raw color value (hex / oklch / css var ref). Data, not a class name. */
  readonly color?: string;
  /** Ordinal position → drives sort + board-column order. */
  readonly order: number;
}

/**
 * Per-column defaults. A cell may override any layer (`Cell.type/format/style`);
 * the effective layer is `cell.override ?? column.default`.
 */
export interface ColumnSchema {
  readonly id: string;
  readonly label: string;
  /** Key into the type registry: "number" | "text" | "select" | "date" | ... */
  readonly type: string;
  /** Type-specific formatting config (number-format opts, date preset, …). */
  readonly format?: Readonly<Record<string, unknown>>;
  /** For select/status: the closed option set. */
  readonly options?: readonly SelectOption[];
  /** Escape hatch for type-specific extras without widening the core interface. */
  readonly [key: string]: unknown;
}

/** A single cell: raw is the source of truth; the override layers are optional. */
export interface Cell<TRaw = unknown> {
  readonly raw: TRaw;
  readonly type?: string;
  readonly format?: Readonly<Record<string, unknown>>;
  readonly options?: readonly SelectOption[];
}

/** Returned by `parse` when raw fails validation. Sorts last; renders empty. */
export interface CellTypeError {
  readonly _tag: "CellTypeError";
  readonly message: string;
  readonly raw: unknown;
}

export function typeError(message: string, raw: unknown): CellTypeError {
  return { _tag: "CellTypeError", message, raw };
}

export function isTypeError(value: unknown): value is CellTypeError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as CellTypeError)._tag === "CellTypeError"
  );
}

/**
 * Visual treatment as DATA (never class strings). The consumer maps these to its
 * own design system. All fields optional — a plain number returns `{}`.
 */
export interface CellStyle {
  /** Chip/pill foreground color (raw color value). */
  readonly chipColor?: string;
  /** Chip/pill background fill (raw color value). */
  readonly chipBackground?: string;
  /** Chip/pill border color (raw color value). */
  readonly chipBorder?: string;
  /**
   * A named style token the consumer resolves (e.g. "secondary", "destructive").
   * Data, not a class string — used when a type themes by name rather than raw
   * color (e.g. a status option carrying only a `variant`).
   */
  readonly variant?: string;
  /** Text alignment hint. */
  readonly align?: "left" | "center" | "right";
  /** 0..1 fill ratio for progress / percent / battery visuals. */
  readonly bar?: number;
  /** Render de-emphasized (empty / fallback values). */
  readonly muted?: boolean;
}

/** A time span — the seam time-axis views (gantt/calendar) project rows onto. */
export interface Interval {
  readonly start: Date;
  readonly end: Date;
}

/** Which editor control the consuming app should mount. Editors commit raw only. */
export type EditorControl = "text" | "number" | "date" | "select" | "none";

/**
 * A DECLARATIVE editor descriptor. The headless engine does not ship React
 * editor components (those carry markup/styling and belong to the consuming app);
 * it describes which control to mount and the option set, and the app supplies the
 * widget that commits `raw` back through the normal cell-update path.
 */
export interface EditorDescriptor {
  readonly control: EditorControl;
  readonly options?: readonly SelectOption[];
}

/**
 * The one interface the engine knows. It does NOT know what "status", "currency",
 * or "person" is — those are registry plugins implementing this shape. No engine
 * code may branch on a concrete type; new types are new registry entries.
 */
export interface ColumnType<TRaw = unknown, TParsed = TRaw> {
  /** Registry key. */
  readonly name: string;

  /** layer 1 — coerce/validate the stored scalar. Returns parsed value or an error. */
  parse(raw: TRaw, schema: ColumnSchema): TParsed | CellTypeError;

  /** layer 2 — value → what the user sees. Pure. Never mutates raw. */
  format(parsed: TParsed, schema: ColumnSchema): string;

  /** layer 3 — value → visual treatment as data. Pure. */
  style(parsed: TParsed, schema: ColumnSchema): CellStyle;

  /** ordering key — engines sort/group on THIS, never on format() output. */
  compareKey(parsed: TParsed, schema: ColumnSchema): number | string;

  /** which editor control commits raw. */
  editor(schema: ColumnSchema): EditorDescriptor;

  /** OPTIONAL — for time-based views (gantt/calendar). Maps a value to an interval. */
  toInterval?(parsed: TParsed, schema: ColumnSchema): Interval | null;
}
