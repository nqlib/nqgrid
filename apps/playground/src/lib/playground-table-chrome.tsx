import type { ComponentProps } from "react";
import { TableHead, TableHeader, cn } from "@nqlib/nqui";
import { playgroundCardBundle } from "./playground-table-tokens";

/** Sticky thead: opaque fill, z-20, suppress row hover bleed-through. */
export const tableStickyHeaderClass = playgroundCardBundle.header;

/** Every `<th>` in a sticky header needs an opaque surface (including non-pinned). */
export const tableOpaqueHeadClass = cn(
  playgroundCardBundle.tableHeadCellPadding,
  playgroundCardBundle.headCell,
);

/** Legacy chrome helpers — prefer `pinPlaygroundCell` / `pinPlaygroundFreezeCell` in playground-row-index-gutter.ts. */
export const tablePinnedHeadFillClass = playgroundCardBundle.pinnedHeadFill;
export const tablePinnedBodyFillClass = playgroundCardBundle.pinnedBodyFill;

export function PlaygroundStickyTableHeader({
  className,
  ...props
}: ComponentProps<typeof TableHeader>) {
  return <TableHeader className={cn(tableStickyHeaderClass, className)} {...props} />;
}

export function PlaygroundOpaqueTableHead({
  pinned,
  className,
  ...props
}: ComponentProps<typeof TableHead> & { pinned?: boolean }) {
  return (
    <TableHead
      className={cn(
        tableOpaqueHeadClass,
        pinned && tablePinnedHeadFillClass,
        className,
      )}
      {...props}
    />
  );
}
