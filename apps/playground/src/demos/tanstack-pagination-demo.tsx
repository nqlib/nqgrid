import { useState } from "react";
import {
  createColumnHelper,
  flexRender,
  useReactTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { Button, cn, ToggleGroup, ToggleGroupItem } from "@nqlib/nqui";
import { withCoreSortingPaginated } from "@nqlib/nqgrid";
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
import { SortableColumnHeader } from "../lib/sortable-column-header";
import { EngineScrollTableShell } from "../parity/engine-scroll-table-shell";

type Row = {
  id: string;
  label: string;
  amount: number;
  category: string;
  owner: string;
  region: string;
  status: string;
};

const DATA: Row[] = Array.from({ length: 47 }, (_, i) => ({
  id: String(i + 1),
  label: `Row ${i + 1}`,
  amount: (i + 1) * 10,
  category: i % 2 === 0 ? "Ops" : "Sales",
  owner: i % 3 === 0 ? "Sam" : "Jo",
  region: i % 2 === 0 ? "NA" : "EU",
  status: i % 4 === 0 ? "Closed" : "Open",
}));

const columnHelper = createColumnHelper<Row>();
const columns = [
  columnHelper.accessor("label", { header: "Label", size: 140 }),
  columnHelper.accessor("category", { header: "Category", size: 96 }),
  columnHelper.accessor("amount", { header: "Amount", size: 88 }),
  columnHelper.accessor("owner", { header: "Owner", size: 88 }),
  columnHelper.accessor("region", { header: "Region", size: 72 }),
  columnHelper.accessor("status", { header: "Status", size: 88 }),
];

const PAGE_SIZES = [5, 10, 20] as const;

export function TanstackPaginationDemo() {
  const { tokens } = useNeutralPlaygroundTable();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const table = useReactTable(
    withCoreSortingPaginated({
      data: DATA,
      columns,
      state: { sorting, pagination },
      onSortingChange: setSorting,
      onPaginationChange: setPagination,
      getRowId: (r) => r.id,
    }),
  );

  return (
    <EngineScrollTableShell
      className="max-h-[min(50dvh,420px)]"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <ToggleGroup
            type="single"
            value={String(pagination.pageSize)}
            onValueChange={(v) => {
              if (v) setPagination((p) => ({ ...p, pageSize: Number(v), pageIndex: 0 }));
            }}
            variant="outline"
            size="sm"
          >
            {PAGE_SIZES.map((n) => (
              <ToggleGroupItem key={n} value={String(n)}>
                {n} per page
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      }
    >
      <table className={gridTableClass} style={{ width: table.getTotalSize(), tableLayout: "fixed" }}>
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
    </EngineScrollTableShell>
  );
}
