import { fpaBalancePivotSpec, generateFpaPivotRows } from "@nqlib/nqgrid/fixtures";
import type { PivotScenario, PivotScenarioToolsProps } from "../types";
import { ALL_PIVOT_PANELS } from "../types";
import { ToolChoice, ToolRow, ToolSwitch } from "../tool-controls";

type BalanceKind = "closingBalance" | "openingBalance";
const Q1 = ["2026-Q1"] as const;

function BalanceTools({ grid }: PivotScenarioToolsProps) {
  const { spec } = grid;
  const aggregate = spec.measures.find((m) => m.id === "balance")?.aggregate;
  const kind: BalanceKind = typeof aggregate === "object" && aggregate.type === "openingBalance" ? "openingBalance" : "closingBalance";
  const expanded = spec.columnsExpanded;
  const q1Open = expanded === "all" || (Array.isArray(expanded) && expanded.some((p) => p.join() === Q1.join()));
  return (
    <ToolRow>
      <ToolChoice<BalanceKind>
        label="Balance as"
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

export const balanceHeadcountScenario: PivotScenario = {
  id: "balance",
  title: "Balance sheet & headcount",
  blurb: "Semi-additive measures on the same ledger: balances are not summed over time (Q1 shows the March balance) and FTE is averaged over the months.",
  tryThis: [
    "Expand Q1 into months: the collapsed Q1 column equals March, not January + February + March.",
    "Switch “Balance as” to Opening: Q1 now shows January’s balance.",
    "Read FTE on Engineering: Q1 = (31 + 32 + 33) / 3 = 32, the average over the quarter.",
  ],
  variants: [
    {
      id: "balance",
      label: "H1 2026",
      spec: { ...fpaBalancePivotSpec, facets: ["SECTION", "LINE"] },
      rows: generateFpaPivotRows,
      note: "Balances are closing balances (Q1 = March) · FTE is the average of the monthly headcount · liabilities are signed −1.",
    },
  ],
  slicers: ["SECTION", "LINE"],
  layoutSwitch: true,
  panels: ALL_PIVOT_PANELS,
  // Semi-additive measures are not checked for unparsed numbers (engine gap, see the PR), so this
  // scenario injects dates a spreadsheet export would produce instead.
  badValues: { field: "PERIOD", values: ["31/03/2026", "Q1 2026", "n/a"] },
  Tools: BalanceTools,
};
