import { useMemo, useState } from "react";
import {
  Button,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@nqlib/nqui";
import {
  generatePlanningPivotRows,
  planningPivotSpec,
  flightsTableShellExtraClass,
  tableFooterClass,
  tableScrollAreaRootClass,
  tableScrollViewportStyle,
  tableShellClass,
  type PivotHeatScope,
} from "@nqlib/nqgrid";
import { PivotTable, usePivotGrid } from "@nqlib/nqgrid/pivot";

const HEAT_SCOPES: readonly { value: PivotHeatScope; label: string }[] = [
  { value: "all", label: "All Lines" },
  { value: "column", label: "Per month" },
  { value: "row", label: "Per line" },
  { value: "group", label: "Within department" },
];

/**
 * Planning grid from `@nqlib/nqgrid/pivot`: pinned Department (KPI panel, real rowSpan) and Line
 * columns, heat-colored months and a stacked header chart band. Every control edits the spec —
 * "Export" would post `spec` to the backend so the PDF/XLSX matches what is on screen.
 */
export function PlanningPivotDemo() {
  const rows = useMemo(() => generatePlanningPivotRows(), []);
  const pivot = usePivotGrid(planningPivotSpec, rows);
  const { model, spec } = pivot;
  const [showSpec, setShowSpec] = useState(false);
  const scope = spec.heat?.scope ?? "all";

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[36rem] flex-col gap-3">
      <div className={cn(tableShellClass, flightsTableShellExtraClass, "flex-1")}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight">{model.title}</h2>
            <p className="text-xs text-muted-foreground">Department → Line × fiscal month · actuals</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Heat by</span>
            <Select value={scope} onValueChange={(v) => pivot.setHeatScope(v as PivotHeatScope)}>
              <SelectTrigger size="sm" minWidth="10rem" aria-label="Heat by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEAT_SCOPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={pivot.expandAll}>
              Expand all
            </Button>
            <Button size="sm" variant="outline" onClick={pivot.collapseAll}>
              Collapse all
            </Button>
            <Button size="sm" onClick={() => setShowSpec((v) => !v)}>
              {showSpec ? "Hide export spec" : "Export"}
            </Button>
          </div>
        </div>

        <ScrollArea
          orientation="both"
          fadeMask={false}
          className={tableScrollAreaRootClass}
          viewportStyle={tableScrollViewportStyle}
        >
          <PivotTable model={model} onToggleGroup={pivot.toggleGroup} aria-label="FY26 sales plan pivot" />
        </ScrollArea>

        <div className={tableFooterClass}>
          <p className="text-sm text-muted-foreground">
            {model.rows.length} visible rows · {model.columns.length} months · heat scope{" "}
            <span className="font-medium text-foreground">{HEAT_SCOPES.find((s) => s.value === scope)?.label}</span>
          </p>
          <p className="text-xs text-muted-foreground">Group rows show % of month total; lines show actuals.</p>
        </div>
      </div>

      {showSpec ? (
        <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
          {JSON.stringify({ expanded: spec.expanded, heat: spec.heat }, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
