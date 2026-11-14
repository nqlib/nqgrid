import { generatePlanningPivotRows, planningFieldCatalog, planningFilteredPivotSpec } from "@nqlib/nqgrid/fixtures";
import type { PivotScenario, PivotScenarioToolsProps } from "../types";
import { ALL_PIVOT_PANELS } from "../types";
import { ToolChoice, ToolRow, ToolSwitch } from "../tool-controls";

type TopNChoice = "off" | "3" | "5";
type SortChoice = "label" | "desc" | "asc";

function SliceFilterTools({ grid }: PivotScenarioToolsProps) {
  const line = grid.spec.rows.find((d) => d.field === "line");
  const topN = line?.topN;
  const sort: SortChoice = line?.sortBy ? (line.sortBy.direction === "asc" ? "asc" : "desc") : "label";
  return (
    <ToolRow>
      <ToolChoice<TopNChoice>
        label="Top lines per department"
        value={topN ? (String(topN.count) as TopNChoice) : "off"}
        options={[
          { value: "off", label: "All" },
          { value: "3", label: "Top 3" },
          { value: "5", label: "Top 5" },
        ]}
        onValueChange={(v) => grid.setTopN("line", v === "off" ? null : { measure: "actual", count: Number(v), other: topN?.other ?? true })}
      />
      <ToolSwitch
        label="Fold the rest into “Other”"
        checked={topN?.other ?? false}
        disabled={!topN}
        onCheckedChange={(other) => topN && grid.setTopN("line", { ...topN, other })}
      />
      <ToolChoice<SortChoice>
        label="Sort lines"
        value={sort}
        options={[
          { value: "label", label: "A–Z" },
          { value: "desc", label: "Actual ↓" },
          { value: "asc", label: "Actual ↑" },
        ]}
        onValueChange={(v) =>
          grid.setSort("line", v === "label" ? { by: "label", direction: "asc" } : { by: "value", measure: "actual", direction: v })
        }
      />
    </ToolRow>
  );
}

export const sliceFilterScenario: PivotScenario = {
  id: "filter",
  title: "Slice & filter",
  blurb: "Slicers, Excel-style header menus, sort by value and Top N with an “Other” row that keeps the totals complete.",
  tryThis: [
    "Click Tents in the Line slicer, then ⌘/Ctrl-click Packs to add it.",
    "Open the funnel on the Line header: search, untick a value, or sort by Actual.",
    "Pick Top 3 and toggle “Other”: the department totals stay the same only when Other is on.",
  ],
  variants: [
    {
      id: "filter",
      label: "Camp & Packs, top 3",
      spec: { ...planningFilteredPivotSpec, fields: planningFieldCatalog },
      rows: () => generatePlanningPivotRows(7, { extraFields: true }),
      note: "Filters: Department in Camp, Packs · Line does not contain “kids” · top 3 lines by actual.",
    },
  ],
  slicers: ["department", "line"],
  heatControl: true,
  layoutSwitch: true,
  panels: ALL_PIVOT_PANELS,
  Tools: SliceFilterTools,
};
