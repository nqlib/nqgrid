import type { PivotDataRow, PivotSpec } from "../core/pivot/types";

/**
 * A long-format FP&A fact table (how GL / EPM extracts arrive) for the planning recipes in
 * `docs/pivot-recipes.md` and the `planning-fpa.*` golden: one record per scenario, line and month,
 * with the scenario as a column (`SCENARIO` = `Actual` / `Budget`), **unsigned** amounts and a
 * `SIGN` column, and three kinds of lines in one table (`KIND`):
 *
 * - `flow` — P&L lines (Revenue, Cost of sales, Operating expenses), additive over time;
 * - `balance` — month-end balances (Cash, Receivables, Payables), semi-additive: a quarter is its
 *   last month, never the sum of its months;
 * - `headcount` — FTE per month (Engineering, Sales), averaged over time.
 *
 * Months: Jan – Jun 2026 for both scenarios, plus Jan – Jun 2025 actuals (prior year). Month index
 * m = 1 … 6. Records are emitted latest month first, so input order is not time order.
 *
 * | Kind | Line | Budget 2026 | Actual 2026 | Actual 2025 |
 * |------|------|-------------|-------------|-------------|
 * | flow | Product revenue | 100,000 + 1,000 (m − 1) | budget × 1.05 | 90,000 + 1,000 (m − 1) |
 * | flow | Services revenue | 40,000 | 38,000 | 35,000 |
 * | flow | COGS (sign −1) | 45 % of product budget | 47 % of product actual | 45 % of product |
 * | flow | Salaries (−1) | 50,000 | 51,000 | 46,000 |
 * | flow | Rent (−1) | 10,000 | 10,000 | 9,500 |
 * | balance | Cash | 205,000 + 10,000 m | 200,000 + 10,000 m | |
 * | balance | Receivables | 80,000 | 80,000 | |
 * | balance | Payables (−1) | 60,000 + 2,000 m | 60,000 + 2,000 m | |
 * | headcount | Engineering | 32 | 30 + m | |
 * | headcount | Sales | 12 | 12 | |
 */
export interface FpaPivotRow extends PivotDataRow {
  readonly KIND: "flow" | "balance" | "headcount";
  readonly SECTION: string;
  readonly LINE: string;
  readonly LINE_SORT: number;
  readonly SCENARIO: "Actual" | "Budget";
  /** First day of the month, ISO (`2026-01-01`); balances are month-end values. */
  readonly PERIOD: string;
  /** Unsigned amount (FTE for headcount lines). */
  readonly AMOUNT: number;
  readonly SIGN: number;
}

/** Report lines in statement order. */
export const FPA_LINES = [
  { kind: "flow", section: "Revenue", line: "Product revenue", sort: 10, sign: 1 },
  { kind: "flow", section: "Revenue", line: "Services revenue", sort: 20, sign: 1 },
  { kind: "flow", section: "Cost of sales", line: "COGS", sort: 30, sign: -1 },
  { kind: "flow", section: "Operating expenses", line: "Salaries", sort: 40, sign: -1 },
  { kind: "flow", section: "Operating expenses", line: "Rent", sort: 50, sign: -1 },
  { kind: "balance", section: "Assets", line: "Cash", sort: 110, sign: 1 },
  { kind: "balance", section: "Assets", line: "Receivables", sort: 120, sign: 1 },
  { kind: "balance", section: "Liabilities", line: "Payables", sort: 130, sign: -1 },
  { kind: "headcount", section: "Headcount", line: "Engineering", sort: 210, sign: 1 },
  { kind: "headcount", section: "Headcount", line: "Sales", sort: 220, sign: 1 },
] as const;

function amountOf(line: string, scenario: "Actual" | "Budget", year: number, m: number): number | null {
  const productBudget = 100_000 + 1_000 * (m - 1);
  const productActual = Math.round(productBudget * 1.05);
  const product2025 = 90_000 + 1_000 * (m - 1);
  if (year === 2025) {
    if (scenario === "Budget") return null;
    const flows: Record<string, number> = {
      "Product revenue": product2025,
      "Services revenue": 35_000,
      COGS: Math.round(product2025 * 0.45),
      Salaries: 46_000,
      Rent: 9_500,
    };
    return flows[line] ?? null;
  }
  const actual = scenario === "Actual";
  switch (line) {
    case "Product revenue":
      return actual ? productActual : productBudget;
    case "Services revenue":
      return actual ? 38_000 : 40_000;
    case "COGS":
      return actual ? Math.round(productActual * 0.47) : Math.round(productBudget * 0.45);
    case "Salaries":
      return actual ? 51_000 : 50_000;
    case "Rent":
      return 10_000;
    case "Cash":
      return (actual ? 200_000 : 205_000) + 10_000 * m;
    case "Receivables":
      return 80_000;
    case "Payables":
      return 60_000 + 2_000 * m;
    case "Engineering":
      return actual ? 30 + m : 32;
    case "Sales":
      return 12;
    default:
      return null;
  }
}

/** Deterministic records (see the table above), latest month first. */
export function generateFpaPivotRows(): FpaPivotRow[] {
  const rows: FpaPivotRow[] = [];
  for (const year of [2026, 2025]) {
    for (let m = 6; m >= 1; m--) {
      for (const scenario of ["Actual", "Budget"] as const) {
        for (const l of FPA_LINES) {
          const amount = amountOf(l.line, scenario, year, m);
          if (amount === null) continue;
          rows.push({
            KIND: l.kind,
            SECTION: l.section,
            LINE: l.line,
            LINE_SORT: l.sort,
            SCENARIO: scenario,
            PERIOD: `${year}-${String(m).padStart(2, "0")}-01`,
            AMOUNT: amount,
            SIGN: l.sign,
          });
        }
      }
    }
  }
  return rows;
}

const usdK = { style: "currency", currency: "USD", scale: 1000, decimals: 1, negative: "parentheses" } as const;
const actual2026 = [
  { field: "SCENARIO", include: ["Actual"] },
  { field: "PERIOD:year", include: ["2026"] },
];

/**
 * Budget vs actual on the long-format table, by quarter (H1 2026): measure filters pick the scenario
 * and the year, so Actual, Budget, the variance, Var % (`abs` of the budget, so a cost overrun is
 * negative), YTD actual (running total along the quarter) and prior-year actual (a measure filter
 * on 2025) sit side by side. Amounts in USD thousands (`format.scale` + `units`).
 */
export const fpaPivotSpec: PivotSpec = {
  version: 1,
  id: "fpa-budget-vs-actual",
  title: "Management P&L: budget vs actual",
  subtitle: "H1 2026 by quarter",
  units: "USD thousands",
  layout: "compact",
  rows: [
    { field: "SECTION", label: "Section", subtotal: "end", subtotalLabel: "{label}", sortBy: { measure: "ord", direction: "asc" } },
    { field: "LINE", label: "Line", sortBy: { measure: "ord", direction: "asc" } },
  ],
  columns: { field: "PERIOD:quarter", label: "Quarter" },
  filters: [{ field: "KIND", include: ["flow"], label: "Kind" }],
  measures: [
    { id: "actual", label: "Actual", field: "AMOUNT", signField: "SIGN", filter: actual2026, format: usdK },
    { id: "budget", label: "Budget", field: "AMOUNT", signField: "SIGN", filter: [{ field: "SCENARIO", include: ["Budget"] }, { field: "PERIOD:year", include: ["2026"] }], format: usdK },
    { id: "variance", label: "Var", calculate: "actual - budget", format: usdK },
    { id: "variancePct", label: "Var %", calculate: "(actual - budget) / abs(budget)", format: { style: "percent", decimals: 1, negative: "parentheses" } },
    { id: "ytd", label: "YTD actual", field: "AMOUNT", signField: "SIGN", filter: actual2026, format: usdK, showAs: "runningTotal", groupShowAs: "runningTotal", showAsBase: { field: "PERIOD:quarter" } },
    { id: "priorYear", label: "PY actual", field: "AMOUNT", signField: "SIGN", filter: [{ field: "SCENARIO", include: ["Actual"] }, { field: "PERIOD:year", include: ["2025"] }], format: usdK },
    { id: "ord", label: "Line order", field: "LINE_SORT", aggregate: "min" },
  ],
  values: ["actual", "budget", "variance", "variancePct", "ytd", "priorYear"],
  totals: { grandTotalLabel: "Operating income", rowTotal: true, rowTotalLabel: "H1" },
};

/**
 * Balance sheet and headcount on the same table: month-end balances as `closingBalance` (Q1 = March,
 * H1 = June; liabilities signed −1, so the total is net assets) and FTE as `averageOverTime`
 * (Engineering Q1 = (31 + 32 + 33) / 3 = 32), both actual 2026 through measure filters. Q1 is
 * collapsed, so its total column stands for the quarter.
 */
export const fpaBalancePivotSpec: PivotSpec = {
  version: 1,
  id: "fpa-balance-headcount",
  title: "Balance sheet and headcount",
  subtitle: "Actual 2026, month-end balances and average FTE",
  units: "USD thousands · FTE",
  layout: "compact",
  rows: [
    { field: "SECTION", label: "Section", sortBy: { measure: "ord", direction: "asc" } },
    { field: "LINE", label: "Line", sortBy: { measure: "ord", direction: "asc" } },
  ],
  columns: [
    { field: "PERIOD:yearQuarter", label: "Quarter" },
    { field: "PERIOD:month", label: "Month" },
  ],
  columnsExpanded: [["2026-Q2"]],
  filters: [{ field: "KIND", exclude: ["flow"], label: "Kind" }],
  measures: [
    {
      id: "balance",
      label: "Balance",
      field: "AMOUNT",
      signField: "SIGN",
      aggregate: { type: "closingBalance", timeField: "PERIOD" },
      filter: [...actual2026, { field: "KIND", include: ["balance"] }],
      format: usdK,
    },
    {
      id: "fte",
      label: "FTE",
      field: "AMOUNT",
      aggregate: { type: "averageOverTime", timeField: "PERIOD" },
      filter: [...actual2026, { field: "KIND", include: ["headcount"] }],
      format: { decimals: 1 },
    },
    { id: "ord", label: "Line order", field: "LINE_SORT", aggregate: "min" },
  ],
  values: ["balance", "fte"],
  totals: { grandTotalLabel: "Net assets · total FTE", rowTotal: true, rowTotalLabel: "H1 2026" },
};
