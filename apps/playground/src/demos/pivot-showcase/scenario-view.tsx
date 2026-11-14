import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  Badge,
  Button,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@nqlib/nqui";
import type { PivotDrillThroughTarget, PivotHeatScope, PivotModel } from "@nqlib/nqgrid/core";
import { tableScrollAreaRootClass, tableScrollViewportStyle } from "@nqlib/nqgrid/styles";
import {
  PivotDrillThroughPanel,
  PivotFieldList,
  PivotTable,
  pivotDrillThroughFieldInfo,
  pivotDrillThroughTitle,
  pivotFieldListProps,
  usePivotGrid,
  usePivotLayoutDraft,
  type PivotColumnHeaderContext,
  type PivotDimensionHeaderContext,
} from "@nqlib/nqgrid/pivot";
import { ColumnHeader, DimensionHeaderMenu } from "./header-renderers";
import { DiagnosticsPanel } from "./panels/diagnostics-panel";
import { ExportPanel } from "./panels/export-panel";
import { SpecPanel } from "./panels/spec-panel";
import { ValidatePanel } from "./panels/validate-panel";
import { SlicerBar } from "./slicer-bar";
import { BAD_VALUES, badValueFieldOf, injectBadValues } from "./spec-tools";
import { ToolChoice, ToolSelect } from "./tool-controls";
import type { PivotPanelId, PivotScenario, PivotScenarioVariant } from "./types";

const HEAT_SCOPES: readonly { value: PivotHeatScope; label: string }[] = [
  { value: "all", label: "All cells" },
  { value: "column", label: "Per column" },
  { value: "row", label: "Per row" },
  { value: "group", label: "Within group" },
];

const PANEL_LABELS: Record<PivotPanelId, string> = {
  spec: "Spec",
  validate: "Validate",
  diagnostics: "Diagnostics",
  export: "Export",
};

type VirtualizeChoice = "auto" | "on" | "off";

const ms = (n: number) => (n >= 100 ? `${Math.round(n).toLocaleString()} ms` : `${n.toFixed(1)} ms`);

/** Pivot table area height: bounded so the table scrolls inside its card (and virtualization has a viewport). */
const TABLE_HEIGHT = "h-[min(34rem,70dvh)] min-h-[20rem]";

export interface ScenarioViewProps {
  readonly scenario: PivotScenario;
  readonly variant: PivotScenarioVariant;
  readonly onVariantChange: (variantId: string) => void;
  readonly onReset: () => void;
}

/**
 * One scenario: header with "what to try", toolbar, the live `PivotTable` (+ field list, slicers,
 * drill-through) and the cross-cutting Spec / Validate / Diagnostics / Export panels. Remounted per
 * variant, so every scenario starts from its own spec.
 */
export function ScenarioView({ scenario, variant, onVariantChange, onReset }: ScenarioViewProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  // Rows: generated once per mount (timed), optionally with bad values injected for Diagnostics.
  const generated = useMemo(() => {
    const t0 = performance.now();
    const rows = variant.rows();
    return { rows, ms: performance.now() - t0 };
  }, [variant]);
  const badField = scenario.badValues?.field ?? badValueFieldOf(variant.spec);
  const badValues = scenario.badValues?.values ?? BAD_VALUES;
  const [injected, setInjected] = useState(false);
  const rows = useMemo(
    () => (injected && badField ? injectBadValues(generated.rows, badField, badValues) : generated.rows),
    [injected, badField, badValues, generated.rows],
  );

  // Model build time: usePivotGrid builds (or reuses) the model synchronously during render.
  const t0 = performance.now();
  const pivot = usePivotGrid(variant.spec, rows);
  const elapsed = performance.now() - t0;
  const timing = useRef<{ model: PivotModel | null; ms: number }>({ model: null, ms: 0 });
  if (timing.current.model !== pivot.model) timing.current = { model: pivot.model, ms: elapsed };

  const layout = usePivotLayoutDraft(pivot);
  const { model, spec } = pivot;
  const [showFields, setShowFields] = useState(scenario.fieldListOpen ?? false);
  const [virtualize, setVirtualize] = useState<VirtualizeChoice>("auto");

  const [drill, setDrill] = useState<PivotDrillThroughTarget | null>(null);
  const onDrillThrough = useCallback((target: PivotDrillThroughTarget) => setDrill(target), []);
  const drillResult = useMemo(() => (drill ? pivot.drillThrough(drill, { limit: 500 }) : null), [drill, pivot]);
  const drillInfo = useMemo(() => pivotDrillThroughFieldInfo(spec, pivot.fields), [spec, pivot.fields]);

  const renderDimensionHeader = useCallback(
    (context: PivotDimensionHeaderContext) => <DimensionHeaderMenu grid={pivot} layout={layout} context={context} />,
    [pivot, layout],
  );
  const renderColumnHeader = useCallback((context: PivotColumnHeaderContext) => <ColumnHeader layout={layout} context={context} />, [layout]);

  // Rendered <tr> count, to show virtualization at work.
  const tableBox = useRef<HTMLDivElement>(null);
  const [domRows, setDomRows] = useState(0);
  useEffect(() => {
    const el = tableBox.current;
    if (!scenario.virtualizeControl || !el) return;
    const update = () => setDomRows(el.querySelectorAll("tbody tr").length);
    update();
    const observer = new MutationObserver(update);
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [scenario.virtualizeControl]);

  const nestedColumns = (model.columnDimensions?.length ?? 0) > 1;
  const diagnostics = model.diagnostics ?? [];
  const Tools = scenario.Tools;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Scenario header */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5" aria-labelledby="pivot-scenario-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-3xl">
            <h2 id="pivot-scenario-title" className="text-base font-semibold leading-tight">
              {scenario.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{scenario.blurb}</p>
          </div>
          {scenario.variants.length > 1 ? (
            <ToggleGroup
              type="single"
              variant="segmented"
              size="sm"
              value={variant.id}
              aria-label="Dataset"
              onValueChange={(v: string) => v && onVariantChange(v)}
            >
              {scenario.variants.map((v) => (
                <ToggleGroupItem key={v.id} value={v.id} className="px-2.5 text-xs">
                  {v.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
        </div>
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What to try</h3>
          <ol className="mt-2 grid gap-1.5 text-sm md:grid-cols-2">
            {scenario.tryThis.map((step, i) => (
              <li key={step} className="flex gap-2">
                <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Table card */}
      <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm" aria-label={`${scenario.title} pivot`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{model.title}</p>
            {model.subtitle || model.units ? (
              <p className="truncate text-xs text-muted-foreground">{[model.subtitle, model.units].filter(Boolean).join(" · ")}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {scenario.heatControl && spec.heat ? (
              <ToolSelect<PivotHeatScope>
                label="Heat by"
                value={spec.heat.scope ?? "all"}
                options={HEAT_SCOPES}
                onValueChange={pivot.setHeatScope}
                minWidth="8.5rem"
              />
            ) : null}
            {scenario.layoutSwitch ? (
              <ToolChoice<"tabular" | "compact">
                label="Layout"
                value={spec.layout ?? "tabular"}
                options={[
                  { value: "tabular", label: "Tabular" },
                  { value: "compact", label: "Compact" },
                ]}
                onValueChange={(next) => pivot.setSpec((s) => ({ ...s, layout: next }))}
              />
            ) : null}
            {scenario.virtualizeControl ? (
              <ToolChoice<VirtualizeChoice>
                label="Virtualize"
                value={virtualize}
                options={[
                  { value: "auto", label: "Auto" },
                  { value: "on", label: "On" },
                  { value: "off", label: "Off" },
                ]}
                onValueChange={setVirtualize}
              />
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={pivot.expandAll}>
                Expand all
              </Button>
              <Button size="sm" variant="outline" onClick={pivot.collapseAll}>
                Collapse all
              </Button>
              {nestedColumns ? (
                <>
                  <Button size="sm" variant="outline" onClick={pivot.expandAllColumns}>
                    Expand columns
                  </Button>
                  <Button size="sm" variant="outline" onClick={pivot.collapseAllColumns}>
                    Collapse columns
                  </Button>
                </>
              ) : null}
              <Button size="sm" variant={showFields ? "secondary" : "outline"} aria-pressed={showFields} onClick={() => setShowFields((v) => !v)}>
                Fields
              </Button>
              <Button size="sm" variant="ghost" onClick={onReset}>
                Reset
              </Button>
            </div>
          </div>
        </div>

        {Tools ? (
          <div className="border-b border-border/70 px-4 py-3">
            <Tools grid={pivot} variant={variant} />
          </div>
        ) : null}

        {scenario.slicers ? <SlicerBar grid={pivot} fields={scenario.slicers} /> : null}

        <div className="flex min-w-0 flex-col lg:flex-row">
          <div ref={tableBox} className={cn("flex min-w-0 flex-1 flex-col", TABLE_HEIGHT)}>
            <ScrollArea orientation="both" fadeMask={false} className={tableScrollAreaRootClass} viewportStyle={tableScrollViewportStyle}>
              <PivotTable
                model={model}
                onToggleGroup={pivot.toggleGroup}
                onToggleColumnGroup={pivot.toggleColumnGroup}
                renderDimensionHeader={renderDimensionHeader}
                renderColumnHeader={renderColumnHeader}
                onDrillThrough={onDrillThrough}
                virtualize={virtualize === "auto" ? "auto" : virtualize === "on"}
                aria-label={`${model.title ?? scenario.title} pivot`}
              />
            </ScrollArea>
          </div>
          {showFields ? (
            <aside
              className="flex h-[28rem] min-w-0 flex-col border-t border-border/70 lg:h-[min(34rem,70dvh)] lg:min-h-[20rem] lg:w-80 lg:shrink-0 lg:border-l lg:border-t-0"
              aria-label="PivotTable fields"
            >
              <ScrollArea className="h-full min-h-0 flex-1" fadeMask={false}>
                <div className="p-2">
                  <PivotFieldList {...pivotFieldListProps(pivot, layout)} className="border-0 shadow-none" />
                </div>
              </ScrollArea>
            </aside>
          ) : null}
        </div>

        {drill && drillResult ? (
          <div className="border-t border-border/70 p-3">
            <PivotDrillThroughPanel
              result={drillResult}
              title={pivotDrillThroughTitle(model, drill)}
              fieldLabels={drillInfo.fieldLabels}
              formats={drillInfo.formats}
              maxHeight={240}
              onClose={() => setDrill(null)}
              className="shadow-none"
            />
          </div>
        ) : null}

        <footer className="flex flex-col gap-1.5 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="tabular-nums" data-testid="pivot-stats">
            {model.rows.length.toLocaleString()} rows · {model.columns.length} value columns
            {` · ${rows.length.toLocaleString()} records`} · rows ready in {ms(generated.ms)} · model built in{" "}
            <span className="font-medium text-foreground">{ms(timing.current.ms)}</span>
            {scenario.virtualizeControl ? (
              <>
                {" "}
                · <span className="font-medium text-foreground">{domRows.toLocaleString()}</span> rows in the DOM
              </>
            ) : null}
          </p>
          {variant.note ? <p className="sm:max-w-[50%] sm:text-right">{variant.note}</p> : null}
        </footer>
      </section>

      {/* Cross-cutting panels */}
      <section className="min-w-0 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm" aria-label="Spec, validation, diagnostics and export">
        <Tabs defaultValue={scenario.panels[0] ?? "spec"} className="flex flex-col gap-3">
          <TabsList className="w-fit max-w-full">
            {scenario.panels.map((id) => (
              <TabsTrigger key={id} value={id} className="flex-none gap-1.5 px-3">
                {PANEL_LABELS[id]}
                {id === "diagnostics" && diagnostics.length ? (
                  <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px] tabular-nums" aria-label={`${diagnostics.length} diagnostics`}>
                    {diagnostics.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
          {scenario.panels.includes("spec") ? (
            <TabsContent value="spec">
              <SpecPanel spec={spec} initial={variant.spec} />
            </TabsContent>
          ) : null}
          {scenario.panels.includes("validate") ? (
            <TabsContent value="validate">
              <ValidatePanel spec={spec} onApply={(next) => pivot.setSpec(next)} />
            </TabsContent>
          ) : null}
          {scenario.panels.includes("diagnostics") ? (
            <TabsContent value="diagnostics">
              <DiagnosticsPanel diagnostics={diagnostics} injected={injected} onInjectedChange={setInjected} field={badField} values={badValues} />
            </TabsContent>
          ) : null}
          {scenario.panels.includes("export") ? (
            <TabsContent value="export">
              <ExportPanel grid={pivot} theme={theme} />
            </TabsContent>
          ) : null}
        </Tabs>
      </section>
    </div>
  );
}
