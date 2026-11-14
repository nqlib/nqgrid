import { generatePlanningPivotRows, planningFieldCatalog, planningPivotSpec } from "@nqlib/nqgrid/fixtures";
import type { PivotScenario, PivotScenarioToolsProps } from "../types";
import { ALL_PIVOT_PANELS } from "../types";
import { ToolRow, ToolSwitch } from "../tool-controls";

function PlanningGridTools({ grid, variant }: PivotScenarioToolsProps) {
  const chart = variant.spec.headerCharts;
  return (
    <ToolRow>
      <ToolSwitch
        label="Header mini charts"
        checked={grid.spec.headerCharts !== undefined}
        onCheckedChange={(on) =>
          grid.setSpec((s) => {
            const { headerCharts: _omit, ...rest } = s;
            return on && chart ? { ...rest, headerCharts: chart } : rest;
          })
        }
      />
    </ToolRow>
  );
}

export const planningGridScenario: PivotScenario = {
  id: "planning",
  title: "Planning grid",
  blurb: "A sales plan by department and line: KPI side panel per department, heat-coloured months and stacked bars in the header.",
  tryThis: [
    "Switch “Heat by” to Per column, then Within department, and watch the colour scale change.",
    "Collapse Camp with its chevron: the KPI panel stays, the lines fold into the subtotal.",
    "Turn off the header mini charts, then open the Spec tab: headerCharts is gone from the spec.",
  ],
  variants: [
    {
      id: "planning",
      label: "Fiscal months",
      spec: { ...planningPivotSpec, facets: ["department", "line"], fields: planningFieldCatalog },
      rows: () => generatePlanningPivotRows(7, { extraFields: true }),
      note: "Department rows show % of the month total; lines show actuals.",
    },
  ],
  heatControl: true,
  layoutSwitch: true,
  panels: ALL_PIVOT_PANELS,
  Tools: PlanningGridTools,
};
