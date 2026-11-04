import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  useReactTable,
  type ExpandedState,
  type GroupingState,
} from "@tanstack/react-table";
import { Button, cn } from "@nqlib/nqui";
import { getOutlineRowIndentStyle, withCoreSortingGroupedExpanded } from "@nqlib/nqgrid";
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

export type GroupingDemoRow = { id: string; country: string; city: string; units: number };

const columnHelper = createColumnHelper<GroupingDemoRow>();

export function GroupingDemo({ data }: { data: GroupingDemoRow[] }) {
  const { tokens } = useNeutralPlaygroundTable();
  const [grouping, setGrouping] = useState<GroupingState>(["country"]);
  const [expanded, setExpanded] = useState<ExpandedState>(true);

  const columns = useMemo(
    () => [
      columnHelper.accessor("country", { header: "Country", enableGrouping: true, size: 96 }),
      columnHelper.accessor("city", { header: "City", size: 96 }),
      columnHelper.accessor("units", {
        header: "Units",
        size: 72,
        aggregationFn: "sum",
        aggregatedCell: (info) => `Σ ${info.getValue()}`,
      }),
    ],
    [],
  );

  const table = useReactTable(
    withCoreSortingGroupedExpanded({
      data,
      columns,
      state: { grouping, expanded },
      onGroupingChange: setGrouping,
      onExpandedChange: setExpanded,
      groupedColumnMode: "reorder",
      getRowId: (r) => r.id,
    }),
  );

  return (
    <EngineScrollTableShell className="max-h-[min(50dvh,360px)]">
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
                <td
                  key={cell.id}
                  className={gridCellClass}
                  style={row.getIsGrouped() ? getOutlineRowIndentStyle(row.depth) : undefined}
                >
                  {row.getIsGrouped() && cell.column.id === "country" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={row.getToggleExpandedHandler()}
                    >
                      {row.getIsExpanded() ? "▼" : "▶"}{" "}
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Button>
                  ) : row.getIsGrouped() ? (
                    flexRender(
                      cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell,
                      cell.getContext(),
                    )
                  ) : (
                    flexRender(cell.column.columnDef.cell, cell.getContext())
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </EngineScrollTableShell>
  );
}
