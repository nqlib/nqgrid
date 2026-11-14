import type { PivotDateGroup } from "@nqlib/nqgrid/core";
import { generatePlanningPivotRows, planningDatesPivotSpec, planningMultiColumnPivotSpec } from "@nqlib/nqgrid/fixtures";
import type { PivotScenario, PivotScenarioToolsProps } from "../types";
import { ALL_PIVOT_PANELS } from "../types";
import { ToolChoice, ToolRow } from "../tool-controls";

const columnFieldsOf = (grid: PivotScenarioToolsProps["grid"]) => {
  const c = grid.spec.columns;
  return c === undefined ? [] : Array.isArray(c) ? c : [c];
};

type Grouping = "year-quarter" | "year-month" | "quarter";
const GROUPINGS: Record<Grouping, readonly PivotDateGroup[]> = {
  "year-quarter": ["year", "quarter"],
  "year-month": ["year", "month"],
  quarter: ["yearQuarter"],
};

type ValuesPosition = "0" | "1" | "2";

function ColumnHierarchyTools({ grid, variant }: PivotScenarioToolsProps) {
  const columns = columnFieldsOf(grid);
  if (variant.id === "dates") {
    const groups = columns.filter((c) => c.field.startsWith("orderDate:")).map((c) => c.field.slice("orderDate:".length));
    const current = (Object.keys(GROUPINGS) as Grouping[]).find((g) => GROUPINGS[g].join() === groups.join()) ?? "year-quarter";
    return (
      <ToolRow>
        <ToolChoice<Grouping>
          label="Group order date by"
          value={current}
          options={[
            { value: "year-quarter", label: "Year → Quarter" },
            { value: "year-month", label: "Year → Month" },
            { value: "quarter", label: "Quarter" },
          ]}
          onValueChange={(g) => grid.setDateGrouping("orderDate", GROUPINGS[g], "columns")}
        />
      </ToolRow>
    );
  }
  const index = grid.spec.valuesIndex ?? columns.length;
  return (
    <ToolRow>
      <ToolChoice<ValuesPosition>
        label="Σ Values"
        value={String(Math.min(index, 2)) as ValuesPosition}
        options={[
          { value: "0", label: "Outermost" },
          { value: "1", label: "Between" },
          { value: "2", label: "Innermost" },
        ]}
        onValueChange={(v) => grid.setValuesPosition(Number(v))}
      />
    </ToolRow>
  );
}

export const columnHierarchyScenario: PivotScenario = {
  id: "columns",
  title: "Column hierarchy & dates",
  blurb: "Several column fields with collapsible column groups, and ISO dates grouped into fiscal years and quarters (the year starts in November).",
  tryThis: [
    "Click the chevron on a Region header to fold its channels into one subtotal column.",
    "Switch to “Order date”: FY2025 is collapsed to its total; expand it.",
    "Change “Group order date by” to Year → Month, or use Group by… on the Order date chip in Fields.",
  ],
  variants: [
    {
      id: "columns",
      label: "Region › Channel",
      spec: { ...planningMultiColumnPivotSpec, facets: ["department", "line"] },
      rows: () => generatePlanningPivotRows(7, { extraFields: true }),
      note: "Share of region = each channel’s actual as a % of its region (percentOfParentColumn).",
    },
    {
      id: "dates",
      label: "Order date",
      spec: { ...planningDatesPivotSpec, facets: ["department", "line"] },
      rows: () => generatePlanningPivotRows(7, { extraFields: true, orderDates: true }),
      note: "Order dates grouped by fiscal year (from November); click a year to collapse it.",
    },
  ],
  heatControl: true,
  layoutSwitch: true,
  panels: ALL_PIVOT_PANELS,
  Tools: ColumnHierarchyTools,
};
