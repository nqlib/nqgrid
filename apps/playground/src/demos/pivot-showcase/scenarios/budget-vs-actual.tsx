import { Badge } from "@nqlib/nqui";
import type { PivotFilter, PivotSpec } from "@nqlib/nqgrid/core";
import { fpaPivotSpec, generateFpaPivotRows } from "@nqlib/nqgrid/fixtures";
import type { PivotScenario, PivotScenarioToolsProps } from "../types";
import { ALL_PIVOT_PANELS } from "../types";
import { ToolChoice, ToolRow } from "../tool-controls";

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

function BudgetVsActualTools({ grid }: PivotScenarioToolsProps) {
  const { spec } = grid;
  const scale = String(spec.measures.find((m) => m.format?.style === "currency")?.format?.scale ?? 1) as Scale;
  const filtered = spec.measures.filter((m) => m.filter && (spec.values ?? []).includes(m.id));
  return (
    <div className="flex flex-col gap-3">
      <ToolRow>
        <ToolChoice<Scale>
          label="Show amounts in"
          value={scale}
          options={[
            { value: "1", label: "USD" },
            { value: "1000", label: "Thousands" },
            { value: "1000000", label: "Millions" },
          ]}
          onValueChange={(s) => grid.setSpec((prev) => withCurrencyScale(prev, s))}
        />
      </ToolRow>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="mr-1">Measure filters on one long table:</span>
        {filtered.map((m) => (
          <Badge key={m.id} variant="secondary" className="font-normal">
            <span className="font-medium text-foreground">{m.label}</span>&nbsp;
            {(Array.isArray(m.filter) ? m.filter : [m.filter as PivotFilter]).map(filterText).join(" · ")}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const budgetVsActualScenario: PivotScenario = {
  id: "fpa",
  title: "Budget vs actual",
  blurb: "One long-format ledger (SCENARIO = Actual / Budget, two years) pivoted into Actual, Budget, variance, YTD and prior year columns with measure-level filters, in USD thousands.",
  tryThis: [
    "Switch “Show amounts in” to Millions: the numbers rescale, the aggregation does not (check Export → request).",
    "Double-click a Budget cell: drill-through lists only budget records, because the measure filter applies.",
    "Collapse Revenue: Var and Var % are recomputed on the subtotal, not summed.",
  ],
  variants: [
    {
      id: "fpa",
      label: "H1 2026 by quarter",
      spec: { ...fpaPivotSpec, facets: ["SECTION", "LINE"] },
      rows: generateFpaPivotRows,
      note: "Actual, Budget and PY are measure filters on SCENARIO / year · Var % = (actual − budget) / |budget|.",
    },
  ],
  slicers: ["SECTION", "LINE"],
  layoutSwitch: true,
  panels: ALL_PIVOT_PANELS,
  Tools: BudgetVsActualTools,
};
