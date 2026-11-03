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
  /**
   * Row dimensions only: order siblings by a measure instead of by key. Wins over `order` and
   * `sort`, which only break ties (see "Filters & sorting" in `docs/pivot-headless.md`).
   */
  readonly sortBy?: PivotSortBySpec;
  /** Row dimensions only: keep the top / bottom `count` keys within each parent group. */
  readonly topN?: PivotTopNSpec;
}

/** Sort sibling keys by an aggregated measure (raw value, before `showAs`). */
export interface PivotSortBySpec {
  readonly measure: string;
  /** Default `desc`. Keys without a value always sort last. */
  readonly direction?: "asc" | "desc";
  /** Rank by this column-dimension key; default: the row total across all columns. */
  readonly columnKey?: string;
}

/**
 * Excel "Top 10" value filter, applied within each parent group after report / label filters.
 * Excluded keys drop out of every total, unless `other` folds them into one "Other" row.
 */
export interface PivotTopNSpec {
  readonly measure: string;
  /** Number of keys to keep per parent (≥ 1). Ties beyond `count` are cut deterministically. */
  readonly count: number;
  /** Default `top`. */
  readonly direction?: "top" | "bottom";
  /** Rank by this column-dimension key; default: the row total. */
  readonly columnKey?: string;
  /** Fold the remaining keys into one row (key `PIVOT_OTHER_KEY`) so totals stay complete. Default false. */
  readonly other?: boolean;
  /** Label of the "Other" row (default `Other`). */
  readonly otherLabel?: string;
}

export type PivotLabelMatchOp = "contains" | "notContains" | "beginsWith" | "endsWith" | "equals" | "notEquals";

/** Label filter, matched against the key string (`null` → `""`). Case-insensitive by default. */
export interface PivotLabelMatch {
  readonly op: PivotLabelMatchOp;
  readonly value: string;
  readonly caseSensitive?: boolean;
}

/**
 * Report / slicer filter on any record field (also fields that are not rows or columns).
 * Applied to source records before aggregation; all parts must pass, and filters on different
 * fields are ANDed. Keys are compared as strings (`null` → `""`, `2024` → `"2024"`).
 */
export interface PivotFilter {
  readonly field: string;
  /** Keep only these keys (`[]` keeps nothing). */
  readonly include?: readonly string[];
  /** Drop these keys. */
  readonly exclude?: readonly string[];
  readonly match?: PivotLabelMatch;
  /** Printed in filter summaries (default: the dimension / facet label, else `field`). */
  readonly label?: string;
}

/** A slicer-ready field: `field`, or `{ field, label }`. */
export type PivotFacetSpec = string | { readonly field: string; readonly label?: string };

/**
 * Kind of a record field in the field catalogue (field list):
 * `dimension` (categorical keys), `text` (free text, e.g. ids / notes), `date`, `number` (numeric
 * values that can also be keys, e.g. a year) and `measure` (numeric, aggregated in Values only).
 */
export type PivotFieldType = "dimension" | "measure" | "date" | "number" | "text";

/** Layout areas of the field list (Excel's Filters / Columns / Rows / Values). */
export type PivotFieldArea = "rows" | "columns" | "values" | "filters";

/**
 * One entry of the field catalogue (`spec.fields`), used by the field list and the move helpers
 * (`movePivotField`, …). Metadata only: it does not change the computed model.
 */
export interface PivotFieldSpec {
  readonly field: string;
  readonly label?: string;
  /** Default: inferred from the rows (`inferPivotFields`), else `dimension`. */
  readonly type?: PivotFieldType;
  /** Areas the field may be placed in. Default: `["values"]` for measures, every area otherwise. */
  readonly areas?: readonly PivotFieldArea[];
  /** Aggregate of a measure created by dropping the field into Values (default `sum` for numeric types, else `count`). */
  readonly aggregate?: PivotBuiltInAggregate;
  /** Format of a measure created from this field (not applied to `count`). */
  readonly format?: PivotNumberFormat;
  /** Shown as a tooltip in the field list and to agents (MCP `describe_pivot_spec`). */
  readonly description?: string;
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
  /** Report / slicer / label filters, applied to records before aggregation (totals reflect them). */
  readonly filters?: readonly PivotFilter[];
  /** Fields to return as `model.facets` (distinct values, counts, selection) for slicers / filter menus. */
  readonly facets?: readonly PivotFacetSpec[];
  /**
   * Field catalogue for the field list: labels, types and allowed areas, in display order.
   * Optional (inferred from the rows when absent, see `resolvePivotFields`); never changes the model.
   */
  readonly fields?: readonly PivotFieldSpec[];
  /** Field labels for the field list (`{ "priorYear": "Prior year" }`); win over `fields[].label`. */
  readonly fieldLabels?: Readonly<Record<string, string>>;
  /**
   * Position of the "Σ Values" pseudo-field among the column fields when there are several value
   * measures: `0` puts measures outermost (`Actual › Nov`), the default (= number of column
   * fields) innermost (`Nov › Actual`), like Excel's Σ Values chip in the Columns area.
   */
  readonly valuesIndex?: number;
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
  /** Present on the Top-N "Other" row: how many keys it folds together. */
  readonly otherCount?: number;
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

/** Row dimension as the model reports it; sort / filter keys appear only when active (header indicators). */
export interface PivotModelDimension {
  readonly field: string;
  readonly label: string;
  /** Label sort (only when `asc` / `desc`). */
  readonly sort?: "asc" | "desc";
  readonly sortBy?: PivotSortBySpec;
  readonly topN?: PivotTopNSpec;
  /** A report / label filter targets this field. */
  readonly filtered?: true;
}

/** One active filter, ready to print ("Department = Camp, Packs"). */
export interface PivotActiveFilter {
  readonly field: string;
  /** Field label (dimension / facet label, else the field). */
  readonly label: string;
  /** `items` (include / exclude), `label` (match) or `value` (Top N). */
  readonly kind: "items" | "label" | "value";
  readonly text: string;
}

export interface PivotFacetValue {
  readonly key: string;
  readonly label: string;
  /** Records with this key that pass every filter on *other* fields (cross-filtered, like Excel slicers). */
  readonly count: number;
  /** Records with this key, unfiltered. */
  readonly total: number;
  /** `count > 0`; slicers grey out the rest ("items with no data"). */
  readonly hasData: boolean;
  /** Passes this field's own filter (every value when the field is unfiltered). */
  readonly selected: boolean;
}

export interface PivotFacet {
  readonly field: string;
  readonly label: string;
  /** The field has an active report / label filter. */
  readonly filtered: boolean;
  /** Dimension order for row / column fields, otherwise ascending by key. */
  readonly values: readonly PivotFacetValue[];
}

export interface PivotModel {
  readonly version: typeof PIVOT_SPEC_VERSION;
  readonly id?: string;
  readonly title?: string;
  readonly subtitle?: string;
  readonly layout: "tabular" | "compact";
  readonly rowDimensions: readonly PivotModelDimension[];
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
  /** Active report / label / Top-N filters (present when any are set). */
  readonly filters?: readonly PivotActiveFilter[];
  /** Records before and after filtering (present when any filter or Top N is set). */
  readonly recordCount?: { readonly total: number; readonly matched: number };
  /** Slicer data for `spec.facets` (present when requested). */
  readonly facets?: readonly PivotFacet[];
}
