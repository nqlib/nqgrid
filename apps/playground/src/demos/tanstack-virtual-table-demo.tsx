import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  getVirtualTableRowStyle,
  useTableRowVirtualizer,
  withCoreSorting,
} from "@nqlib/nqgrid";
import { cn } from "@nqlib/nqui";
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
  NEUTRAL_TABLE_ROW_HEIGHT_PX,
  neutralTanStackRowFillClass,
  playgroundTanStackRowStripeData,
  useNeutralPlaygroundTable,
} from "../lib/playground-neutral-table";
import { SortableColumnHeader } from "../lib/sortable-column-header";
import { EngineScrollTableShell, useEngineScrollViewport } from "../parity/engine-scroll-table-shell";

type Row = {
  id: string;
  sku: string;
  name: string;
  value: number;
  warehouse: string;
  lane: string;
  batch: string;
};

const columnHelper = createColumnHelper<Row>();

export function TanstackVirtualTableDemo() {
  const { tokens } = useNeutralPlaygroundTable();
  const { viewportRef, scrollRoot } = useEngineScrollViewport();
  const [sorting, setSorting] = useState<SortingState>([{ id: "value", desc: false }]);

  const data = useMemo(
    () =>
      Array.from({ length: 5000 }, (_, i) => ({
        id: String(i + 1),
        sku: `SKU-${1000 + i}`,
        name: `Item ${i + 1}`,
        value: i % 100,
        warehouse: i % 3 === 0 ? "East" : i % 3 === 1 ? "Central" : "West",
        lane: `L-${(i % 12) + 1}`,
        batch: `B-${Math.floor(i / 50)}`,
      })),
    [],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", { header: "ID", size: 72 }),
      columnHelper.accessor("sku", { header: "SKU", size: 108 }),
      columnHelper.accessor("name", { header: "Name", size: 160 }),
      columnHelper.accessor("value", {
        header: () => <span className="w-full text-right">Value</span>,
        cell: (i) => <span className={gridNumericClass}>{i.getValue()}</span>,
        size: 80,
      }),
      columnHelper.accessor("warehouse", { header: "WH", size: 88 }),
      columnHelper.accessor("lane", { header: "Lane", size: 64 }),
      columnHelper.accessor("batch", { header: "Batch", size: 72 }),
    ],
    [],
  );

  const table = useReactTable(
    withCoreSorting({
      data,
      columns,
      state: { sorting },
      onSortingChange: setSorting,
      getRowId: (r) => r.id,
    }),
  );

  const tableTotalWidth = table.getTotalSize();
  const { virtualRows, totalSize, measureElement } = useTableRowVirtualizer({
    table,
    scrollElement: scrollRoot,
    estimateSize: NEUTRAL_TABLE_ROW_HEIGHT_PX,
    overscan: 8,
  });

  const rows = table.getRowModel().rows;

  return (
    <EngineScrollTableShell viewportRef={viewportRef} className="max-h-[min(60dvh,480px)]">
      <table className={gridTableClass} style={{ width: tableTotalWidth }}>
        <colgroup>
          {table.getVisibleLeafColumns().map((col) => (
            <col key={col.id} style={{ width: col.getSize() }} />
          ))}
        </colgroup>
        <thead className={gridHeaderClass}>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className={gridHeadCellClass} style={{ width: h.getSize() }}>
                  {h.column.getCanSort() ? (
                    <SortableColumnHeader header={h} />
                  ) : (
                    flexRender(h.column.columnDef.header, h.getContext())
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody
          className={gridBodyHoverClass}
          style={{ height: totalSize, position: "relative", display: "block", width: tableTotalWidth }}
        >
          {virtualRows.map((vr) => {
            const row = rows[vr.index]!;
            return (
              <tr
                key={row.id}
                data-index={vr.index}
                ref={measureElement}
                className={cn(gridRowClass, neutralTanStackRowFillClass(tokens, row.index))}
                {...playgroundTanStackRowStripeData(tokens, row.index)}
                style={getVirtualTableRowStyle(vr.start, tableTotalWidth)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={gridCellClass}
                    style={{ flex: `0 0 ${cell.column.getSize()}px`, width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </EngineScrollTableShell>
  );
}
