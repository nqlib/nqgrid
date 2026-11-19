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
  /**
   * Divide the displayed value by `1000` (thousands), `1_000_000` (millions) or `1_000_000_000`
   * (billions) before formatting, so a column reads in one unit (`$12,345` → `$12.3` with
   * `decimals: 1`). Display only: aggregation, sorting, heat and XLSX cell values keep the real
   * number (Excel shows it scaled through `#,##0,`). Not with `compact` or `style: "percent"`.
   * Pair with `PivotSpec.units` to print the unit ("EUR thousands").
   */
  readonly scale?: 1000 | 1_000_000 | 1_000_000_000;
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
  /**
   * Column dimensions only (`validatePivotSpec` rejects it on rows): keep keys from `order` even when no
   * record has them (e.g. fiscal months).
   * Date-grouped fields also fill gaps: every period between the first and last key with data
   * (every month / quarter for `month` / `quarter`), nested consistently under date parents.
   */
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
  /**
   * Subtotals of this field's groups (every level but the innermost; ignored there).
   *
   * - Column dimensions: where each group's subtotal column goes — `end` (default, after its
   *   children, like Excel), `start` or `none`. A collapsed group always shows its total column.
   * - Row dimensions: `start` (default: the group row carries the subtotals, Excel's "at top"),
   *   `end` (an extra `subtotal` row after the group's children; the expanded group row is blank)
   *   or `none` (no subtotals while expanded). A collapsed group row always shows its totals.
   */
  readonly subtotal?: "end" | "start" | "none";
  /**
   * Label of this field's subtotal rows (`subtotal: "end"`) and subtotal columns, overriding
   * `totals.subtotalLabel` for this level only; `{label}` is the group label (e.g. `"{label}"` names
   * a P&L section's subtotal row after the section: `Gross margin`).
   */
  readonly subtotalLabel?: string;
  /**
   * Per-group subtotal labels, by group key, overriding `subtotalLabel` for that group only
   * (`{ "Revenue": "Total revenue", "Operating expenses": "Total operating expenses" }`); `{label}` is
   * the group label. Rows and columns, like `subtotalLabel`. Keys compare as case-sensitive strings.
   */
  readonly subtotalLabels?: Readonly<Record<string, string>>;
  /**
   * Row dimensions only: Excel "calculated items" — extra rows of this field computed by a formula over
   * other keys of the same field (siblings under the same parent; at the outermost level, groups of the
   * whole field, e.g. P&L sections), per column and per measure. See `PivotCalculatedItem`.
   */
  readonly calculatedItems?: readonly PivotCalculatedItem[];
  /**
   * Row dimensions only: number format per key of this field (`{ "Gross margin %": { style: "percent" } }`),
   * used instead of the measures' `format` on that key's rows (its group / leaf row and subtotal row, or
   * calculated item) for cells shown as values. `showAs` percentages keep `percentFormat`.
   */
  readonly itemFormats?: Readonly<Record<string, PivotNumberFormat>>;
}

/**
 * A calculated item (Excel's "Calculated Item…", a Power BI visual-calculation row): a row of its
 * dimension whose values are `formula` evaluated over other keys of the same field, per column and per
 * measure, from their aggregated values — `"[Revenue] + [Cost of sales]"` gives Gross margin in every
 * column, also the total column (the formula over the totals, not a sum of formula results).
 *
 * - **References** are keys of the field in brackets (`[Cost of sales]`) or bare names (`Revenue`):
 *   sibling keys under the same parent row (at the outermost level, any key of the field, so a P&L's
 *   section totals), or other calculated items of the same dimension (cascading totals: EBITDA =
 *   `[Gross margin] + [Operating expenses]`). Keys are opaque, case-sensitive strings (also
 *   `__proto__`). A key that is missing under a parent (filtered out, cut by Top N, no data) reads as
 *   no value, and null propagates (`coalesce([Other income], 0)`), like calculated measures. Same safe
 *   grammar, functions and limits as `PivotMeasure.calculate` (`parsePivotCalc`).
 * - **Where it shows:** under every parent where at least one key it reads (directly or through other
 *   items) exists; items reading no key (constants) everywhere. `after` / `before` a key, or
 *   `position` (default `end`), among the siblings; it keeps that anchor whatever `sortBy` / `order` /
 *   Top N do to the data keys, and goes to the end when the anchor is missing.
 * - **Totals:** by default an item is left out of its parent's subtotal and the grand total
 *   (`includeInTotals: false`), so a statement's Gross margin row is not added to Operating income
 *   again. `true` adds its value to every total above it, as Excel does.
 * - **Measures:** a plain measure's item value is the formula over the referenced keys' values of that
 *   measure; a calculated measure is evaluated over the item's values of the measures it references
 *   (Gross margin's margin % = its margin / its revenue). `showAs` applies to the item's values where it
 *   has a base: % of column / row / grand total / parent row / parent column, `percentOf` with
 *   `scope: "all"` and anything along a column field; along a row field the item's cells are empty
 *   (it has no position among the data keys), above the base level the value shows. Never heat,
 *   sorting, Top N, KPIs or facets.
 */
export interface PivotCalculatedItem {
  /** Key of the item's row (its `path` entry, and its name in other items' formulas). Unique per dimension. */
  readonly key: string;
  /** Expression over keys of the field, e.g. `"[Revenue] + [Cost of sales]"` or `"[Gross margin] / [Revenue]"`. */
  readonly formula: string;
  /** Row label (default `key`). */
  readonly label?: string;
  /** Place the item right after this key's rows (its group, children and subtotal row) — a data key or another item. */
  readonly after?: string;
  /** Place the item right before this key's rows. */
  readonly before?: string;
  /** `start` or `end` (default) of the siblings, without `after` / `before`. */
  readonly position?: "start" | "end";
  /** Number format of the item's value cells (e.g. a percent row in a currency statement); wins over `itemFormats`. */
  readonly format?: PivotNumberFormat;
  /** Add the item's values into its parent's subtotal and every total above (Excel). Default false. */
  readonly includeInTotals?: boolean;
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
 * Date grouping of a derived date field: `year`, `quarter` (Q1–Q4, any year), `month` (Jan–Dec,
 * any year), `week` (ISO week), `day`, `yearMonth` (`2026-01`) and `yearQuarter` (`2026-Q1`).
 * Year and quarter keys follow `fiscalYearStartMonth`.
 */
export type PivotDateGroup = "year" | "quarter" | "month" | "week" | "day" | "yearMonth" | "yearQuarter";

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
  /**
   * Derived date field: the record field holding the dates (with `dateGroup`). Names like
   * `orderDate:year` are derived from `orderDate` without an entry; declare one to rename or relabel.
   * Unlike other catalogue properties, the date properties below change the model.
   */
  readonly source?: string;
  /** Derived date field: how `source` is grouped. */
  readonly dateGroup?: PivotDateGroup;
  /**
   * Date fields: first month of the fiscal year (1–12, default 1 = calendar year). Fiscal years are
   * named by the year they end in (`11` → Nov 2025 – Oct 2026 is `FY26`). Set it on the source field
   * to apply it to every grouping of that field.
   */
  readonly fiscalYearStartMonth?: number;
  /**
   * Date fields: fixed offset (minutes, −840…840) applied to instants (epoch ms, `Date`, ISO strings
   * with `Z` / an offset) before taking the calendar day. Default 0 (UTC); never the runtime's zone.
   */
  readonly timeZoneOffsetMinutes?: number;
  /** Date fields: 12 month labels (default `Jan` … `Dec`), e.g. for another language. */
  readonly monthNames?: readonly string[];
  /**
   * Date fields: "Group by…" choices in the field list, also used when the field is dropped into
   * Rows / Columns / Filters. Default: every group when the values parse as dates. `[]` turns it off.
   */
  readonly dateGroups?: readonly PivotDateGroup[];
}

/**
 * `distinctCount` counts distinct non-blank keys of `field` (compared as strings, like dimension
 * keys); group and grand totals count distinct keys of all their records (not the sum of children).
 * `first` / `last` take the first / last record **in input order** that has a value; a group or total
 * takes one record of all of its records (not each account's last value summed), so they are not
 * opening / closing balances (use `{ type: "closingBalance", timeField }`). `avg` averages records, not
 * per-period sums (use `{ type: "averageOverTime", timeField }`).
 */
export type PivotBuiltInAggregate = "sum" | "avg" | "min" | "max" | "count" | "first" | "last" | "distinctCount";

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
  | { readonly type: "custom"; readonly name: string }
  /**
   * Semi-additive balance (Excel / Power BI "last non-blank"): for every **series** in a cell — one
   * combination of the layout's non-time row and column keys, e.g. an account — the sum of its records
   * at the latest `timeField` key the series has in that cell; the series' values are then summed.
   * Q1 of a monthly balance is the March balance, a year total the last month's, and a group adds its
   * accounts' balances (each at its own latest period, so an account without a March record counts
   * with its February value in Q1). `openingBalance` takes the earliest key instead.
   */
  | { readonly type: "closingBalance" | "openingBalance"; readonly timeField: string }
  /**
   * Average over time of the per-period sum (headcount, FTE, average balance): the cell's sum divided
   * by the number of distinct `timeField` keys with a value in the cell — Jan 31, Feb 32, Mar 33 FTE
   * give 32 for Q1, not the average record.
   */
  | { readonly type: "averageOverTime"; readonly timeField: string };

/** Semi-additive aggregate types (they take a `timeField`). */
export type PivotTimeAggregateType = "closingBalance" | "openingBalance" | "averageOverTime";

/**
 * Excel-style "Show values as". Percent results are ratios. `percentOf` and the last six need
 * `showAsBase` (the field, and for `percentOf` / differences the item, they are computed along);
 * see "Show values as" in `docs/pivot-headless.md` for the edge cases.
 */
export type PivotShowAs =
  | "value"
  | "percentOfColumnTotal"
  | "percentOfParentRow"
  | "percentOfParentColumn"
  | "percentOfRowTotal"
  | "percentOfGrandTotal"
  /** Excel "% Of": value / the base item's value (`showAsBase.item` required). */
  | "percentOf"
  | "differenceFrom"
  | "percentDifferenceFrom"
  | "runningTotal"
  | "percentRunningTotal"
  | "rankAscending"
  | "rankDescending";

/** `showAs` kinds that need `showAsBase`. */
export type PivotShowAsWithBase = "percentOf" | "differenceFrom" | "percentDifferenceFrom" | "runningTotal" | "percentRunningTotal" | "rankAscending" | "rankDescending";

/**
 * Base of `percentOf` / `differenceFrom` / `percentDifferenceFrom` / `runningTotal` /
 * `percentRunningTotal` / `rank*`: a row or column field, and for `percentOf` / differences the base
 * item — a key of that field (`item`; required by `percentOf`), or the `previous` (default) / `next`
 * sibling. Running totals and ranks use the field only.
 */
export interface PivotShowAsBase {
  readonly field: string;
  /** A key of `field` (e.g. `"2025"`); wins over `position`. */
  readonly item?: string;
  /** Default `previous`. */
  readonly position?: "previous" | "next";
  /**
   * Where the base `item` is looked up (`percentOf` / differences with an `item` only):
   *
   * - `parent` (default, Excel): among the cell's siblings under the same parent — rows of other
   *   parents, and rows above the base field (groups, grand total), are empty.
   * - `all`: the aggregate of every record whose `field` key is `item`, in the cell's column (after
   *   filters), whatever the row's parent — so every row, including group, subtotal and grand-total
   *   rows, compares with the same base (a P&L's "% of Revenue"). `field` must be a row field.
   */
  readonly scope?: "parent" | "all";
}

export interface PivotMeasure {
  readonly id: string;
  /** Source field. Required except for `count`, `ratio`, `custom` and calculated measures. */
  readonly field?: string;
  /**
   * Calculated measure (Excel's calculated field): an expression over other measure ids, e.g.
   * `actual / plan - 1` or `[prior year] * 1.05`, evaluated per cell over the referenced measures'
   * aggregated values (so totals are `sum(actual) / sum(plan) - 1`, not a sum of ratios). Referenced
   * measures are read **before** their `showAs`, so referencing a measure whose `showAs` is not
   * `value` is rejected by `validatePivotSpec`: put the `showAs` on the calculated measure instead (a
   * `groupShowAs` alone is fine: group rows read the group's aggregate).
   * Excludes `field` / `aggregate`. Grammar, functions and null rules: `parsePivotCalc` / `compilePivotCalc`.
   */
  readonly calculate?: string;
  readonly label?: string;
  /** Default `sum`. */
  readonly aggregate?: PivotAggregate;
  /**
   * Record field holding a multiplier (normally `1` / `-1`) applied to each record's value before
   * aggregation, e.g. a P&L sign column on unsigned amounts. Numbers or numeric strings (`"-1"`);
   * a missing or non-numeric sign counts as `1`. `sum` / `avg` / `min` / `max` / `first` / `last` and
   * the semi-additive aggregates sign the value, `weightedAvg` the value (not the weight), `ratio` the numerator only. Not
   * allowed with `count`, `distinctCount`, `custom` or `calculate`.
   */
  readonly signField?: string;
  /**
   * Measure-level filter (DAX `CALCULATE`, Excel's `SUMIFS`): only records that pass it are aggregated
   * by **this** measure. One filter or a list (ANDed), same shape and rules as `PivotSpec.filters`, on
   * any field, including derived date fields (`PERIOD:year`). Rows, columns and totals still come from
   * every record that passes the report filters, so a long-format table (`SCENARIO` = Actual / Budget)
   * can show `actual` and `budget` side by side:
   * `{ id: "actual", field: "AMOUNT", filter: { field: "SCENARIO", include: ["Actual"] } }`.
   * A cell whose records all fail the filter is empty. Not allowed with `calculate` (filter the
   * measures it references). Drill-through with this `measureId` lists only the records it counted.
   */
  readonly filter?: PivotFilter | readonly PivotFilter[];
  /** Format for aggregated values. */
  readonly format?: PivotNumberFormat;
  /** Format for `showAs` percentages (default `{ style: "percent" }`). */
  readonly percentFormat?: PivotNumberFormat;
  /** Applied to leaf rows (default `value`). */
  readonly showAs?: PivotShowAs;
  /** Applied to group and grand-total rows (default: `showAs`). */
  readonly groupShowAs?: PivotShowAs;
  /** Field / item the `differenceFrom`, `runningTotal` and `rank*` kinds of `showAs` / `groupShowAs` use. */
  readonly showAsBase?: PivotShowAsBase;
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
  /**
   * `sequential` (default): low → high over `0 … levels-1`. `diverging`: below `midpoint` → levels
   * under the middle one, above it → levels over it, at it → the middle level (`floor(levels / 2)`);
   * use an odd `levels` for a symmetric ramp. Without `domain`, both sides share the larger distance
   * from the midpoint, so equal distances get equal levels.
   */
  readonly scale?: PivotHeatScale;
  /** Diverging only: the neutral value (default 0). */
  readonly midpoint?: number;
}

/** Color ramp of a heat spec (see `PivotHeatSpec.scale`). */
export type PivotHeatScale = "sequential" | "diverging";

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
  /**
   * Append the grand total column(s), one per value measure (default false). With several column
   * fields this is the total across every column group.
   */
  readonly rowTotal?: boolean;
  /** Default `Total`. */
  readonly rowTotalLabel?: string;
  /**
   * Label of column subtotals and of `subtotal: "end"` rows; `{label}` is the group label
   * (default `{label} Total`). A dimension's own `subtotalLabel` wins for its level.
   */
  readonly subtotalLabel?: string;
}

export interface PivotSpec {
  readonly version: typeof PIVOT_SPEC_VERSION;
  readonly id?: string;
  readonly title?: string;
  readonly subtitle?: string;
  /**
   * Unit note printed verbatim under the title of static HTML / PDF reports and in the XLSX print
   * header, e.g. `"EUR thousands"` or `"($ in thousands)"`. Text only: scale values with
   * `format.scale`.
   */
  readonly units?: string;
  /** Row hierarchy, outermost first. Every level but the last becomes a collapsible group. */
  readonly rows: readonly PivotDimension[];
  /**
   * Column dimension (e.g. month), or column hierarchy outermost first (e.g. Year → Quarter →
   * Month). A single object and a one-element array are equivalent.
   */
  readonly columns?: PivotDimension | readonly PivotDimension[];
  /** All measures referenced anywhere (grid values, KPIs, charts). */
  readonly measures: readonly PivotMeasure[];
  /** Measure ids shown as grid columns (default: all measures). */
  readonly values?: readonly string[];
  readonly totals?: PivotTotalsSpec;
  /** `all` (default), `none`, or the key paths of expanded groups, e.g. `[["Camp"]]`. */
  readonly expanded?: "all" | "none" | readonly (readonly string[])[];
  /**
   * Column groups (every column level but the innermost): `all` (default), `none`, or the key paths
   * of expanded groups, e.g. `[["2026"]]`. A collapsed group shows only its total column.
   */
  readonly columnsExpanded?: "all" | "none" | readonly (readonly string[])[];
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
  /**
   * Column-dimension key; `null` for row-total columns or when there is no column dimension. With
   * several column fields, the key path joined by `/` (each key URI-encoded, e.g. `2026/Q1`); a
   * subtotal or collapsed group carries its group's path (`2026`).
   */
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
  /** Several column fields: key path of the leaf, subtotal or collapsed group (absent for the grand total). */
  readonly columnPath?: readonly string[];
  /** Total of a column group: its subtotal column, or the group itself when collapsed. */
  readonly subtotal?: true;
  /** The group is collapsed (`columnsExpanded`), so this total column stands for all of it. */
  readonly collapsed?: true;
}

export interface PivotHeaderCell {
  readonly label: string;
  readonly colSpan: number;
  /** Header rows covered (present when > 1, e.g. a subtotal under several column levels). */
  readonly rowSpan?: number;
  readonly columnKey?: string | null;
  readonly measureId?: string;
  /** Several column fields: key path of the group / leaf this cell names. */
  readonly columnPath?: readonly string[];
  /** Several column fields: column-field index of this cell (absent for measure and grand-total cells). */
  readonly columnLevel?: number;
  /** Collapsible column group: `true` over its expanded children, `false` on its collapsed total column. */
  readonly expanded?: boolean;
  /** Subtotal column of a column group. */
  readonly subtotal?: true;
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
  /**
   * `subtotal` — the totals of an expanded group whose field has `subtotal: "end"`, after its
   * children (same `depth` / `path` as the group, label `{label} Total`).
   * `calculated` — a calculated item (`PivotDimension.calculatedItems`): `path` ends with the item's
   * key, never expandable, `sourceRowCount` 0, `formula` set.
   */
  readonly kind: "group" | "leaf" | "grandTotal" | "subtotal" | "calculated";
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
  /**
   * Present on an expanded group row whose subtotals are shown elsewhere (`end`) or not at all
   * (`none`): its cells are blank.
   */
  readonly subtotal?: "end" | "none";
  /** Calculated item rows: the item's formula. */
  readonly formula?: string;
  /**
   * Number format of this row's value cells shown as values (calculated item `format`, or the
   * dimension's `itemFormats` for the row's key), instead of the column's `format`; absent otherwise.
   */
  readonly format?: PivotNumberFormat;
  /** Excel format of `format` (present with it). */
  readonly excelNumFmt?: string;
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
  /** One point per leaf column (and per collapsed column group), in column order. Subtotals are left out. */
  readonly points: readonly PivotHeaderSeriesPoint[];
  /** Max of point values (or stacked breakdown totals) for scaling, `null` if no data. */
  readonly max: number | null;
  /** Several column fields: one point per outermost column group (e.g. per year), with its total. */
  readonly groups?: readonly PivotHeaderSeriesPoint[];
  /** Max of `groups` values, `null` if no data. */
  readonly groupMax?: number | null;
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
  /** `spec.units`, when set. */
  readonly units?: string;
  readonly layout: "tabular" | "compact";
  readonly rowDimensions: readonly PivotModelDimension[];
  /** The column field (with several, the outermost; see `columnDimensions`). */
  readonly columnDimension: { readonly field: string; readonly label: string } | null;
  /** Several column fields: all of them, outermost first. */
  readonly columnDimensions?: readonly { readonly field: string; readonly label: string }[];
  /**
   * Column keys in display order. With several column fields: one per leaf column and collapsed
   * group (`key` as in `PivotValueColumn.columnKey`, `label` the labels joined by spaces).
   */
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
    /** Present when the spec asks for a `diverging` ramp. */
    readonly scale?: "diverging";
    /** Diverging only: the neutral value. */
    readonly midpoint?: number;
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
  /**
   * Non-fatal data / spec problems that leave cells empty or totals short (present when any):
   * unparsable amounts, fields no record has, invalid dates, keys of mixed types, filter items and
   * `showAsBase.item`s that match nothing. Bounded: one entry per field and problem, ≤ 5 samples each.
   */
  readonly diagnostics?: readonly PivotDiagnostic[];
}

/** Kinds of `PivotDiagnostic`. */
export type PivotDiagnosticCode =
  /** No record has the field (a typo?): its dimension is all `(blank)`, its measure empty. */
  | "missingField"
  /** Non-blank measure values that are not numbers or plain numeric strings (`"1,234.50"`, `"(500)"`, `"$12"`, `"0x10"`): left out of every total. */
  | "unparsedNumbers"
  /** Non-blank values of a date-grouped field that are not ISO-8601 dates or epoch ms: grouped as `(blank)`. */
  | "invalidDates"
  /** A key field mixes value types (`2024` and `"2024"` are one key, `1` and `"1.0"` two). */
  | "mixedKeyTypes"
  /** `filters[].include` / `exclude` items that no record has (keys compare as case-sensitive strings). */
  | "filterItemsNotFound"
  /** A `showAsBase.item` that is not a key of its field: the measure's cells are empty. */
  | "baseItemNotFound"
  /**
   * Keys named by `calculatedItems` (formula references, `after` / `before`), `subtotalLabels` or
   * `itemFormats` that are neither values of the field nor calculated items: references read as no
   * value, anchored items go to the end, labels / formats apply to nothing.
   */
  | "itemKeyNotFound"
  /** A calculated item's `key` is also a value of its field: formulas and anchors naming it mean the calculated item. */
  | "itemKeyConflict";

/** One entry of `PivotModel.diagnostics` (plain JSON; `message` is ready to show to a user or an agent). */
export interface PivotDiagnostic {
  readonly code: PivotDiagnosticCode;
  /** Record field concerned (for derived date fields, the source field holding the dates). */
  readonly field: string;
  /** Spec path that reads the field first, e.g. `measures[0].field` or `filters[1].include`. */
  readonly path: string;
  /** Records affected (`missingField`: all of them). */
  readonly count?: number;
  /** Up to 5 examples: input record index (0-based) and the value as JSON-ish text. */
  readonly samples?: readonly { readonly row: number; readonly value: string }[];
  /** `mixedKeyTypes`: JS types seen, first one first. */
  readonly types?: readonly string[];
  /** `filterItemsNotFound` / `baseItemNotFound` / `itemKeyNotFound` / `itemKeyConflict`: the keys concerned (≤ 10). */
  readonly items?: readonly string[];
  readonly message: string;
}
