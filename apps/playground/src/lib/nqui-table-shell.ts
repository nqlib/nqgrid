import type { CSSProperties, ReactNode } from "react";
import {
  playgroundCardBundle,
  playgroundCardBodyClassForFill,
} from "./playground-table-tokens";
import type { TableBodyFillMode } from "./nqgrid-styling";

/**
 * Playground layout-only tokens for nqui Card + Table + ScrollArea.
 * Color classes come from `@nqlib/nqgrid/tokens` via playground-table-tokens.
 */

export const tableScrollAreaRootClass = playgroundCardBundle.scrollRoot;

export const tableScrollViewportStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  minHeight: 0,
  minWidth: 0,
  overscrollBehavior: "contain",
};

/** Legacy padded wrapper — avoid on scroll tables (causes card/table gap). */
export const tableScrollAreaContentClass = "px-4 pt-0";

/** Edge-to-edge table inside Card + ScrollArea (matches virtual data). */
export const tableScrollAreaEdgeClass = "min-h-0 min-w-0 w-full pt-0";

/** Bounded height presets merged onto nqui Card shells. */
export const tableShellLayoutClass =
  "flex min-h-[28rem] max-h-[min(84dvh,calc(100dvh-8rem))] min-w-0 flex-col gap-0 overflow-hidden py-0";

export const flightsTableShellExtraClass =
  "min-h-[36rem] max-h-[min(90dvh,calc(100dvh-5.5rem))]";

export function tableBodyClassFor(fill: Exclude<TableBodyFillMode, "none">): string {
  return playgroundCardBodyClassForFill(fill);
}

export const tableBodyClass = playgroundCardBodyClassForFill("solid");
export const tableBodyStripedClass = playgroundCardBodyClassForFill("striped");
export const tableHeaderClass = playgroundCardBundle.header;
export const tableHeadClass = `${playgroundCardBundle.tableHeadCellPadding} ${playgroundCardBundle.headCell}`;

export {
  tablePinnedBodyFillClass,
  tablePinnedHeadFillClass,
  tableOpaqueHeadClass,
  tableStickyHeaderClass,
} from "./playground-table-chrome";

export const tableNumericClass = playgroundCardBundle.textNumeric;
export const tableNumericMutedClass = playgroundCardBundle.textNumericMuted;
export const tableNumericStrongClass = playgroundCardBundle.textNumericStrong;

export type PlaygroundDataTableShellProps = {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  footerClassName?: string;
  edgeToEdge?: boolean;
  viewportRef?: (el: HTMLDivElement | null) => void;
};
