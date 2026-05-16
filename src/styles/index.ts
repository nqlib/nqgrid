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
