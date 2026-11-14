import { PivotCalculatedItemForm } from "@nqlib/nqgrid/pivot";
import { generateIncomePivotRows, incomePivotSpec } from "@nqlib/nqgrid/fixtures";
import type { PivotScenario, PivotScenarioToolsProps } from "../types";
import { ALL_PIVOT_PANELS } from "../types";
import { ToolPopover, ToolRow } from "../tool-controls";

const FIELD = "SECTION";

function IncomeStatementTools({ grid }: PivotScenarioToolsProps) {
  const { spec } = grid;
  const items = spec.rows.find((d) => d.field === FIELD)?.calculatedItems ?? [];
  const keys = grid.facet(FIELD).values.map((v) => ({ key: v.key, label: v.label }));
  return (
    <ToolRow>
      <ToolPopover label="Add calculated item" variant="default">
        {(close) => (
          <PivotCalculatedItemForm spec={spec} field={FIELD} keys={keys} onSubmit={(next) => (grid.setSpec(next), close())} onCancel={close} />
        )}
      </ToolPopover>
      <span className="text-xs text-muted-foreground">Items on Section:</span>
      {items.map((item) => (
        <ToolPopover key={item.key} label={item.label ?? item.key} variant="outline" ariaLabel={`Edit calculated item ${item.label ?? item.key}`}>
          {(close) => (
            <PivotCalculatedItemForm
              spec={spec}
              field={FIELD}
              itemKey={item.key}
              keys={keys}
              onSubmit={(next) => (grid.setSpec(next), close())}
              onCancel={close}
              onRemove={() => (grid.removeCalculatedItem(FIELD, item.key), close())}
            />
          )}
        </ToolPopover>
      ))}
    </ToolRow>
  );
}

export const incomeStatementScenario: PivotScenario = {
  id: "income",
  title: "Income statement",
  blurb: "Calculated items on the Section field (Gross margin, Gross margin %, EBITDA), per-section subtotal labels, a percent format for one item, and Operating income as the grand total.",
  tryThis: [
    "Click EBITDA to see its formula: [Gross margin] + [Operating expenses]. Items can read other items.",
    "Add an item “Opex ratio” = [Operating expenses] / [Revenue], placed after EBITDA, with a percent format.",
    "Hover a calculated row for its formula; double-click one of its cells to list every record it reads.",
  ],
  variants: [
    {
      id: "income",
      label: "FY 2026 by quarter",
      spec: { ...incomePivotSpec, facets: ["SECTION", "LINE"] },
      rows: generateIncomePivotRows,
      note: "Calculated items are left out of the totals (Excel’s default) · Operating income = sum of every section.",
    },
  ],
  slicers: ["SECTION", "LINE"],
  layoutSwitch: true,
  panels: ALL_PIVOT_PANELS,
  Tools: IncomeStatementTools,
};
