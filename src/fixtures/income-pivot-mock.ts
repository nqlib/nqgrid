import type { PivotDataRow, PivotSpec } from "../core/pivot/types";

/**
 * An income statement with calculated items (`docs/pivot-recipes.md`, the `planning-income.*` golden
 * and the playground's `?pivot=income`): one record per line and month of 2026, amounts **already
 * signed** (costs negative), `LINE_SORT` carrying the report order.
 *
 * Monthly figures (month index k = 0 … 11, Jan … Dec 2026):
 *
 * | Section | Line | Amount |
 * |---------|------|--------|
 * | Revenue | Product revenue | 800 + 20k |
 * | Revenue | Services revenue | 200 + 10k |
 * | Cost of sales | COGS | −(400 + 15k) |
 * | Operating expenses | Salaries | −250 |
 * | Operating expenses | Rent | −50 |
 * | Depreciation | Equipment depreciation | −40 |
 */
export interface IncomePivotRow extends PivotDataRow {
  readonly SECTION: string;
  readonly LINE: string;
  readonly LINE_SORT: number;
  /** First day of the month, ISO (`2026-01-01`). */
  readonly PERIOD: string;
  /** Signed amount (costs negative). */
  readonly AMOUNT: number;
}

/** Report lines in statement order (records are emitted in a different order on purpose). */
export const INCOME_LINES = [
  { section: "Revenue", line: "Product revenue", sort: 10 },
  { section: "Revenue", line: "Services revenue", sort: 20 },
  { section: "Cost of sales", line: "COGS", sort: 30 },
  { section: "Operating expenses", line: "Salaries", sort: 40 },
  { section: "Operating expenses", line: "Rent", sort: 50 },
  { section: "Depreciation", line: "Equipment depreciation", sort: 60 },
] as const;

/** Deterministic signed P&L records for 2026 (72 records; costs first, so first-seen order is not the statement order). */
export function generateIncomePivotRows(): IncomePivotRow[] {
  const rows: IncomePivotRow[] = [];
  const push = (name: string, period: string, amount: number) => {
    const l = INCOME_LINES.find((x) => x.line === name)!;
    rows.push({ SECTION: l.section, LINE: l.line, LINE_SORT: l.sort, PERIOD: period, AMOUNT: amount });
  };
  for (let k = 0; k < 12; k++) {
    const period = `2026-${String(k + 1).padStart(2, "0")}-01`;
    push("Equipment depreciation", period, -40);
    push("Rent", period, -50);
    push("Salaries", period, -250);
    push("COGS", period, -(400 + 15 * k));
    push("Services revenue", period, 200 + 10 * k);
    push("Product revenue", period, 800 + 20 * k);
  }
  return rows;
}

/**
 * Income statement with calculated items on SECTION: Gross margin (`[Revenue] + [Cost of sales]`) and
 * Gross margin % (a percent row) after Cost of sales, EBITDA (a cascading total over an item and a
 * section) after Operating expenses; per-section subtotal labels; Operating income as the grand total.
 */
export const incomePivotSpec: PivotSpec = {
  version: 1,
  id: "income-statement-items",
  title: "Income statement",
  subtitle: "FY 2026 · EUR",
  layout: "compact",
  rows: [
    {
      field: "SECTION",
      label: "Section",
      subtotal: "end",
      subtotalLabels: {
        Revenue: "Total revenue",
        "Cost of sales": "Total cost of sales",
        "Operating expenses": "Total operating expenses",
        Depreciation: "Total depreciation",
      },
      sortBy: { measure: "ord", direction: "asc" },
      calculatedItems: [
        { key: "Gross margin", formula: "[Revenue] + [Cost of sales]", after: "Cost of sales" },
        { key: "Gross margin %", formula: "[Gross margin] / [Revenue]", after: "Gross margin", format: { style: "percent", decimals: 1 } },
        { key: "EBITDA", formula: "[Gross margin] + [Operating expenses]", after: "Operating expenses" },
      ],
    },
    { field: "LINE", label: "Line", sortBy: { measure: "ord", direction: "asc" } },
  ],
  columns: { field: "PERIOD:quarter", label: "Quarter" },
  measures: [
    { id: "amount", label: "Amount", field: "AMOUNT", format: { decimals: 0, negative: "parentheses" } },
    { id: "ord", label: "Line order", field: "LINE_SORT", aggregate: "min" },
  ],
  values: ["amount"],
  totals: { grandTotalLabel: "Operating income", rowTotal: true, rowTotalLabel: "FY 2026" },
};
