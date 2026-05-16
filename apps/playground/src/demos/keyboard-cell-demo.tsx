import { useCallback, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ScrollArea, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@nqlib/nqui";
import {
  tableCellClass,
  tableDenseTypography,
  tableHeaderClass,
  tableHeadClass,
  tableRowClass,
  tableScrollAreaContentClass,
  tableScrollAreaRootClass,
  tableScrollViewportStyle,
  tableShellClass,
  useCellKeyboardTable,
} from "@nqlib/nqgrid";
import { usePlaygroundTableBodyClass } from "../playground-table-settings";

type Row = { id: string; sku: string };

const helper = createColumnHelper<Row>();

export function KeyboardCellDemo({ data }: { data: Row[] }) {
  const [active, setActive] = useState<{ rowIndex: number; columnId: string } | null>({
    rowIndex: 0,
    columnId: "sku",
  });
  const tableBodyClassName = usePlaygroundTableBodyClass();

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
    <div className={cn(tableShellClass, "min-h-[16rem] max-h-[320px]")}>
      <ScrollArea
        orientation="horizontal"
        fadeMask={false}
        className={tableScrollAreaRootClass}
        viewportStyle={tableScrollViewportStyle}
      >
        <div
          className={tableScrollAreaContentClass}
          tabIndex={0}
          role="grid"
          onKeyDown={onKeyDown}
          aria-label="Keyboard navigation demo"
        >
          <table className={tableDenseTypography}>
            <TableHeader className={tableHeaderClass}>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className={tableRowClass}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id} className={tableHeadClass}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className={tableBodyClassName}>
              {table.getRowModel().rows.map((row, rowIndex) => (
                <TableRow key={row.id} className={tableRowClass}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        tableCellClass,
                        isActive(rowIndex, cell.column.id) && "bg-accent/60 outline outline-1 outline-primary/40",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      </ScrollArea>
      <p className="border-t px-4 py-2 text-xs text-muted-foreground">Focus the grid and use arrow keys.</p>
    </div>
  );
}
