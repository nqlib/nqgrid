import { Badge } from "@nqlib/nqui";
import type { PivotFilter, PivotSpec } from "@nqlib/nqgrid/core";
import { fpaBalancePivotSpec, fpaPivotSpec, generateFpaPivotRows } from "@nqlib/nqgrid/fixtures";
import { PivotCalculatedItemForm } from "@nqlib/nqgrid/pivot";
import { DOCS } from "../docs";
import { ToolChoice, ToolGroup, ToolPopover, ToolRow, ToolSwitch } from "../tool-controls";
import type { PivotExample, PivotExampleToolsProps } from "../types";
import { ALL_PIVOT_PANELS } from "../types";

const ACTUAL_2026: readonly PivotFilter[] = [
  { field: "SCENARIO", include: ["Actual"] },
  { field: "PERIOD:year", include: ["2026"] },
];
const usdK = { style: "currency", currency: "USD", scale: 1000, decimals: 1, negative: "parentheses" } as const;

/**
 * The income statement on the same long-format ledger as budget vs actual: amounts signed by SIGN,
 * Gross margin and EBITDA as calculated items on Section, per-section subtotal labels, % of Revenue
 * against the Revenue section on every row, and Operating income as the grand total.
 */
export const financeIncomeSpec: PivotSpec = {
  version: 1,
  id: "finance-income-statement",
  title: "Income statement",
  subtitle: "Actual 2026 by quarter",
  units: "USD thousands",
  layout: "compact",
  rows: [
    {
      field: "SECTION",
      label: "Section",
      subtotal: "end",
      subtotalLabels: { Revenue: "Total revenue", "Cost of sales": "Total cost of sales", "Operating expenses": "Total operating expenses" },
      sortBy: { measure: "ord", direction: "asc" },
      calculatedItems: [
        { key: "Gross margin", formula: "[Revenue] + [Cost of sales]", after: "Cost of sales" },
        { key: "EBITDA", formula: "[Gross margin] + [Operating expenses]", after: "Operating expenses" },
      ],
    },
    { field: "LINE", label: "Line", sortBy: { measure: "ord", direction: "asc" } },
  ],
  columns: { field: "PERIOD:quarter", label: "Quarter" },
  filters: [{ field: "KIND", include: ["flow"], label: "Kind" }],
  measures: [
    { id: "amount", label: "Amount", field: "AMOUNT", signField: "SIGN", filter: [...ACTUAL_2026], format: usdK },
    {
      id: "pctRevenue",
      label: "% rev",
      field: "AMOUNT",
      signField: "SIGN",
      filter: [...ACTUAL_2026],
      showAs: "percentOf",
      showAsBase: { field: "SECTION", item: "Revenue", scope: "all" },
      percentFormat: { style: "percent", decimals: 1, negative: "parentheses" },
    },
    { id: "ord", label: "Line order", field: "LINE_SORT", aggregate: "min" },
  ],
  values: ["amount", "pctRevenue"],
  totals: { grandTotalLabel: "Operating income", rowTotal: true, rowTotalLabel: "H1" },
  facets: ["SECTION", "LINE"],
};

type Scale = "1" | "1000" | "1000000";
const UNITS: Record<Scale, string> = { "1": "USD", "1000": "USD thousands", "1000000": "USD millions" };

/** `format.scale` on every currency measure, and the matching unit note. */
export function withCurrencyScale(spec: PivotSpec, scale: Scale): PivotSpec {
  return {
    ...spec,
    units: UNITS[scale],
    measures: spec.measures.map((m) => {
      if (m.format?.style !== "currency") return m;
      const { scale: _old, ...format } = m.format;
      return { ...m, format: scale === "1" ? { ...format, decimals: 0 } : { ...format, scale: Number(scale) as 1000 | 1000000, decimals: 1 } };
    }),
  };
}

const filterText = (f: PivotFilter) => {
  const field = f.field.replace(/:year$/, " year");
  if (f.include) return `${field} = ${f.include.join(", ")}`;
  if (f.exclude) return `${field} ≠ ${f.exclude.join(", ")}`;
  return field;
};

function ScaleChoice({ grid }: PivotExampleToolsProps) {
  const scale = String(grid.spec.measures.find((m) => m.format?.style === "currency")?.format?.scale ?? 1) as Scale;
  return (
    <ToolChoice<Scale>
      label="Amounts in"
      value={scale}
      options={[
        { value: "1", label: "USD" },
        { value: "1000", label: "Thousands" },
        { value: "1000000", label: "Millions" },
      ]}
      onValueChange={(s) => grid.setSpec((prev) => withCurrencyScale(prev, s))}
    />
  );
}

function BudgetTools(props: PivotExampleToolsProps) {
  const { spec } = props.grid;
  const filtered = spec.measures.filter((m) => m.filter && (spec.values ?? []).includes(m.id));
  return (
    <ToolRow className="gap-x-8">
      <ScaleChoice {...props} />
      <ToolGroup label="Measure filters">
        {filtered.map((m) => (
          <Badge key={m.id} variant="secondary" className="font-normal">
            <span className="font-medium text-foreground">{m.label}</span>
            <span className="text-muted-foreground">{(Array.isArray(m.filter) ? m.filter : [m.filter as PivotFilter]).map(filterText).join(" · ")}</span>
          </Badge>
        ))}
      </ToolGroup>
    </ToolRow>
  );
}

const ITEM_FIELD = "SECTION";
const SIGNED = ["amount", "pctRevenue"] as const;

function IncomeTools(props: PivotExampleToolsProps) {
  const { grid } = props;
  const { spec } = grid;
  const items = spec.rows.find((d) => d.field === ITEM_FIELD)?.calculatedItems ?? [];
  const keys = grid.facet(ITEM_FIELD).values.map((v) => ({ key: v.key, label: v.label }));
  const signed = spec.measures.some((m) => m.id === "amount" && m.signField === "SIGN");
  return (
    <ToolRow className="gap-x-8">
      <ToolGroup label="Calculated items">
        {items.map((item) => (
          <ToolPopover key={item.key} label={item.label ?? item.key} ariaLabel={`Edit calculated item ${item.label ?? item.key}`}>
            {(close) => (
              <PivotCalculatedItemForm
                spec={spec}
                field={ITEM_FIELD}
                itemKey={item.key}
                keys={keys}
                onSubmit={(next) => (grid.setSpec(next), close())}
                onCancel={close}
                onRemove={() => (grid.removeCalculatedItem(ITEM_FIELD, item.key), close())}
              />
            )}
          </ToolPopover>
        ))}
        <ToolPopover label="Add item…" variant="ghost">
          {(close) => (
            <PivotCalculatedItemForm spec={spec} field={ITEM_FIELD} keys={keys} onSubmit={(next) => (grid.setSpec(next), close())} onCancel={close} />
          )}
        </ToolPopover>
      </ToolGroup>
      <ToolSwitch
        label="Sign amounts with SIGN"
        checked={signed}
        onCheckedChange={(on) => SIGNED.forEach((id) => grid.setMeasureSignField(id, on ? "SIGN" : null))}
      />
      <ScaleChoice {...props} />
    </ToolRow>
  );
}

type BalanceKind = "closingBalance" | "openingBalance";
const Q1 = ["2026-Q1"] as const;

function BalanceTools({ grid }: PivotExampleToolsProps) {
  const { spec } = grid;
  const aggregate = spec.measures.find((m) => m.id === "balance")?.aggregate;
  const kind: BalanceKind = typeof aggregate === "object" && aggregate.type === "openingBalance" ? "openingBalance" : "closingBalance";
  const expanded = spec.columnsExpanded;
  const q1Open = expanded === "all" || (Array.isArray(expanded) && expanded.some((p) => p.join() === Q1.join()));
  return (
    <ToolRow className="gap-x-8">
      <ToolChoice<BalanceKind>
        label="Balance"
        value={kind}
        options={[
          { value: "closingBalance", label: "Closing" },
          { value: "openingBalance", label: "Opening" },
        ]}
        onValueChange={(type) => grid.setMeasureAggregate("balance", { type, timeField: "PERIOD" })}
      />
      <ToolSwitch label="Expand Q1 into months" checked={q1Open} onCheckedChange={() => grid.toggleColumnGroup(Q1)} />
    </ToolRow>
  );
}

function FinanceTools(props: PivotExampleToolsProps) {
  if (props.view.id === "income") return <IncomeTools {...props} />;
  if (props.view.id === "balance") return <BalanceTools {...props} />;
  return <BudgetTools {...props} />;
}

export const financeExample: PivotExample = {
  id: "finance",
  title: "Finance reports",
  blurb:
    "One long-format ledger (flows, balances and headcount, Actual and Budget, two years) read three ways. Each report is a spec over the same rows.",
  views: [
    {
      id: "finance",
      label: "Budget vs actual",
      spec: { ...fpaPivotSpec, facets: ["SECTION", "LINE"] },
      rows: generateFpaPivotRows,
      tryThis: [
        "Switch “Amounts in” to Millions: only the display rescales (Export → request still holds the raw values).",
        "Double-click a Budget cell: drill-through lists only budget records, because the measure filter applies.",
        "Collapse Revenue: Var and Var % are recomputed on the subtotal, not summed.",
      ],
      note: "Actual, Budget and PY are measure filters on SCENARIO and year · Var % = (actual − budget) / |budget|.",
    },
    {
      id: "income",
      label: "Income statement",
      spec: financeIncomeSpec,
      rows: generateFpaPivotRows,
      tryThis: [
        "Open EBITDA: its formula reads another item, [Gross margin] + [Operating expenses].",
        "Add an item “Opex ratio” = [Operating expenses] / [Revenue] after EBITDA, formatted as a percent.",
        "Turn off “Sign amounts with SIGN”: costs turn positive and Operating income stops adding up.",
      ],
      note: "Items are left out of the totals (Excel’s default) · % of revenue compares every row with the Revenue section.",
    },
    {
      id: "balance",
      label: "Balance sheet",
      spec: { ...fpaBalancePivotSpec, facets: ["SECTION", "LINE"] },
      rows: generateFpaPivotRows,
      tryThis: [
        "Expand Q1 into months: the collapsed Q1 equals March, not January + February + March.",
        "Switch Balance to Opening: Q1 now shows January’s balance.",
        "Read FTE on Engineering: Q1 = (31 + 32 + 33) / 3 = 32, the average over the quarter.",
      ],
      note: "Closing balances (Q1 = March) · FTE averaged over the months · liabilities signed −1, so the total is net assets.",
    },
  ],
  features: [
    { label: "Measure filters", docs: DOCS.measureFilters },
    { label: "Budget vs actual recipe", docs: DOCS.budgetRecipe },
    { label: "Scale & units", docs: DOCS.scale },
    { label: "Calculated items", docs: DOCS.calculatedItems },
    { label: "% of revenue", docs: DOCS.percentOf },
    { label: "Sign field", docs: DOCS.signField },
    { label: "Subtotal labels", docs: DOCS.subtotalLabels },
    { label: "Income statement recipe", docs: DOCS.incomeRecipe },
    { label: "Closing / opening balance", docs: DOCS.semiAdditive },
    { label: "Balance sheet & headcount", docs: DOCS.balanceRecipe },
    { label: "Statement print profile", docs: DOCS.staticHtml },
  ],
  slicers: ["SECTION", "LINE"],
  layoutSwitch: true,
  // Semi-additive measures are not checked for unparsed numbers (engine gap, see nqlib/nqgrid#4), so
  // the balance sheet injects dates a spreadsheet export would produce instead.
  badValues: { balance: { field: "PERIOD", values: ["31/03/2026", "Q1 2026", "n/a"] } },
  panels: ALL_PIVOT_PANELS,
  Tools: FinanceTools,
};
