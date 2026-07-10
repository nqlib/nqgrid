/**
 * Playground neutral table SSOT — compact body, card header/footer, neutral row cells.
 * Visual reference: virtual-data-demo. Grid chrome from `nquiVirtualDataGridPreset()`;
 * row fills from card preset fill mode via library config.
 */
import type { ComponentProps, ReactNode } from "react";
import { Table, cn } from "@nqlib/nqui";
import { buildRowFillClass, type TableClassBundle, type TableColorTokens } from "./nqgrid-styling";
import { PlaygroundDataTableShell } from "./playground-data-table-shell";
import { resolvePlaygroundTableBodyChromeClass } from "./playground-table-tokens";
import {
  usePlaygroundResolvedTableTokens,
  usePlaygroundTableSettings,
} from "../playground-table-settings";

/** Matches virtual-data row height (28px). */
export const NEUTRAL_TABLE_ROW_HEIGHT_PX = 28;

/** Matches virtual-data header height (32px). */
export const NEUTRAL_TABLE_HEADER_HEIGHT_PX = 32;

/** Div-grid sticky header row. */
export const neutralVirtualHeaderRowClass =
  "sticky top-0 z-20 grid w-full border-b border-border bg-card";

/** Div-grid header cell. */
export const neutralVirtualHeadCellClass =
  "flex min-w-0 items-center px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground";

/** Div-grid body cell. */
export const neutralVirtualBodyCellClass =
  "flex min-w-0 items-center px-3 text-xs tabular-nums";

/** Div-grid body row layout (add fill via `neutralVirtualRowFillClass`). */
export const neutralVirtualBodyRowClass = "grid w-full border-b border-border/40";

/** Even / odd fills — same strings as token `rowStripe*Tr` / solid. */
export const neutralRowBackgroundClass = "bg-background";
export const neutralRowStripeClass = "bg-muted/20";

export function neutralVirtualRowFillClass(rowIndex: number, striped = true): string {
  if (!striped) return neutralRowBackgroundClass;
  return rowIndex % 2 === 0 ? neutralRowBackgroundClass : neutralRowStripeClass;
}

export function neutralTanStackRowFillClass(tokens: TableColorTokens, rowIndex: number): string {
  return buildRowFillClass(tokens, rowIndex);
}

/** Matches virtual-data-demo — pinned zebra cells read `[data-stripe="even"]`. */
export function playgroundTanStackRowStripeData(
  tokens: TableColorTokens,
  rowIndex: number,
): { "data-stripe"?: "even" } {
  if (tokens.body.fillMode !== "striped" || rowIndex % 2 !== 1) return {};
  return { "data-stripe": "even" };
}

export function useNeutralPlaygroundTable() {
  const { libraryConfig } = usePlaygroundTableSettings();
  const { bundle, tokens } = usePlaygroundResolvedTableTokens();
  const bodyChromeClass = resolvePlaygroundTableBodyChromeClass(libraryConfig);
  const rowFill = libraryConfig.styles?.tableBodyFill ?? "solid";

  return {
    bundle,
    tokens,
    bodyChromeClass,
    rowFill,
    shellClass: cn(tokens.shell.bg, tokens.shell.border, tokens.shell.shadow),
    footerClass: bundle.footer,
  };
}

type NeutralTableShellProps = {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  viewportRef?: (el: HTMLDivElement | null) => void;
};

/** Card + ScrollArea shell with neutral token shell/footer surfaces. */
export function NeutralTableShell({
  children,
  footer,
  className,
  viewportRef,
}: NeutralTableShellProps) {
  const { shellClass, footerClass } = useNeutralPlaygroundTable();

  return (
    <PlaygroundDataTableShell
      className={cn(shellClass, className)}
      footerClassName={footerClass}
      footer={footer}
      viewportRef={viewportRef}
      edgeToEdge
    >
      {children}
    </PlaygroundDataTableShell>
  );
}

type NeutralCompactTableProps = ComponentProps<typeof Table> & {
  children: ReactNode;
};

/** TanStack table wrapper — compact neutral typography from tokens. */
export function NeutralCompactTable({ className, children, ...props }: NeutralCompactTableProps) {
  const { bundle } = useNeutralPlaygroundTable();

  return (
    <Table className={cn(bundle.tableDenseTypography, "text-xs", className)} {...props}>
      {children}
    </Table>
  );
}

export type NeutralPlaygroundBundle = TableClassBundle;
