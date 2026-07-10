import { useCallback, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { cn } from "@nqlib/nqui";
import { useCellKeyboardTable } from "@nqlib/nqgrid";
import {
  gridBodyHoverClass,
  gridCellClass,
  gridHeadCellClass,
  gridHeaderClass,
  gridRowClass,
  gridTableClass,
} from "../lib/grid-styles";
import {
  neutralTanStackRowFillClass,
  playgroundTanStackRowStripeData,
  useNeutralPlaygroundTable,
} from "../lib/playground-neutral-table";
import { EngineScrollTableShell } from "../parity/engine-scroll-table-shell";

type Row = { id: string; sku: string };
const helper = createColumnHelper<Row>();

export function KeyboardCellDemo({ data }: { data: Row[] }) {
  const { tokens, bundle } = useNeutralPlaygroundTable();
  const [active, setActive] = useState<{ rowIndex: number; columnId: string } | null>({
    rowIndex: 0,
    columnId: "sku",
  });

  const columns = useMemo(
    () => [
      helper.accessor("id", { header: "ID", cell: (i) => i.getValue() }),
      helper.accessor("sku", { header: "SKU", cell: (i) => i.getValue() }),
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
  });

  const columnIds = table.getVisibleLeafColumns().map((c) => c.id);
  const { onKeyDown } = useCellKeyboardTable({
    table,
    columnIds,
    active,
    onActiveChange: setActive,
  });

  const isActive = useCallback(
    (rowIndex: number, columnId: string) =>
      active?.rowIndex === rowIndex && active?.columnId === columnId,
    [active],
  );

  return (
    <EngineScrollTableShell
      className="max-h-[min(40dvh,320px)]"
      footer={
        <p className="w-full text-xs text-muted-foreground">Focus the grid and use arrow keys.</p>
      }
    >
      <div
        tabIndex={0}
        role="grid"
        onKeyDown={onKeyDown}
        aria-label="Keyboard navigation demo"
        className="outline-none"
      >
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
            {table.getRowModel().rows.map((row, rowIndex) => (
              <tr
                key={row.id}
                className={cn(
                  gridRowClass,
                  neutralTanStackRowFillClass(tokens, rowIndex),
                )}
                {...playgroundTanStackRowStripeData(tokens, rowIndex)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      gridCellClass,
                      isActive(rowIndex, cell.column.id) && bundle.cellFocus,
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </EngineScrollTableShell>
  );
}
