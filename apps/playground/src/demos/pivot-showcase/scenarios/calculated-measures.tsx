import { useState } from "react";
import { PivotCalculatedMeasureForm, PivotShowAsMenu } from "@nqlib/nqgrid/pivot";
import { generatePlanningPivotRows, planningCalcPivotSpec } from "@nqlib/nqgrid/fixtures";
import type { PivotScenario, PivotScenarioToolsProps } from "../types";
import { ALL_PIVOT_PANELS } from "../types";
import { ToolPopover, ToolRow, ToolSelect } from "../tool-controls";

function CalculatedMeasureTools({ grid }: PivotScenarioToolsProps) {
  const { spec } = grid;
  const shown = spec.values ?? spec.measures.map((m) => m.id);
  const showAsOptions = spec.measures.filter((m) => shown.includes(m.id) && !m.calculate).map((m) => ({ value: m.id, label: m.label ?? m.id }));
  const [showAsId, setShowAsId] = useState("yoy");
  const showAsMeasure = showAsOptions.some((o) => o.value === showAsId) ? showAsId : (showAsOptions[0]?.value ?? "actual");
  const calculated = spec.measures.filter((m) => m.calculate);
  return (
    <ToolRow>
      <ToolPopover label="New calculated measure" variant="default">
        {(close) => <PivotCalculatedMeasureForm spec={spec} onSubmit={(next) => (grid.setSpec(next), close())} onCancel={close} />}
      </ToolPopover>
      {calculated.map((m) => (
        <ToolPopover key={m.id} label={`Edit ${m.label ?? m.id}`}>
          {(close) => (
            <PivotCalculatedMeasureForm
              spec={spec}
              measureId={m.id}
              onSubmit={(next) => (grid.setSpec(next), close())}
              onCancel={close}
              onRemove={() => (grid.removeMeasure(m.id), close())}
            />
          )}
        </ToolPopover>
      ))}
      <div className="flex items-center gap-2">
        <ToolSelect label="Show values as for" value={showAsMeasure} options={showAsOptions} onValueChange={setShowAsId} />
        <ToolPopover label="Show values as…" ariaLabel={`Show values as for ${showAsMeasure}`}>
          {() => <PivotShowAsMenu spec={spec} measureId={showAsMeasure} onChange={grid.setSpec} getFacet={grid.facet} />}
        </ToolPopover>
      </div>
    </ToolRow>
  );
}

export const calculatedMeasuresScenario: PivotScenario = {
  id: "calc",
  title: "Calculated measures & show values as",
  blurb: "A formula measure (vs Plan = actual / plan − 1), % difference from the previous year, a running total, a distinct count, and drill-through to the records behind any cell.",
  tryThis: [
    "Press “New calculated measure” and type actual / nope: the form flags the unknown measure inline. Fix it to actual - plan and add it.",
    "Pick Actual in “Show values as for”, then choose Rank or % of with a base item.",
    "Double-click any value cell to list its source records.",
  ],
  variants: [
    {
      id: "calc",
      label: "FY25 vs FY26",
      spec: { ...planningCalcPivotSpec, facets: ["department", "line"] },
      rows: () => generatePlanningPivotRows(7, { extraFields: true, orderDates: true }),
      note: "vs Plan = actual / plan − 1 · YoY = % difference from the previous year · Regions = distinct count.",
    },
  ],
  heatControl: true,
  layoutSwitch: true,
  panels: ALL_PIVOT_PANELS,
  Tools: CalculatedMeasureTools,
};
