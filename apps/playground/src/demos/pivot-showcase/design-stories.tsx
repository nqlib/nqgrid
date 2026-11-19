import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Badge, Button, ScrollArea, Switch, ToggleGroup, ToggleGroupItem } from "@nqlib/nqui";
import { buildPivotModel, type PivotHeatSpec, type PivotModel, type PivotSpec } from "@nqlib/nqgrid/core";
import { generatePlanningPivotRows, planningPivotSpec } from "@nqlib/nqgrid/fixtures";
import {
  PivotTable,
  pivotOrderMeasures,
  pivotTableGeometry,
  type PivotBarSpec,
  type PivotColumnHeaderContext,
  type PivotMeasureLayout,
  type PivotTableProps,
} from "@nqlib/nqgrid/pivot";
import { tableScrollAreaRootClass, tableScrollViewportStyle } from "@nqlib/nqgrid/styles";

/**
 * Design stories (0.5.0): one story per `PivotTable` design feature, each with only that feature on,
 * plus "All together". The page plays the host: it keeps the design in state and passes it back as
 * props, as secolab does with chart params. `?pivot=design:<story>` deep-links a story.
 */

/** The host's stored design (what secolab keeps in chart params). */
interface Design {
  readonly valueWidths: Readonly<Record<string, number>>;
  readonly dimensionWidths: readonly number[];
  readonly rowHeight: number;
  readonly measureOrder?: readonly string[];
  readonly freezeHeader: boolean;
  readonly freezeDimensions: boolean;
}

const START: Design = { valueWidths: {}, dimensionWidths: [208, 172], rowHeight: 36, freezeHeader: true, freezeDimensions: true };

const SPEC: PivotSpec = { ...planningPivotSpec, values: ["actual", "plan", "growth"], heat: null };

/** Design tokens → the grid's CSS variables. No colors in the grid; all of them live here. */
const DESIGN_VARS = {
  "--nq-pivot-heat-0": "color-mix(in oklab, var(--chart-1) 5%, transparent)",
  "--nq-pivot-heat-1": "color-mix(in oklab, var(--chart-1) 10%, transparent)",
  "--nq-pivot-heat-2": "color-mix(in oklab, var(--chart-1) 16%, transparent)",
  "--nq-pivot-heat-3": "color-mix(in oklab, var(--chart-1) 22%, transparent)",
  "--nq-pivot-heat-4": "color-mix(in oklab, var(--chart-1) 28%, transparent)",
  "--nq-pivot-heat-5": "color-mix(in oklab, var(--chart-1) 34%, transparent)",
  "--nq-pivot-heat-6": "color-mix(in oklab, var(--chart-1) 41%, transparent)",
  "--nq-pivot-heat-7": "color-mix(in oklab, var(--chart-1) 48%, transparent)",
  "--nq-pivot-heat-8": "color-mix(in oklab, var(--chart-1) 56%, transparent)",
  "--nq-pivot-heat-diverging-0": "color-mix(in oklab, var(--destructive) 46%, transparent)",
  "--nq-pivot-heat-diverging-1": "color-mix(in oklab, var(--destructive) 32%, transparent)",
  "--nq-pivot-heat-diverging-2": "color-mix(in oklab, var(--destructive) 20%, transparent)",
  "--nq-pivot-heat-diverging-3": "color-mix(in oklab, var(--destructive) 10%, transparent)",
  "--nq-pivot-heat-diverging-4": "transparent",
  "--nq-pivot-heat-diverging-5": "color-mix(in oklab, var(--chart-1) 10%, transparent)",
  "--nq-pivot-heat-diverging-6": "color-mix(in oklab, var(--chart-1) 20%, transparent)",
  "--nq-pivot-heat-diverging-7": "color-mix(in oklab, var(--chart-1) 32%, transparent)",
  "--nq-pivot-heat-diverging-8": "color-mix(in oklab, var(--chart-1) 46%, transparent)",
  "--nq-pivot-bar": "color-mix(in oklab, var(--chart-1) 30%, transparent)",
  "--nq-pivot-bar-negative": "color-mix(in oklab, var(--destructive) 30%, transparent)",
  "--nq-pivot-drop-indicator": "var(--chart-1)",
} as CSSProperties;

interface Story {
  readonly id: string;
  readonly title: string;
  readonly what: ReactNode;
  /** Props for this story (the host's design props, wired by the page). */
  readonly props: (design: Design, host: HostCallbacks) => Partial<PivotTableProps>;
  /** Extra controls shown above the table. */
  readonly controls?: (design: Design, set: (patch: Partial<Design>) => void) => ReactNode;
}

interface HostCallbacks {
  readonly onValueWidthChange: NonNullable<PivotTableProps["onValueWidthChange"]>;
  readonly onDimensionWidthChange: NonNullable<PivotTableProps["onDimensionWidthChange"]>;
  readonly onRowHeightChange: NonNullable<PivotTableProps["onRowHeightChange"]>;
  readonly onMeasureOrderChange: NonNullable<PivotTableProps["onMeasureOrderChange"]>;
}

const HEAT: readonly PivotHeatSpec[] = [{ measure: "actual", scope: "column" }, { measure: "growth", scale: "diverging", midpoint: 0 }];
const BARS: readonly PivotBarSpec[] = [{ measure: "plan", negative: "left" }];
const LAYOUT: Readonly<Record<string, PivotMeasureLayout>> = { growth: { align: "center" }, plan: { align: "start" } };
const renameHeader = (ctx: PivotColumnHeaderContext): ReactNode => (ctx.kind === "measure" && ctx.cell.measureId === "plan" ? "Budget" : ctx.label);
const negativeCell: PivotTableProps["cellClassName"] = (ctx) => (ctx.cell.value !== null && ctx.cell.value < 0 ? "text-destructive" : undefined);
const subtotalRow: PivotTableProps["rowClassName"] = (_, ctx) => (ctx.kind === "subtotal" ? "font-semibold" : undefined);
const measureHeader: PivotTableProps["headerClassName"] = (ctx) => (ctx.kind === "measure" ? "text-foreground" : undefined);

const STORIES: readonly Story[] = [
  {
    id: "widths",
    title: "Column widths",
    what: (
      <>
        Drag the right edge of any header (48–800 px), double-click it to fit the widest visible cell, or Tab to it and press
        ArrowLeft / ArrowRight (Shift: 32 px). Row-label columns work the same.
      </>
    ),
    props: (d, h) => ({ valueWidths: d.valueWidths, dimensionWidths: d.dimensionWidths, onValueWidthChange: h.onValueWidthChange, onDimensionWidthChange: h.onDimensionWidthChange }),
  },
  {
    id: "row-height",
    title: "Row height",
    what: <>Drag the bottom edge of the first value cell in the first body row (20–96 px), or focus it and press ArrowUp / ArrowDown.</>,
    props: (d, h) => ({ rowHeight: d.rowHeight, onRowHeightChange: h.onRowHeightChange }),
  },
  {
    id: "measure-order",
    title: "Measure order",
    what: (
      <>
        Drag a measure header (Actual, Plan, Growth) to a new place; a line shows where it lands and Escape cancels. Or focus one and press
        Alt+ArrowLeft / Alt+ArrowRight. Months keep their order.
      </>
    ),
    props: (d, h) => ({ measureOrder: d.measureOrder, onMeasureOrderChange: h.onMeasureOrderChange }),
  },
  {
    id: "freeze",
    title: "Freeze",
    what: <>Turn the sticky header and the sticky row labels on and off, then scroll the table both ways.</>,
    props: (d) => ({ freezeHeader: d.freezeHeader, freezeDimensions: d.freezeDimensions }),
    controls: (d, set) => (
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <Switch checked={d.freezeHeader} onCheckedChange={(v: boolean) => set({ freezeHeader: v })} />
          Freeze header
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={d.freezeDimensions} onCheckedChange={(v: boolean) => set({ freezeDimensions: v })} />
          Freeze row labels
        </label>
      </div>
    ),
  },
  {
    id: "style-hooks",
    title: "Style hooks",
    what: (
      <>
        <code>cellClassName</code> colors negatives, <code>rowClassName</code> bolds subtotals, <code>headerClassName</code> darkens measure
        headers, <code>bandedRows</code> adds <code>data-nq-band</code>. All classes are the host's tokens.
      </>
    ),
    props: () => ({ cellClassName: negativeCell, rowClassName: subtotalRow, headerClassName: measureHeader, bandedRows: true, dataAttributes: true }),
  },
  {
    id: "heat",
    title: "Heat",
    what: <>Two heat specs: Actual sequential per month, Growth diverging around 0. Colors come from <code>--nq-pivot-heat-*</code>.</>,
    props: () => ({ heat: HEAT }),
  },
  {
    id: "bars",
    title: "Data bars",
    what: <>Bars behind Plan, from <code>--nq-pivot-bar</code>. The number stays on top and selectable.</>,
    props: () => ({ bars: BARS }),
  },
  {
    id: "layout",
    title: "Per-measure layout",
    what: (
      <>
        <code>measureLayout</code> centers Growth and left-aligns Plan; <code>renderColumnHeader</code> renames Plan to “Budget”.
      </>
    ),
    props: () => ({ measureLayout: LAYOUT, renderColumnHeader: renameHeader }),
  },
  {
    id: "all",
    title: "All together",
    what: <>Every design option at once, with virtualization on. This is what a host design editor drives.</>,
    props: (d, h) => ({
      valueWidths: d.valueWidths,
      dimensionWidths: d.dimensionWidths,
      rowHeight: d.rowHeight,
      measureOrder: d.measureOrder,
      freezeHeader: d.freezeHeader,
      freezeDimensions: d.freezeDimensions,
      ...h,
      heat: HEAT,
      bars: BARS,
      measureLayout: LAYOUT,
      renderColumnHeader: renameHeader,
      cellClassName: negativeCell,
      rowClassName: subtotalRow,
      bandedRows: true,
      dataAttributes: true,
      virtualize: true,
    }),
    controls: (d, set) => STORIES[3]!.controls!(d, set),
  },
];

export const DESIGN_STORY_IDS = STORIES.map((s) => s.id);

export function DesignStories({ story, onStoryChange }: { readonly story: string; readonly onStoryChange: (id: string) => void }) {
  const current = STORIES.find((s) => s.id === story) ?? STORIES[0]!;
  const model = useMemo<PivotModel>(() => buildPivotModel(SPEC, generatePlanningPivotRows()), []);
  const [design, setDesign] = useState<Design>(START);
  const [lastChange, setLastChange] = useState<string | null>(null);
  const set = useCallback((patch: Partial<Design>) => setDesign((d) => ({ ...d, ...patch })), []);

  const host = useMemo<HostCallbacks>(
    () => ({
      onValueWidthChange: (key, width, info) => {
        setDesign((d) => ({ ...d, valueWidths: { ...d.valueWidths, [key]: width } }));
        if (info.final) setLastChange(`onValueWidthChange("${key}", ${width}) · ${info.source}`);
      },
      onDimensionWidthChange: (index, width, info) => {
        setDesign((d) => ({ ...d, dimensionWidths: d.dimensionWidths.map((w, i) => (i === index ? width : w)) }));
        if (info.final) setLastChange(`onDimensionWidthChange(${index}, ${width}) · ${info.source}`);
      },
      onRowHeightChange: (rowHeight, info) => {
        setDesign((d) => ({ ...d, rowHeight }));
        if (info.final) setLastChange(`onRowHeightChange(${rowHeight}) · ${info.source}`);
      },
      onMeasureOrderChange: (measureOrder) => {
        setDesign((d) => ({ ...d, measureOrder }));
        setLastChange(`onMeasureOrderChange([${measureOrder.map((m) => `"${m}"`).join(", ")}])`);
      },
    }),
    [],
  );
  const props = current.props(design, host);

  // Export story: the same design as an exporter sees it.
  const geometry = useMemo(() => {
    const g = pivotTableGeometry(pivotOrderMeasures(model, design.measureOrder), {
      valueWidths: design.valueWidths,
      dimensionWidths: design.dimensionWidths,
      freezeHeader: design.freezeHeader,
      freezeDimensions: design.freezeDimensions,
      heat: HEAT,
      bars: BARS,
    });
    return { columnWidths: g.columnWidths?.slice(0, 6), frozenRows: g.frozenRows, frozenColumns: g.frozenColumns, firstLeafCells: g.cells?.find(Boolean)?.slice(0, 3) };
  }, [model, design]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ToggleGroup
        type="single"
        variant="segmented"
        value={current.id}
        aria-label="Design story"
        onValueChange={(v: string) => v && onStoryChange(v)}
        className="flex-wrap"
      >
        {STORIES.map((s) => (
          <ToggleGroupItem key={s.id} value={s.id} className="px-3">
            {s.title}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted-foreground">{current.what}</p>
        <Button variant="outline" size="sm" onClick={() => (setDesign(START), setLastChange(null))}>
          Reset design
        </Button>
      </div>
      {current.controls?.(design, set)}
      <div className="nqgrid-design-demo flex h-[520px] min-h-0 flex-col" style={DESIGN_VARS}>
        <ScrollArea orientation="both" fadeMask={false} className={tableScrollAreaRootClass} viewportStyle={tableScrollViewportStyle}>
          <PivotTable model={model} onToggleGroup={() => {}} {...props} aria-label={`${current.title} story`} />
        </ScrollArea>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">Host callback</Badge>
        <code>{lastChange ?? "Change something in the table."}</code>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Stored design and export geometry</summary>
        <pre className="mt-2 overflow-auto rounded-md bg-muted p-3">{JSON.stringify({ design, geometry }, null, 2)}</pre>
      </details>
    </div>
  );
}
