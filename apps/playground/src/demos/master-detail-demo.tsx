import { Fragment, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  useReactTable,
  type ExpandedState,
} from "@tanstack/react-table";
import { Button, cn } from "@nqlib/nqui";
import { withCoreSortingExpanded } from "@nqlib/nqgrid";
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
import { EngineScrollTableShell } from "../parity/engine-scroll-table-shell";

type MasterRow = { id: string; title: string };

const columnHelper = createColumnHelper<MasterRow>();

export function MasterDetailDemo() {
  const { tokens } = useNeutralPlaygroundTable();
  const [data] = useState<MasterRow[]>(() => [
    { id: "a", title: "Row A" },
    { id: "b", title: "Row B" },
  ]);
  const [expanded, setExpanded] = useState<ExpandedState>({ b: true });

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "expand",
        header: "",
        size: 88,
        cell: ({ row }) => (
          <Button type="button" size="sm" variant="outline" onClick={row.getToggleExpandedHandler()}>
            {row.getIsExpanded() ? "Collapse" : "Expand"}
          </Button>
        ),
      }),
      columnHelper.accessor("title", { header: "Title", size: 200 }),
    ],
    [],
  );

  const table = useReactTable(
    withCoreSortingExpanded({
      data,
      columns,
      state: { expanded },
      onExpandedChange: setExpanded,
      getRowCanExpand: () => true,
      getRowId: (r) => r.id,
    }),
  );

  const colSpan = table.getVisibleLeafColumns().length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        TanStack <code className="rounded bg-muted px-1">expanded</code> state with synthetic detail rows rendered
        below each expanded master.
      </p>
      <EngineScrollTableShell className="max-h-[min(40dvh,320px)]">
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
              <Fragment key={row.id}>
                <tr
                  className={cn(gridRowClass, neutralTanStackRowFillClass(tokens, row.index))}
                  {...playgroundTanStackRowStripeData(tokens, row.index)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={gridCellClass}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() ? (
                  <tr className={gridRowClass}>
                    <td colSpan={colSpan} className="bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      Detail for {row.original.title}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </EngineScrollTableShell>
      <p className="text-xs text-muted-foreground">
        Rows rendered: {table.getRowModel().rows.length} masters
        {table.getRowModel().rows.some((r) => r.getIsExpanded()) ? " + detail rows" : ""}.
      </p>
    </div>
  );
}
