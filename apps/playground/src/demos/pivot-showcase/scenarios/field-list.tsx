import { Button } from "@nqlib/nqui";
import { generatePlanningPivotRows, planningFieldsPivotSpec } from "@nqlib/nqgrid/fixtures";
import type { PivotScenario, PivotScenarioToolsProps } from "../types";
import { ALL_PIVOT_PANELS } from "../types";
import { ToolRow } from "../tool-controls";

function FieldListTools({ grid }: PivotScenarioToolsProps) {
  const rows = grid.spec.rows.map((d) => d.label ?? d.field).join(" → ");
  return (
    <ToolRow>
      <Button size="sm" variant="outline" onClick={grid.swapRowsColumns}>
        Swap rows and columns
      </Button>
      <span className="text-xs text-muted-foreground">
        Rows: <span className="text-foreground">{rows || "none"}</span>
      </span>
    </ToolRow>
  );
}

export const fieldListScenario: PivotScenario = {
  id: "fields",
  title: "Field list & drag-and-drop",
  blurb: "Excel’s PivotTable Fields pane: drag fields between Filters, Rows, Columns and Values, or defer the layout and apply it at once.",
  tryThis: [
    "Drag Region from the checklist to Rows, then drag the Line header onto the Columns area.",
    "Tick “Defer layout update”, move two fields, and press Update: the table rebuilds once.",
    "Press “Swap rows and columns” and watch rows, columns and the Spec tab change together.",
    "Keyboard: focus a chip, press Space to lift it, arrows to move, Space to drop.",
  ],
  variants: [
    {
      id: "fields",
      label: "Rearranged layout",
      spec: { ...planningFieldsPivotSpec, facets: ["department", "line"] },
      rows: () => generatePlanningPivotRows(7, { extraFields: true }),
      note: "Region West is excluded in Filters; Σ Values sits before Month, so measures are outermost.",
    },
  ],
  fieldListOpen: true,
  heatControl: true,
  layoutSwitch: true,
  panels: ALL_PIVOT_PANELS,
  Tools: FieldListTools,
};
