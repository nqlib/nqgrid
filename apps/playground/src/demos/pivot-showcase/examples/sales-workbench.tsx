import { useState } from "react";
import { Button } from "@nqlib/nqui";
import type { PivotDateGroup, PivotSpec } from "@nqlib/nqgrid/core";
import { generatePlanningPivotRows, planningCalcPivotSpec } from "@nqlib/nqgrid/fixtures";
import { PivotCalculatedMeasureForm, PivotShowAsMenu } from "@nqlib/nqgrid/pivot";
import { DOCS } from "../docs";
import { ToolChoice, ToolGroup, ToolPopover, ToolRow, ToolSelect, ToolSwitch } from "../tool-controls";
import type { PivotExample, PivotExampleToolsProps } from "../types";
import { ALL_PIVOT_PANELS } from "../types";

/**
 * One spec that carries every analysis feature: the calc fixture (calculated measure, % difference
 * from the previous year, running total, distinct count, KPI panel, heat, header charts, subtotals at
 * the end) with order dates grouped Year → Quarter in Columns, FY25 collapsed, and slicer facets.
 */
export const salesWorkbenchSpec: PivotSpec = {
  ...planningCalcPivotSpec,
  id: "sales-workbench",
  title: "Sales plan workbench",
  subtitle: "FY25–FY26 orders by fiscal quarter",
  columns: [{ field: "orderDate:year" }, { field: "orderDate:quarter" }],
  columnsExpanded: [["2026"]],
  values: ["actual", "vsPlan", "yoy"],
  facets: ["department", "line"],
};

type TopN = "all" | "3" | "5";
type Grouping = "year-quarter" | "year-month" | "year";
const GROUPINGS: Record<Grouping, readonly PivotDateGroup[]> = {
  "year-quarter": ["year", "quarter"],
  "year-month": ["year", "month"],
  year: ["year"],
};

function SalesTools({ grid }: PivotExampleToolsProps) {
  const { spec } = grid;
  const line = spec.rows.find((d) => d.field === "line");
  const topN = line?.topN;
  const columns = spec.columns === undefined ? [] : Array.isArray(spec.columns) ? spec.columns : [spec.columns];
  const dateGroups = columns.filter((c) => c.field.startsWith("orderDate:")).map((c) => c.field.slice("orderDate:".length));
  const grouping = (Object.keys(GROUPINGS) as Grouping[]).find((g) => GROUPINGS[g].join() === dateGroups.join());
  const shown = spec.values ?? spec.measures.map((m) => m.id);
  const showAsOptions = spec.measures.filter((m) => !m.calculate && m.id !== "regions").map((m) => ({ value: m.id, label: m.label ?? m.id }));
  const [showAsId, setShowAsId] = useState("yoy");
  const showAsMeasure = showAsOptions.some((o) => o.value === showAsId) ? showAsId : (showAsOptions[0]?.value ?? "actual");
  const calculated = spec.measures.filter((m) => m.calculate);

  return (
    <ToolRow className="gap-x-8">
      <ToolGroup label="Lines">
        <ToolChoice<TopN>
          label="Show"
          value={topN ? (String(topN.count) as TopN) : "all"}
          options={[
            { value: "all", label: "All" },
            { value: "3", label: "Top 3" },
            { value: "5", label: "Top 5" },
          ]}
          onValueChange={(v) => grid.setTopN("line", v === "all" ? null : { measure: "actual", count: Number(v), other: topN?.other ?? true })}
        />
        <ToolSwitch
          label="Rest as “Other”"
          checked={topN?.other ?? false}
          disabled={!topN}
          onCheckedChange={(other) => topN && grid.setTopN("line", { ...topN, other })}
        />
      </ToolGroup>

      <ToolGroup label="Columns">
        {grouping ? (
          <ToolChoice<Grouping>
            label="Order date by"
            value={grouping}
            options={[
              { value: "year-quarter", label: "Quarter" },
              { value: "year-month", label: "Month" },
              { value: "year", label: "Year" },
            ]}
            onValueChange={(g) => grid.setDateGrouping("orderDate", GROUPINGS[g], "columns")}
          />
        ) : null}
        <Button size="sm" variant="outline" onClick={grid.swapRowsColumns}>
          Swap rows and columns
        </Button>
      </ToolGroup>

      <ToolGroup label="Measures">
        <ToolPopover label="New calculated measure">
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
                onRemove={shown.length > 1 ? () => (grid.removeMeasure(m.id), close()) : undefined}
              />
            )}
          </ToolPopover>
        ))}
        <ToolSelect label="Show values as for" value={showAsMeasure} options={showAsOptions} onValueChange={setShowAsId} minWidth="8rem" />
        <ToolPopover label="Show values as…" ariaLabel={`Show values as, for ${showAsMeasure}`}>
          {() => <PivotShowAsMenu spec={spec} measureId={showAsMeasure} onChange={grid.setSpec} getFacet={grid.facet} />}
        </ToolPopover>
      </ToolGroup>
    </ToolRow>
  );
}

export const salesWorkbenchExample: PivotExample = {
  id: "sales",
  title: "Sales workbench",
  blurb:
    "Two fiscal years of orders by department and line. Every analysis feature works on this one table: slice it, rearrange it, add measures, and open any number.",
  views: [
    {
      id: "sales",
      label: "FY25–FY26",
      spec: salesWorkbenchSpec,
      rows: () => generatePlanningPivotRows(7, { extraFields: true, orderDates: true }),
      tryThis: [
        "Click Tents in the Line slicer, ⌘/Ctrl-click Packs, then open the funnel on the Line header to sort by Actual.",
        "Set Lines to Top 3 and toggle “Other”: department totals stay complete only with Other on.",
        "In Fields, drag Region to Columns and Channel next to it; expand FY2025 with its chevron.",
        "Add a calculated measure: type actual / nope to see the inline error, then actual - plan. Double-click a cell for its records.",
      ],
      note: "vs Plan = actual / plan − 1 · YoY = % difference from the previous fiscal year · fiscal years start in November.",
    },
  ],
  features: [
    { label: "KPI panel, heat, header charts", docs: DOCS.spec },
    { label: "Slicers, filter menus, sort, Top N", docs: DOCS.filters },
    { label: "Field list & drag-and-drop", docs: DOCS.fieldList },
    { label: "Column groups", docs: DOCS.columns },
    { label: "Date grouping", docs: DOCS.dates },
    { label: "Calculated measures", docs: DOCS.calculated },
    { label: "Show values as", docs: DOCS.showAs },
    { label: "Subtotal position", docs: DOCS.subtotals },
    { label: "Distinct count", docs: DOCS.distinctCount },
    { label: "Drill-through", docs: DOCS.drillThrough },
  ],
  slicers: ["department", "line"],
  fieldListOpen: true,
  heatControl: true,
  layoutSwitch: true,
  panels: ALL_PIVOT_PANELS,
  Tools: SalesTools,
};
