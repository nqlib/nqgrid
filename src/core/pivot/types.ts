/**
 * Pivot contract types. `PivotSpec` is the wire format (JSON) shared with non-JS producers
 * (e.g. a Python MCP backend); `PivotModel` is the fully computed, serializable output that
 * every renderer (React grid, static HTML/PDF, XLSX) consumes.
 *
 * Keep in sync with `contract/pivot/v1/pivot-spec.schema.json`.
 */

export const PIVOT_SPEC_VERSION = 1 as const;

/** One input record. Values may be numbers or numeric strings (e.g. serialized decimals). */
export type PivotDataRow = Readonly<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Deterministic number format (no `Intl`), so the Tauri webview, Node export and
 * any other runtime print identical strings.
 */
export interface PivotNumberFormat {
  /** Default `decimal`. Percent expects a ratio (`0.24` → `24%`). */
  readonly style?: "decimal" | "currency" | "percent";
  /** ISO 4217 code; mapped to a symbol for common codes, otherwise printed as `CODE `. */
  readonly currency?: string;
  /** Overrides the symbol derived from `currency`. */
  readonly currencySymbol?: string;
  /**
   * Fixed fraction digits. Defaults: `0` for currency / percent; decimal style prints up to 2,
   * trimming trailing zeros. With `compact`, overrides significant-digit rounding.
   */
  readonly decimals?: number;
  /** Abbreviate with `compactUnits` (`302k`, `4.76M`). Ignored for percent. */
  readonly compact?: boolean;
  /** Compact rounding precision (default 3 → `302k`, `4.76M`, `14.6M`). */
  readonly significantDigits?: number;
  /** Default `["k", "M", "B", "T"]`. */
  readonly compactUnits?: readonly [string, string, string, string];
  /** Default `auto` (only negatives signed). `exceptZero` → `+5.5%`. */
  readonly signDisplay?: "auto" | "always" | "exceptZero" | "never";
  /** Default `minus`. */
  readonly negative?: "minus" | "parentheses";
  readonly prefix?: string;
  readonly suffix?: string;
  /** Default `,`. */
  readonly groupSeparator?: string;
  /** Default `.`. */
  readonly decimalSeparator?: string;
  /** Text for null / non-numeric values (default empty string). */
  readonly empty?: string;
}

// ---------------------------------------------------------------------------
// Spec (input)
// ---------------------------------------------------------------------------

export interface PivotDimension {
  /** Record field holding the key. Keys are compared as strings (`null` → `""`). */
  readonly field: string;
  readonly label?: string;
  /** Explicit key order; keys not listed follow, ordered by `sort`. */
  readonly order?: readonly string[];
  /** Default `none` (first-seen order). */
  readonly sort?: "asc" | "desc" | "none";
  /** Column dimension only: keep keys from `order` even when no record has them (e.g. fiscal months). */
  readonly keepEmpty?: boolean;
  /** Label for the empty key (default `(blank)`). */
  readonly blankLabel?: string;
  /** Fields copied onto rows of this level (first non-null value), e.g. an owner name. */
  readonly attributes?: readonly string[];
}

export type PivotBuiltInAggregate = "sum" | "avg" | "min" | "max" | "count" | "first" | "last";

export type PivotAggregate =
  | PivotBuiltInAggregate
  | { readonly type: "weightedAvg"; readonly weightField: string }
  /** `sum(numerator) / sum(denominator) + offset` — use `offset: -1` for growth. */
  | {
      readonly type: "ratio";
      readonly numeratorField: string;
      readonly denominatorField: string;
      readonly offset?: number;
    }
  /** Looked up by name in `BuildPivotModelOptions.aggregators` (functions cannot cross JSON). */
  | { readonly type: "custom"; readonly name: string };

/** Excel-style "Show values as". Percent results are ratios. */
export type PivotShowAs =
  | "value"
  | "percentOfColumnTotal"
  | "percentOfParentRow"
  | "percentOfRowTotal"
  | "percentOfGrandTotal";

export interface PivotMeasure {
  readonly id: string;
  /** Source field. Required except for `count`, `ratio` and `custom`. */
  readonly field?: string;
  readonly label?: string;
  /** Default `sum`. */
  readonly aggregate?: PivotAggregate;
  /** Format for aggregated values. */
  readonly format?: PivotNumberFormat;
  /** Format for `showAs` percentages (default `{ style: "percent" }`). */
  readonly percentFormat?: PivotNumberFormat;
  /** Applied to leaf rows (default `value`). */
  readonly showAs?: PivotShowAs;
  /** Applied to group and grand-total rows (default: `showAs`). */
  readonly groupShowAs?: PivotShowAs;
}

export type PivotHeatScope = "all" | "column" | "row" | "group";

export interface PivotHeatSpec {
  /** Measure id (default: first entry of `values`). */
  readonly measure?: string;
  /** Cells sharing one color domain. `group` = sibling rows under the same parent. Default `all`. */
  readonly scope?: PivotHeatScope;
  /** Number of discrete levels (default 9 → levels 0–8). */
  readonly levels?: number;
  /** Which rows get heat (default `leaf`). Grand total never does. */
  readonly applyTo?: "leaf" | "group" | "all";
  /** Fixed `[min, max]` instead of the data range. */
  readonly domain?: readonly [number, number];
}

export interface PivotHeaderChartSpec {
  /** Measure id (default: first entry of `values`). */
  readonly measure?: string;
  /** Renderer hint (default `bar`). */
  readonly type?: "bar" | "line";
  /** Include per-top-level-group values for stacked bars. */
  readonly breakdown?: boolean;
}

export interface PivotKpiSpec {
  readonly id: string;
  readonly label?: string;
  /** Measure id, aggregated across all columns. */
  readonly measure: string;
  /** Measure id; adds `delta = value / compare - 1`. */
  readonly compareTo?: string;
  /** Default: the measure's `format`. */
  readonly format?: PivotNumberFormat;
  /** Default `{ style: "percent", decimals: 1, signDisplay: "exceptZero" }`. */
  readonly deltaFormat?: PivotNumberFormat;
}

export interface PivotTotalsSpec {
  /** Default true. */
  readonly grandTotal?: boolean;
  /** Default `bottom`. */
  readonly grandTotalPosition?: "top" | "bottom";
  /** Default `Grand Total`. */
  readonly grandTotalLabel?: string;
  /** Append a total column per value measure (default false). */
  readonly rowTotal?: boolean;
  /** Default `Total`. */
  readonly rowTotalLabel?: string;
}

export interface PivotSpec {
  readonly version: typeof PIVOT_SPEC_VERSION;
  readonly id?: string;
  readonly title?: string;
  readonly subtitle?: string;
  /** Row hierarchy, outermost first. Every level but the last becomes a collapsible group. */
  readonly rows: readonly PivotDimension[];
  /** Optional column dimension (e.g. month). */
  readonly columns?: PivotDimension;
  /** All measures referenced anywhere (grid values, KPIs, charts). */
  readonly measures: readonly PivotMeasure[];
  /** Measure ids shown as grid columns (default: all measures). */
  readonly values?: readonly string[];
  readonly totals?: PivotTotalsSpec;
  /** `all` (default), `none`, or the key paths of expanded groups, e.g. `[["Camp"]]`. */
  readonly expanded?: "all" | "none" | readonly (readonly string[])[];
  readonly heat?: PivotHeatSpec | null;
  readonly headerCharts?: PivotHeaderChartSpec | null;
  readonly kpis?: readonly PivotKpiSpec[];
  /** Group depths that carry `kpis` (default `[0]`). The grand total always does. */
  readonly kpiLevels?: readonly number[];
  /** Renderer hint: one column per row dimension, or one indented hierarchy column. */
  readonly layout?: "tabular" | "compact";
}

// ---------------------------------------------------------------------------
// Model (output)
// ---------------------------------------------------------------------------

export interface PivotKey {
  readonly key: string;
  readonly label: string;
}

export interface PivotValueColumn {
  readonly id: string;
  /** Column-dimension key; `null` for row-total columns or when there is no column dimension. */
  readonly columnKey: string | null;
  readonly columnLabel: string | null;
  readonly measureId: string;
  readonly measureLabel: string;
  /** Header labels outermost first (e.g. `["Nov", "Sales"]`). */
  readonly headerPath: readonly string[];
  readonly format: PivotNumberFormat;
  readonly percentFormat: PivotNumberFormat;
  readonly excelNumFmt: string;
  readonly excelPercentNumFmt: string;
}

export interface PivotHeaderCell {
  readonly label: string;
  readonly colSpan: number;
  readonly columnKey?: string | null;
  readonly measureId?: string;
}

export interface PivotCell {
  /** Displayed value (a ratio when `showAs` is a percent). */
  readonly value: number | null;
  /** Aggregated value before `showAs`. */
  readonly raw: number | null;
  readonly text: string;
  /** Present when not `value`; renderers/exporters pick `percentFormat`. */
  readonly showAs?: Exclude<PivotShowAs, "value">;
  /** Heat level `0 … levels-1`, when heat applies. */
  readonly heat?: number;
}

export interface PivotKpiValue {
  readonly id: string;
  readonly label: string;
  readonly value: number | null;
  readonly text: string;
  readonly delta?: number | null;
  readonly deltaText?: string;
  /** Label of the `compareTo` measure (e.g. `Plan`), so renderers can print "vs Plan". */
  readonly compareLabel?: string;
}

export interface PivotBodyRow {
  readonly id: string;
  readonly kind: "group" | "leaf" | "grandTotal";
  /** Row-dimension level (`-1` for the grand total). */
  readonly depth: number;
  readonly path: readonly string[];
  readonly label: string;
  readonly expandable: boolean;
  readonly expanded: boolean;
  /** Number of direct children (distinct keys at the next level). */
  readonly childCount: number;
  readonly sourceRowCount: number;
  /** Aligned with `PivotModel.columns`. */
  readonly cells: readonly PivotCell[];
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly kpis?: readonly PivotKpiValue[];
}

/** A row-dimension cell that covers `span` consecutive visible rows starting at `rowIndex`. */
export interface PivotRowSpan {
  readonly rowIndex: number;
  readonly span: number;
  readonly path: readonly string[];
}

export interface PivotHeaderSeriesPoint {
  readonly columnId: string;
  readonly columnKey: string;
  readonly label: string;
  readonly value: number | null;
  readonly breakdown?: readonly (PivotKey & { readonly value: number | null })[];
}

export interface PivotHeaderSeries {
  readonly measureId: string;
  readonly type: "bar" | "line";
  readonly points: readonly PivotHeaderSeriesPoint[];
  /** Max of point values (or stacked breakdown totals) for scaling, `null` if no data. */
  readonly max: number | null;
}

export interface PivotModel {
  readonly version: typeof PIVOT_SPEC_VERSION;
  readonly id?: string;
  readonly title?: string;
  readonly subtitle?: string;
  readonly layout: "tabular" | "compact";
  readonly rowDimensions: readonly { readonly field: string; readonly label: string }[];
  readonly columnDimension: { readonly field: string; readonly label: string } | null;
  readonly columnKeys: readonly PivotKey[];
  readonly columns: readonly PivotValueColumn[];
  /** Value-column header rows (outermost first); row-dimension headers come from `rowDimensions`. */
  readonly headerRows: readonly (readonly PivotHeaderCell[])[];
  /** Visible body rows in display order (includes the grand total when enabled). */
  readonly rows: readonly PivotBodyRow[];
  /** Grand total, always computed (also in `rows` when `totals.grandTotal`). */
  readonly grandTotal: PivotBodyRow;
  /** `spans[level]` — row-dimension spans for tabular layouts. */
  readonly spans: readonly (readonly PivotRowSpan[])[];
  readonly heat: {
    readonly measureId: string;
    readonly scope: PivotHeatScope;
    readonly levels: number;
    readonly applyTo: "leaf" | "group" | "all";
  } | null;
  readonly headerSeries: PivotHeaderSeries | null;
  /** Grand-level KPIs. */
  readonly kpis: readonly PivotKpiValue[];
}
