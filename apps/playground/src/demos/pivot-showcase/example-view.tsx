import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
import { DOCS, docsUrl, type PivotDocRef } from "./docs";
import { ColumnHeader, DimensionHeaderMenu } from "./header-renderers";
import { DiagnosticsPanel } from "./panels/diagnostics-panel";
import { ExportPanel } from "./panels/export-panel";
import { SpecPanel } from "./panels/spec-panel";
import { ValidatePanel } from "./panels/validate-panel";
import { SlicerBar } from "./slicer-bar";
import { BAD_VALUES, badValueFieldOf, injectBadValues } from "./spec-tools";
import { ToolChoice, ToolSelect } from "./tool-controls";
import type { PivotExample, PivotExampleView, PivotPanelId } from "./types";
import { useMediaQuery } from "./use-media-query";

const HEAT_SCOPES: readonly { value: PivotHeatScope; label: string }[] = [
  { value: "all", label: "All cells" },
  { value: "column", label: "Per column" },
  { value: "row", label: "Per row" },
  { value: "group", label: "Within group" },
];

const PANELS: Record<PivotPanelId, { label: string; docs: PivotDocRef; docsLabel: string }> = {
  spec: { label: "Spec", docs: DOCS.spec, docsLabel: "Spec reference" },
  validate: { label: "Validate", docs: DOCS.validation, docsLabel: "Validation and diagnostics docs" },
  diagnostics: { label: "Diagnostics", docs: DOCS.validation, docsLabel: "Validation and diagnostics docs" },
  export: { label: "Export", docs: DOCS.exportService, docsLabel: "Export service docs" },
};

type VirtualizeChoice = "auto" | "on" | "off";

const WIDE_QUERY = "(min-width: 1280px)";
const ms = (n: number) => (n >= 100 ? `${Math.round(n).toLocaleString()} ms` : `${n.toFixed(1)} ms`);

/** Section card shared by the header, the table and the panels. */
const cardClass = "min-w-0 rounded-2xl border border-border bg-card text-card-foreground shadow-sm";

/** A docs link that opens in a new tab, with an outward arrow. */
export function DocsLink({ docs, children, className }: { docs: PivotDocRef; children: ReactNode; className?: string }) {
  return (
    <a
      href={docsUrl(docs)}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-sm text-xs text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      {children}
      <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3 shrink-0 opacity-60" aria-hidden />
      <span className="sr-only"> (docs, opens in a new tab)</span>
    </a>
  );
}

export interface ExampleViewProps {
  readonly example: PivotExample;
  readonly view: PivotExampleView;
  readonly onViewChange: (viewId: string) => void;
  readonly onReset: () => void;
}

/**
 * One example: what it is and what to try, the live `PivotTable` with its controls, field list,
 * slicers and drill-through, and the Spec / Validate / Diagnostics / Export panels. Remounted per
 * view, so every view starts from its own spec.
 */
export function ExampleView({ example, view, onViewChange, onReset }: ExampleViewProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  // Three view labels do not fit side by side on a phone: a select there.
  const roomForViews = useMediaQuery("(min-width: 640px)");

  // Rows: generated once per mount (timed), optionally with bad values injected for Diagnostics.
  const generated = useMemo(() => {
    const t0 = performance.now();
    const rows = view.rows();
    return { rows, ms: performance.now() - t0 };
  }, [view]);
  const bad = example.badValues?.[view.id];
  const badField = bad?.field ?? badValueFieldOf(view.spec);
  const badValues = bad?.values ?? BAD_VALUES;
  const [injected, setInjected] = useState(false);
  const rows = useMemo(
    () => (injected && badField ? injectBadValues(generated.rows, badField, badValues) : generated.rows),
    [injected, badField, badValues, generated.rows],
  );

  // Model build time: usePivotGrid builds (or reuses) the model synchronously during render.
  const t0 = performance.now();
  const pivot = usePivotGrid(view.spec, rows);
  const elapsed = performance.now() - t0;
  const timing = useRef<{ model: PivotModel | null; ms: number }>({ model: null, ms: 0 });
  if (timing.current.model !== pivot.model) timing.current = { model: pivot.model, ms: elapsed };

  const layout = usePivotLayoutDraft(pivot);
  const { model, spec } = pivot;
  // The field list opens on load only where it fits beside the table.
  const [showFields, setShowFields] = useState(() => Boolean(example.fieldListOpen) && window.matchMedia(WIDE_QUERY).matches);
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
    if (!example.virtualizeControl || !el) return;
    const update = () => setDomRows(el.querySelectorAll("tbody tr").length);
    update();
    const observer = new MutationObserver(update);
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [example.virtualizeControl]);

  const nestedColumns = (model.columnDimensions?.length ?? 0) > 1;
  const diagnostics = model.diagnostics ?? [];
  const Tools = example.Tools;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* What this is, what to try, what it covers */}
      <section className={cn(cardClass, "flex flex-col gap-5 p-5")} aria-labelledby="pivot-example-title">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-2xl">
            <h2 id="pivot-example-title" className="text-base font-semibold leading-snug">
              {example.title}
            </h2>
            <p className="mt-1 text-sm text-pretty text-muted-foreground">{example.blurb}</p>
          </div>
          {example.views.length > 1 && !roomForViews ? (
            <ToolSelect label="View" value={view.id} options={example.views.map((v) => ({ value: v.id, label: v.label }))} onValueChange={onViewChange} />
          ) : null}
          {example.views.length > 1 && roomForViews ? (
            <ToggleGroup
              type="single"
              variant="segmented"
              size="sm"
              value={view.id}
              aria-label="View"
              onValueChange={(v: string) => v && onViewChange(v)}
            >
              {example.views.map((v) => (
                <ToggleGroupItem key={v.id} value={v.id} className="px-3 text-xs">
                  {v.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
        </div>
        <div className="grid gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div>
            <h3 className="text-sm font-medium">Try</h3>
            <ul className="mt-2 flex max-w-[75ch] flex-col gap-1.5 text-sm text-pretty">
              {view.tryThis.map((step) => (
                <li key={step} className="relative pl-4 before:absolute before:left-0.5 before:top-[0.6em] before:size-1.5 before:rounded-full before:bg-primary/50">
                  {step}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium">Covers</h3>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
              {example.features.map((f) => (
                <li key={f.label}>
                  <DocsLink docs={f.docs}>{f.label}</DocsLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* The table */}
      <section className={cn(cardClass, "flex flex-col overflow-hidden")} aria-label={`${model.title ?? example.title} pivot`}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{model.title}</p>
            {model.subtitle || model.units ? (
              <p className="truncate text-xs text-muted-foreground">{[model.subtitle, model.units].filter(Boolean).join(" · ")}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {example.heatControl && spec.heat ? (
              <ToolSelect<PivotHeatScope>
                label="Heat by"
                value={spec.heat.scope ?? "all"}
                options={HEAT_SCOPES}
                onValueChange={pivot.setHeatScope}
                minWidth="8.5rem"
              />
            ) : null}
            {example.layoutSwitch ? (
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
            {example.virtualizeControl ? (
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
            <div className="flex flex-wrap items-center gap-1.5">
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
          <div className="border-b border-border/70 bg-muted/30 px-4 py-3">
            <Tools grid={pivot} view={view} />
          </div>
        ) : null}

        {example.slicers ? <SlicerBar grid={pivot} fields={example.slicers} /> : null}

        <div className="flex min-w-0 flex-col xl:flex-row">
          <div ref={tableBox} className="flex h-[min(36rem,72dvh)] min-h-[20rem] min-w-0 flex-1 flex-col">
            <ScrollArea orientation="both" fadeMask={false} className={tableScrollAreaRootClass} viewportStyle={tableScrollViewportStyle}>
              <PivotTable
                model={model}
                onToggleGroup={pivot.toggleGroup}
                onToggleColumnGroup={pivot.toggleColumnGroup}
                renderDimensionHeader={renderDimensionHeader}
                renderColumnHeader={renderColumnHeader}
                onDrillThrough={onDrillThrough}
                virtualize={virtualize === "auto" ? "auto" : virtualize === "on"}
                aria-label={`${model.title ?? example.title} pivot`}
              />
            </ScrollArea>
          </div>
          {showFields ? (
            <aside
              className="flex h-[28rem] min-w-0 flex-col border-t border-border/70 xl:h-[min(36rem,72dvh)] xl:min-h-[20rem] xl:w-80 xl:shrink-0 xl:border-l xl:border-t-0"
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

        <footer className="flex flex-col gap-1.5 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <p className="tabular-nums" data-testid="pivot-stats">
            {model.rows.length.toLocaleString()} rows · {model.columns.length} value columns · {rows.length.toLocaleString()} records · rows ready in{" "}
            {ms(generated.ms)} · model built in <span className="font-medium text-foreground">{ms(timing.current.ms)}</span>
            {example.virtualizeControl ? (
              <>
                {" "}
                · <span className="font-medium text-foreground">{domRows.toLocaleString()}</span> rows in the DOM
              </>
            ) : null}
          </p>
          {view.note ? <p className="text-pretty lg:max-w-[46%] lg:text-right">{view.note}</p> : null}
        </footer>
      </section>

      {/* Inspect: spec, validation, diagnostics, export */}
      <section className={cn(cardClass, "p-4")} aria-label="Spec, validation, diagnostics and export">
        <Tabs defaultValue={example.panels[0] ?? "spec"} className="flex flex-col gap-3">
          <TabsList className="w-fit max-w-full">
            {example.panels.map((id) => (
              <TabsTrigger key={id} value={id} className="flex-none gap-1.5 px-3">
                {PANELS[id].label}
                {id === "diagnostics" && diagnostics.length ? (
                  <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px] tabular-nums" aria-label={`${diagnostics.length} diagnostics`}>
                    {diagnostics.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
          {example.panels.map((id) => (
            <TabsContent key={id} value={id} className="flex flex-col gap-3">
              {id === "spec" ? <SpecPanel spec={spec} initial={view.spec} /> : null}
              {id === "validate" ? <ValidatePanel spec={spec} onApply={(next) => pivot.setSpec(next)} /> : null}
              {id === "diagnostics" ? (
                <DiagnosticsPanel diagnostics={diagnostics} injected={injected} onInjectedChange={setInjected} field={badField} values={badValues} />
              ) : null}
              {id === "export" ? <ExportPanel grid={pivot} theme={theme} /> : null}
              <DocsLink docs={PANELS[id].docs} className="self-start">
                {PANELS[id].docsLabel}
              </DocsLink>
            </TabsContent>
          ))}
        </Tabs>
      </section>
    </div>
  );
}
