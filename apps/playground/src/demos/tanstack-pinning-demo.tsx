import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  useReactTable,
  type ColumnPinningState,
  type SortingState,
} from "@tanstack/react-table";
import { Button, cn } from "@nqlib/nqui";
import { withCoreSorting } from "@nqlib/nqgrid";
import {
  gridBodyHoverClass,
  gridCellClass,
  gridHeadCellClass,
  gridHeaderClass,
  gridNumericClass,
  gridRowClass,
  gridTableClass,
} from "../lib/grid-styles";
import {
  pinPlaygroundCell,
  usePlaygroundPinnedLayout,
} from "../lib/playground-row-index-gutter";
import {
  neutralTanStackRowFillClass,
  playgroundTanStackRowStripeData,
  useNeutralPlaygroundTable,
} from "../lib/playground-neutral-table";
import { EngineScrollTableShell, useEngineScrollViewport } from "../parity/engine-scroll-table-shell";
import { WIDE_HUB_ROWS, type WideHubRow } from "../parity/parity-wide-mock-data";

const columnHelper = createColumnHelper<WideHubRow>();
const columns = [
  columnHelper.accessor("id", { header: "ID", size: 56 }),
  columnHelper.accessor("name", { header: "Name", size: 140 }),
  columnHelper.accessor("region", { header: "Region", size: 72 }),
  columnHelper.accessor("revenue", {
    header: () => <span className="w-full text-right">Revenue</span>,
    cell: (i) => <span className={gridNumericClass}>{i.getValue()}</span>,
    size: 96,
  }),
  columnHelper.accessor("headcount", { header: "HC", size: 64 }),
  columnHelper.accessor("marginPct", { header: "Margin %", size: 80 }),
  columnHelper.accessor("product", { header: "Product", size: 96 }),
  columnHelper.accessor("tier", { header: "Tier", size: 80 }),
  columnHelper.accessor("support", { header: "Support", size: 88 }),
  columnHelper.accessor("contractEnd", { header: "Contract end", size: 108 }),
];

export function TanstackPinningDemo() {
  const { tokens } = useNeutralPlaygroundTable();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
    left: ["id", "name"],
  });
  const { viewportRef, scrolledX } = useEngineScrollViewport(true);

  const table = useReactTable(
    withCoreSorting({
      data: WIDE_HUB_ROWS,
      columns,
      state: { sorting, columnPinning },
      onSortingChange: setSorting,
      onColumnPinningChange: setColumnPinning,
      getRowId: (r) => r.id,
    }),
  );

  const pinnedLayout = usePlaygroundPinnedLayout({ table, fromColumnPinning: true });
  const leafColumns = table.getVisibleLeafColumns();

  const pinToggle = useMemo(
    () => (
      <div className="flex flex-wrap gap-2 shrink-0">
        {leafColumns.map((col) => {
          const pinned = col.getIsPinned();
          return (
            <Button
              key={col.id}
              variant={pinned ? "default" : "outline"}
              size="sm"
              onClick={() => col.pin(pinned ? false : "left")}
            >
              {col.id}
              {pinned ? " (pinned)" : ""}
            </Button>
          );
        })}
      </div>
    ),
    [leafColumns],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {pinToggle}
      <EngineScrollTableShell viewportRef={viewportRef}>
        <table className={gridTableClass} style={{ width: table.getTotalSize() }}>
          <colgroup>
            {leafColumns.map((col) => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>
          <thead className={gridHeaderClass}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const pin = pinPlaygroundCell({
                    pinnedLayout,
                    columnId: header.column.id,
                    variant: "head",
                    scrolledX,
                  });
                  return (
                    <th
                      key={header.id}
                      className={cn(gridHeadCellClass, pin.className, !pin.style && "bg-card")}
                      style={pin.style}
                      {...(pin["data-pinned"] ? { "data-pinned": true as const } : {})}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className={gridBodyHoverClass}>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(gridRowClass, neutralTanStackRowFillClass(tokens, row.index))}
                {...playgroundTanStackRowStripeData(tokens, row.index)}
              >
                {row.getVisibleCells().map((cell) => {
                  const pin = pinPlaygroundCell({
                    pinnedLayout,
                    columnId: cell.column.id,
                    variant: "body",
                    scrolledX,
                    rowFillTokens: tokens,
                    rowIndex: row.index,
                  });
                  return (
                    <td
                      key={cell.id}
                      className={cn(gridCellClass, pin.className)}
                      style={pin.style}
                      {...(pin["data-pinned"] ? { "data-pinned": true as const } : {})}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </EngineScrollTableShell>
    </div>
  );
}
