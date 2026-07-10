import type { CSSProperties } from "react";
import {
  buildTableClasses,
  nquiCardTablePreset,
  tableBodyClassFor as tokenBodyClassFor,
  withBodyFillMode,
  type TableBodyFill,
  type TableBodyFillMode,
} from "./tokens";

/**
 * @deprecated Import from `@nqlib/nqgrid/tokens` and compose with `buildTableClasses`.
 * These flat strings remain for back-compat only.
 */

const cardBundle = buildTableClasses(nquiCardTablePreset());
const cardTokens = nquiCardTablePreset();

/** Bounded card shell: flex column + max-height so ScrollArea gets a finite height (nqui / shadcn table rhythm). */
export const tableShellClass = cardBundle.tableShell;

/** Merged after `tableShellClass` for taller ops-style desks. */
export const flightsTableShellExtraClass =
  "min-h-[36rem] max-h-[min(90dvh,calc(100dvh-5.5rem))]";

/** ScrollArea root in a capped flex column (`h-0` + `flex-1` avoids min-height:auto blow-through). */
export const tableScrollAreaRootClass = cardBundle.scrollRoot;

/** Pin Radix viewport when `height:100%` does not bind in deep flex layouts (compose with nqui ScrollArea). */
export const tableScrollViewportStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  minHeight: 0,
  minWidth: 0,
  overscrollBehavior: "contain",
};

export const tableScrollAreaContentClass = "px-4 pt-0";

export const tableDenseTypography = cardBundle.tableDenseTypography;

export const tableHeaderClass = cardBundle.header;

export const tableHeadClass = `${cardBundle.tableHeadCellPadding} ${cardBundle.headCell}`;

/** Default tbody: solid muted fill + shared chrome. */
export const tableBodyClass = tokenBodyClassFor(cardTokens);

/** Striped tbody: alternate row fill + shared chrome. */
export const tableBodyStripedClass = tokenBodyClassFor(withBodyFillMode(cardTokens, "striped"));

export type { TableBodyFill, TableBodyFillMode };

/** Pick tbody classes from one token (`solid` = `tableBodyClass`). */
export function tableBodyClassFor(fill: TableBodyFill): string {
  return fill === "striped" ? tableBodyStripedClass : tableBodyClass;
}

export const tableRowClass = cardBundle.row;

export const tableHitAreaCellClass =
  "relative flex h-7 w-full items-center justify-center";

export const tableCellClass = "px-4 py-3 align-middle";

export const tableNumericClass = cardBundle.textNumeric;

export const tableNumericMutedClass = cardBundle.textNumericMuted;

export const tableNumericStrongClass = cardBundle.textNumericStrong;

export const tablePercentBatteryShellClass =
  "relative inline-flex min-h-7 w-full min-w-[4.5rem] max-w-full items-center justify-end overflow-hidden rounded-md px-2 py-0.5";

export const tablePercentBatteryTrackClass =
  "pointer-events-none absolute inset-0 z-0 bg-muted-foreground/10";

export const tablePercentBatteryFillClass =
  "pointer-events-none absolute inset-y-0 left-0 z-0 bg-primary/18";

const tablePercentBatteryLabelBaseClass = `${tableNumericClass} relative z-[1]`;

export const tablePercentBatteryLabelMutedClass = `${tablePercentBatteryLabelBaseClass} text-muted-foreground`;

export const tablePercentBatteryLabelStrongClass = `${tablePercentBatteryLabelBaseClass} font-medium text-foreground`;

export const tableRichPillBaseClass = cardBundle.richPillBase;

export const tableRichTagBaseClass = cardBundle.richTagBase;

export const tableRichPillVariantClass = {
  default: cardTokens.pill.default,
  secondary: cardTokens.pill.secondary,
  destructive: cardTokens.pill.destructive,
  outline: cardTokens.pill.outline,
} as const;

export const tableRichStatusSelectClass = cardBundle.richStatusSelect;

export type TableRichPillVariant = keyof typeof tableRichPillVariantClass;

export const tableFooterClass = cardBundle.tableFooter;

export const tableNestedPanelClass = cardBundle.nestedPanel;

export const tableNestedHeaderClass = cardBundle.nestedHeader;
