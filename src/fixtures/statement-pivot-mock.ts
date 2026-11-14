import type { PivotDataRow, PivotSpec } from "../core/pivot/types";

/**
 * A small income statement (P&L) dataset for the financial-statement recipe
 * (`docs/pivot-recipes.md`) and the `planning-statement.*` golden: one record per line, month and
 * department, with **unsigned** amounts and a separate `SIGN` column (1 for income, -1 for costs;
 * some signs arrive as strings, like serialized decimals). `LINE_SORT` carries the report order.
 *
 * Monthly figures (month index k = 0 … 11, Jan … Dec 2026):
 *
 * | Section | Line | Amount (signed) |
 * |---------|------|-----------------|
 * | Gross margin | Revenue | 1000 + 100k (North 60 %, South 40 %) |
 * | Gross margin | COGS | −60 % of revenue (per department) |
 * | Operating expenses | Salaries | −180 (North 100, South 80) |
 * | Operating expenses | Rent | −50 (North) |
 * | Operating expenses | Marketing | −(20 + 5k) (South) |
 */
export interface StatementPivotRow extends PivotDataRow {
  readonly SECTION: string;
  readonly LINE: string;
  readonly LINE_SORT: number;
  readonly DEPT: string;
  /** First day of the month, ISO (`2026-01-01`). */
  readonly PERIOD: string;
  /** Unsigned amount. */
  readonly AMOUNT: number;
  /** `1` / `-1`, or the strings `"1"` / `"-1"`. */
  readonly SIGN: number | string;
}

/** Report lines in statement order (records are emitted in a different order on purpose). */
export const STATEMENT_LINES = [
  { section: "Gross margin", line: "Revenue", sort: 10 },
  { section: "Gross margin", line: "COGS", sort: 20 },
  { section: "Operating expenses", line: "Salaries", sort: 30 },
  { section: "Operating expenses", line: "Rent", sort: 40 },
  { section: "Operating expenses", line: "Marketing", sort: 50 },
] as const;

/**
 * Deterministic P&L records for 2026 (12 months). Records are emitted with operating expenses
 * first, so first-seen order is not the statement order: `LINE_SORT` (via a hidden `min` measure
 * and `sortBy`) has to put Revenue on top.
 */
export function generateStatementPivotRows(): StatementPivotRow[] {
  const rows: StatementPivotRow[] = [];
  const line = (name: string) => STATEMENT_LINES.find((l) => l.line === name)!;
  const push = (name: string, dept: string, period: string, amount: number, sign: number | string) => {
    const l = line(name);
    rows.push({ SECTION: l.section, LINE: l.line, LINE_SORT: l.sort, DEPT: dept, PERIOD: period, AMOUNT: amount, SIGN: sign });
  };
  for (let k = 0; k < 12; k++) {
    const period = `2026-${String(k + 1).padStart(2, "0")}-01`;
    const north = 600 + 60 * k;
    const south = 400 + 40 * k;
    push("Rent", "North", period, 50, -1);
    push("Salaries", "North", period, 100, -1);
    push("Salaries", "South", period, 80, -1);
    push("Marketing", "South", period, 20 + 5 * k, -1);
    push("Revenue", "North", period, north, 1);
    push("Revenue", "South", period, south, "1");
    push("COGS", "North", period, (north * 3) / 5, "-1");
    push("COGS", "South", period, (south * 3) / 5, "-1");
  }
  return rows;
}

/**
 * The financial-statement recipe: SECTION → LINE ordered by `LINE_SORT`, months as columns, signed
 * amounts, a "% of Revenue" measure against the Revenue line across all sections, section subtotal
 * rows labelled with the section name ("Gross margin") and the grand total as "Operating income".
 */
export const statementPivotSpec: PivotSpec = {
  version: 1,
  id: "income-statement",
  title: "Income statement",
  subtitle: "FY 2026 · EUR",
  layout: "compact",
  rows: [
    { field: "SECTION", label: "Section", subtotal: "end", subtotalLabel: "{label}", sortBy: { measure: "ord", direction: "asc" } },
    { field: "LINE", label: "Line", sortBy: { measure: "ord", direction: "asc" } },
  ],
  columns: { field: "PERIOD:month", label: "Month" },
  measures: [
    { id: "amount", label: "Amount", field: "AMOUNT", signField: "SIGN", format: { decimals: 0, negative: "parentheses" } },
    {
      id: "pctRevenue",
      label: "% of Revenue",
      field: "AMOUNT",
      signField: "SIGN",
      showAs: "percentOf",
      showAsBase: { field: "LINE", item: "Revenue", scope: "all" },
      percentFormat: { style: "percent", decimals: 1, negative: "parentheses" },
    },
    { id: "ord", label: "Line order", field: "LINE_SORT", aggregate: "min" },
  ],
  values: ["amount", "pctRevenue"],
  valuesIndex: 0,
  totals: { grandTotalLabel: "Operating income", rowTotal: true, rowTotalLabel: "FY 2026" },
};
