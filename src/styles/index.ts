import type { CSSProperties } from "react";

/**
 * Table shell SSOT (publish as `@nqlib/nqgrid` / `@nqlib/nqgrid/styles`):
 * - **Shell / scroll / typography** — these strings.
 * - **Pinned geometry** — `@nqlib/nqgrid/engine` (`usePinnedTableColumns`, `getPinnedTableCellStickyStyle`).
 * - **Column defs & data** — app / TanStack `ColumnDef` (not duplicated here).
 * - **Configurator** — `@nqlib/nqgrid/configurator` (`NqgridLibraryConfig`, `NQGRID_FEATURES`, import planner).
 * - **Demo-only chrome** (e.g. flights `data-frozen` for cancelled-row dimming) — not part of these tokens.
 */

/** Bounded card shell: flex column + max-height so ScrollArea gets a finite height (nqui / shadcn table rhythm). */
export const tableShellClass =
  "flex w-full min-h-[28rem] max-h-[min(84dvh,calc(100dvh-8rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm";

/** Merged after `tableShellClass` for taller ops-style desks. */
export const flightsTableShellExtraClass =
  "min-h-[36rem] max-h-[min(90dvh,calc(100dvh-5.5rem))]";

/** ScrollArea root in a capped flex column (`h-0` + `flex-1` avoids min-height:auto blow-through). */
export const tableScrollAreaRootClass =
  "h-0 max-h-full min-h-0 min-w-0 flex-1 overflow-hidden w-full";

/** Pin Radix viewport when `height:100%` does not bind in deep flex layouts (compose with nqui ScrollArea). */
export const tableScrollViewportStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  minHeight: 0,
  minWidth: 0,
  overscrollBehavior: "contain",
};

export const tableScrollAreaContentClass = "px-4 pt-0";

export const tableDenseTypography =
  "w-full caption-bottom border-separate border-spacing-0 text-sm [&_thead_th]:text-xs [&_thead_th]:font-medium [&_thead_th]:text-muted-foreground [&_tbody_td]:leading-normal";

export const tableHeaderClass =
  "sticky top-0 z-20 bg-card [&_tr]:border-b [&_tr]:border-border/50 [&_tr:hover]:bg-transparent";

export const tableHeadClass =
  "h-11 whitespace-nowrap border-0 bg-card px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground";

/** Borders, corner radius, hover + selected row paint (tbody); row fill is layered separately. */
const tableBodyRowChromeClass =
  "[&_td]:border-0 [&_td]:border-b [&_td]:border-border/40 [&_tr:last-child_td]:border-b-0 [&_tr:first-child_td:first-child]:rounded-tl-xl [&_tr:first-child_td:last-child]:rounded-tr-xl [&_tr:last-child_td:first-child]:rounded-bl-xl [&_tr:last-child_td:last-child]:rounded-br-xl [&_tr:hover_td]:bg-accent [&_tr[data-state=selected]_td]:bg-accent";

/** Uniform row surface (default). Opaque so sticky/pinned columns do not show scrolling content underneath. */
const tableBodyFillSolidClass = "[&_td]:bg-muted";

/** Zebra row surfaces; compose with `tableBodyRowChromeClass` only (same hover/selected rules). */
const tableBodyFillStripedClass =
  "[&_tr:nth-child(odd)_td]:bg-muted [&_tr:nth-child(even)_td]:bg-secondary";

/** Default tbody: solid muted fill + shared chrome. */
export const tableBodyClass = `${tableBodyRowChromeClass} ${tableBodyFillSolidClass}`;

/** Striped tbody: alternate row fill + shared chrome. */
export const tableBodyStripedClass = `${tableBodyRowChromeClass} ${tableBodyFillStripedClass}`;

export type TableBodyFill = "solid" | "striped";

/** Pick tbody classes from one token (`solid` = `tableBodyClass`). */
export function tableBodyClassFor(fill: TableBodyFill): string {
  return fill === "striped" ? tableBodyStripedClass : tableBodyClass;
}

export const tableRowClass = "border-0 transition-colors";

export const tableCellClass = "px-4 py-3 align-middle";

export const tableNumericClass = "text-sm leading-normal tabular-nums";

export const tableNumericMutedClass = `${tableNumericClass} text-muted-foreground`;

export const tableNumericStrongClass = `${tableNumericClass} font-medium text-foreground`;

/** Outer shell for `TablePercentBattery`: right-aligned label, bar grows from the left. */
export const tablePercentBatteryShellClass =
  "relative inline-flex min-h-7 w-full min-w-[4.5rem] max-w-full items-center justify-end overflow-hidden rounded-md px-2 py-0.5";

/** Full-cell track behind the fill (keep low contrast so row hover / zebra still read). */
export const tablePercentBatteryTrackClass =
  "pointer-events-none absolute inset-0 z-0 bg-muted-foreground/10";

/** Filled portion; width is set inline from the clamped 0–100 value. */
export const tablePercentBatteryFillClass =
  "pointer-events-none absolute inset-y-0 left-0 z-0 bg-primary/18";

const tablePercentBatteryLabelBaseClass = `${tableNumericClass} relative z-[1]`;

/** Label styling aligned with muted numeric columns. */
export const tablePercentBatteryLabelMutedClass = `${tablePercentBatteryLabelBaseClass} text-muted-foreground`;

/** Stronger label for emphasis columns. */
export const tablePercentBatteryLabelStrongClass = `${tablePercentBatteryLabelBaseClass} font-medium text-foreground`;

/** Status / tag chip base (shadcn-like tokens). */
export const tableRichPillBaseClass =
  "inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize leading-normal";

/** Tag chip: slightly denser than `tableRichPillBaseClass`. */
export const tableRichTagBaseClass =
  "inline-flex max-w-full items-center rounded-md border px-1.5 py-0 text-[11px] font-medium capitalize leading-normal";

export const tableRichPillVariantClass = {
  default: "border-transparent bg-primary/15 text-primary",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  destructive: "border-transparent bg-destructive/15 text-destructive",
  outline: "border-border bg-background text-foreground",
} as const;

/** In-cell status dropdown (native select, pill-colored). */
export const tableRichStatusSelectClass =
  "max-w-full cursor-pointer appearance-none rounded-md border px-2 py-0.5 text-xs font-medium capitalize leading-normal outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring";

export type TableRichPillVariant = keyof typeof tableRichPillVariantClass;

export const tableFooterClass =
  "flex shrink-0 flex-col gap-3 border-t border-border/70 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between";

export const tableNestedPanelClass = "rounded-xl border border-border/50 bg-card/55";

export const tableNestedHeaderClass =
  "bg-card [&_tr]:border-b [&_tr]:border-border/40 [&_tr:hover]:bg-transparent";

// ---------------------------------------------------------------------------
// Pivot (`@nqlib/nqgrid/pivot`)
//
// Geometry (widths, sticky offsets, bar heights) and data colors are inline styles, so the
// components still lay out when rendered to static HTML without Tailwind. Colors resolve through
// CSS variables with built-in fallbacks:
//   --nqg-heat-0 … --nqg-heat-8   heat cell backgrounds (default: `--nqg-heat-color` mixed over the surface)
//   --nqg-series-0 … --nqg-series-7   header chart stacks (one per top-level group, fixed order)
// ---------------------------------------------------------------------------

/** `<table>`: fixed layout so pinned offsets match the declared column widths. */
export const pivotTableClass =
  "table-fixed border-separate border-spacing-0 bg-card text-sm text-foreground";

/** Header cell (dimension + value columns). */
const pivotHeadCellBaseClass =
  "whitespace-nowrap border-b border-border bg-card px-3 align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground";

export const pivotHeadCellClass = `${pivotHeadCellBaseClass} text-left`;

/** Value-column header cell. */
export const pivotHeadValueCellClass = `${pivotHeadCellBaseClass} text-right`;

/** Header chart band cell (one per column key). */
export const pivotBandCellClass = "border-b border-border/60 bg-card px-0 pb-0 pt-2 align-bottom";

/** Left-most band cell holding the summary KPI + legend. */
export const pivotBandSummaryCellClass = "border-b border-border/60 bg-card px-3 py-2 text-left align-top font-normal";

/** Tiny value label above each header bar. */
export const pivotBandValueClass =
  "block text-center text-[10px] font-medium leading-3 tabular-nums text-muted-foreground";

export const pivotSummaryLabelClass = "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

export const pivotSummaryValueClass = "flex items-baseline gap-1.5 text-lg font-semibold leading-6 tabular-nums text-foreground";

export const pivotSummaryNoteClass = "text-[11px] font-normal text-muted-foreground";

export const pivotLegendClass = "mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground";

export const pivotLegendSwatchClass = "mr-1 inline-block size-2 rounded-[2px] align-middle";

/** Every body cell. */
export const pivotCellClass = "border-b border-border/40 px-3 align-middle";

/** Row-dimension cell surface (opaque so pinned cells hide scrolled content). */
export const pivotDimensionCellClass = `${pivotCellClass} bg-card`;

/** Department-style span cell: separated from the grid by a right rule. */
export const pivotSpanCellClass = "border-b border-r border-border/60 bg-card px-3 py-2 align-top";

/** Group-row cells (subtotals). */
export const pivotGroupCellClass = `${pivotCellClass} bg-muted font-medium`;

/** Leaf-row cells. */
export const pivotLeafCellClass = `${pivotCellClass} bg-card`;

/** Grand-total cells. */
export const pivotGrandTotalCellClass =
  "border-t border-border bg-muted px-3 align-middle font-semibold";

/** Grand-total label cell (spans the row-dimension columns). */
export const pivotGrandTotalLabelClass = "text-left";

/** Numeric alignment for value cells. */
export const pivotValueClass = "text-right tabular-nums whitespace-nowrap";

/** Group (percent-of-total) value text. */
export const pivotGroupValueClass = "text-muted-foreground";

/** Base class on heat cells (level classes `nqg-heat-0 … nqg-heat-8` are added alongside). */
export const pivotHeatCellClass = "text-foreground";

/** Right rule on the last row-dimension column. */
export const pivotPinnedEdgeClass = "border-r border-border/60";

/** Row-header cells (`<th scope="row">`) read like body cells. */
export const pivotRowHeaderClass = "text-left font-normal";

/** Pinned column (interactive mode): left offset is set inline. */
export const pivotPinnedClass = "sticky z-10";

/** Pinned header cell sits above pinned body cells and the scrolling header. */
export const pivotPinnedHeadClass = "sticky z-30";

/** Scrolling header cell (interactive mode): top offset is set inline. */
export const pivotStickyHeadClass = "sticky z-20";

/** Expand / collapse toggle. */
export const pivotToggleClass =
  "inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Child-count chip next to a group label. */
export const pivotCountClass =
  "inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-border/70 bg-background px-1 text-[10px] font-medium leading-none tabular-nums text-muted-foreground";

/** Group label inside a dimension cell. */
export const pivotGroupLabelClass = "flex min-w-0 items-center gap-1.5";

export const pivotLabelTextClass = "min-w-0 truncate";

/** KPI side panel inside the tall span cell. */
export const pivotKpiPanelClass = "flex flex-col gap-2";

export const pivotKpiTitleClass = "flex items-center justify-between gap-2 text-sm font-semibold text-foreground";

export const pivotKpiHeadlineLabelClass = "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

export const pivotKpiHeadlineValueClass = "text-xl font-semibold leading-7 tabular-nums";

export const pivotKpiListClass = "m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs";

export const pivotKpiTermClass = "text-muted-foreground";

export const pivotKpiValueClass = "m-0 text-right font-medium tabular-nums text-foreground";

export const pivotKpiCaptionClass =
  "flex items-center gap-1.5 border-t border-border/50 pt-1.5 text-xs text-muted-foreground";

export const pivotKpiAvatarClass =
  "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] font-semibold text-secondary-foreground";

/** Compact (collapsed) delta under a group label. */
export const pivotDeltaClass = "text-xs font-medium tabular-nums";

export const pivotDeltaPositiveClass = "text-emerald-600 dark:text-emerald-400";

export const pivotDeltaNegativeClass = "text-red-600 dark:text-red-400";

export const pivotDeltaNeutralClass = "text-muted-foreground";

/** Default heat hue; `--nqg-heat-color` overrides it, `--nqg-heat-N` overrides one level. */
export const PIVOT_HEAT_BASE_COLOR = "#ef6a24";

/** Mix percentages for the 9 default heat steps (mixed over the cell surface → works in light and dark). */
export const PIVOT_HEAT_MIX_PERCENT = [7, 15, 24, 33, 42, 52, 62, 72, 82] as const;

/** Header-chart stack colors (categorical, fixed order; validated adjacent-pair CVD-safe for 4 slots). */
export const PIVOT_SERIES_COLORS = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
} as const;

/** Background for heat step `index` (0–8): `var(--nqg-heat-N, <default>)`. */
export function pivotHeatColorVar(index: number): string {
  const i = Math.max(0, Math.min(PIVOT_HEAT_MIX_PERCENT.length - 1, Math.round(index)));
  return `var(--nqg-heat-${i}, color-mix(in oklab, var(--nqg-heat-color, ${PIVOT_HEAT_BASE_COLOR}) ${PIVOT_HEAT_MIX_PERCENT[i]}%, transparent))`;
}

/** Stack color for series slot `index`: `var(--nqg-series-N, <light default>)`. */
export function pivotSeriesColorVar(index: number): string {
  const palette = PIVOT_SERIES_COLORS.light;
  const i = ((index % palette.length) + palette.length) % palette.length;
  return `var(--nqg-series-${i}, ${palette[i]})`;
}

/**
 * CSS variables for one theme (spread into a `style` prop, or print as `:root` rules for static HTML).
 * Heat steps keep their surface-mixed defaults, so only the series colors differ per theme.
 */
export function pivotThemeVars(theme: "light" | "dark"): Record<`--nqg-${string}`, string> {
  const vars: Record<`--nqg-${string}`, string> = {};
  PIVOT_SERIES_COLORS[theme].forEach((c, i) => {
    vars[`--nqg-series-${i}`] = c;
  });
  return vars;
}
