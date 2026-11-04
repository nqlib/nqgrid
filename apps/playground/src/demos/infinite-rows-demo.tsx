import { useEffect, useMemo } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { cn } from "@nqlib/nqui";
import { useInfiniteVisibleRows } from "@nqlib/nqgrid";
import {
  neutralTanStackRowFillClass,
  playgroundTanStackRowStripeData,
  useNeutralPlaygroundTable,
} from "../lib/playground-neutral-table";
import {
  gridBodyHoverClass,
  gridCellClass,
  gridHeadCellClass,
  gridHeaderClass,
  gridRowClass,
  gridTableClass,
} from "../lib/grid-styles";
import { EngineScrollTableShell, useEngineScrollViewport } from "../parity/engine-scroll-table-shell";

type Row = { id: string; label: string };

const columnHelper = createColumnHelper<Row>();

export function InfiniteRowsDemo() {
  const { tokens } = useNeutralPlaygroundTable();
  const items = useMemo(
    () => Array.from({ length: 400 }, (_, i) => ({ id: String(i), label: `Row ${i + 1}` })),
    [],
  );
  const { viewportRef, scrollRoot } = useEngineScrollViewport();

  const { visibleRows, sentinelRef, hasMore, resetVisibleRows } = useInfiniteVisibleRows(
    items,
    20,
    40,
    scrollRoot,
  );

  useEffect(() => {
    resetVisibleRows();
  }, [resetVisibleRows]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", { header: "#", size: 64 }),
      columnHelper.accessor("label", { header: "Label", size: 240 }),
    ],
    [],
  );

  const table = useReactTable({
    data: visibleRows,
    columns,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <EngineScrollTableShell viewportRef={viewportRef} className="max-h-[min(50dvh,360px)]">
      <table className={gridTableClass} style={{ width: table.getTotalSize() }}>
        <colgroup>
          {table.getVisibleLeafColumns().map((col) => (
            <col key={col.id} style={{ width: col.getSize() }} />
          ))}
        </colgroup>
        <thead className={gridHeaderClass}>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className={gridHeadCellClass}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
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
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={gridCellClass}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore ? <div ref={sentinelRef} className="h-2 shrink-0" aria-hidden /> : null}
    </EngineScrollTableShell>
  );
}
