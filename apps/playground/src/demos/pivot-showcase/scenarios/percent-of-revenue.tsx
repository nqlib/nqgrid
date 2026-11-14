import { generateStatementPivotRows, statementPivotSpec } from "@nqlib/nqgrid/fixtures";
import type { PivotScenario, PivotScenarioToolsProps } from "../types";
import { ALL_PIVOT_PANELS } from "../types";
import { ToolChoice, ToolRow, ToolSwitch } from "../tool-controls";

const SIGNED = ["amount", "pctRevenue"] as const;
const ORDERED = ["SECTION", "LINE"] as const;

function StatementTools({ grid }: PivotScenarioToolsProps) {
  const { spec } = grid;
  const signed = spec.measures.some((m) => m.id === "amount" && m.signField === "SIGN");
  const ordered = spec.rows.every((d) => d.sortBy?.measure === "ord");
  const pct = spec.measures.find((m) => m.id === "pctRevenue");
  const scope = pct?.showAsBase?.scope === "all" ? "all" : "parent";
  return (
    <ToolRow>
      <ToolSwitch
        label="Apply the SIGN column"
        checked={signed}
        onCheckedChange={(on) => SIGNED.forEach((id) => grid.setMeasureSignField(id, on ? "SIGN" : null))}
      />
      <ToolSwitch
        label="Order lines by LINE_SORT (hidden measure)"
        checked={ordered}
        onCheckedChange={(on) =>
          ORDERED.forEach((field) => grid.setSort(field, on ? { by: "value", measure: "ord", direction: "asc" } : { by: "label", direction: "asc" }))
        }
      />
      <ToolChoice<"all" | "parent">
        label="% of Revenue compares with"
        value={scope}
        options={[
          { value: "all", label: "Revenue, every row" },
          { value: "parent", label: "Same section only" },
        ]}
        onValueChange={(s) => grid.setMeasureShowAs("pctRevenue", "percentOf", { field: "LINE", item: "Revenue", scope: s })}
      />
    </ToolRow>
  );
}

export const percentOfRevenueScenario: PivotScenario = {
  id: "statement",
  title: "% of Revenue & signs",
  blurb: "A P&L from a ledger that stores positive amounts and a SIGN column: costs are signed on the way in, every row compares with Revenue, and lines follow the chart of accounts.",
  tryThis: [
    "Turn off “Apply the SIGN column”: costs turn positive and Operating income stops making sense.",
    "Switch “% of Revenue compares with” to “Same section only”: rows outside Revenue go blank (Excel’s rule).",
    "Turn off LINE_SORT ordering: lines fall back to A–Z. The ord measure stays hidden (not in values).",
  ],
  variants: [
    {
      id: "statement",
      label: "FY 2026 by month",
      spec: { ...statementPivotSpec, facets: ["SECTION", "LINE"] },
      rows: generateStatementPivotRows,
      note: "Amounts signed by SIGN · lines ordered by LINE_SORT · % of Revenue against the Revenue line across sections.",
    },
  ],
  slicers: ["SECTION", "LINE"],
  layoutSwitch: true,
  panels: ALL_PIVOT_PANELS,
  Tools: StatementTools,
};
