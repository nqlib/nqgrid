import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  useReactTable,
  type ExpandedState,
  type GroupingState,
} from "@tanstack/react-table";
import { Button, cn } from "@nqlib/nqui";
import {
  getOutlineRowIndentStyle,
  useOutlineRowExpansion,
  withCoreSortingGroupedExpanded,
} from "@nqlib/nqgrid";
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
  gridNumericClass,
  gridRowClass,
  gridTableClass,
} from "../lib/grid-styles";
import { EngineScrollTableShell } from "../parity/engine-scroll-table-shell";

type OutlineDealRow = {
  id: string;
  region: string;
  stage: string;
  owner: string;
  amount: number;
};

const DATA: OutlineDealRow[] = [
  { id: "r1", region: "East", stage: "Won", owner: "Ana", amount: 12000 },
  { id: "r2", region: "East", stage: "Won", owner: "Ben", amount: 8000 },
  { id: "r3", region: "East", stage: "Open", owner: "Cara", amount: 9000 },
  { id: "r4", region: "West", stage: "Won", owner: "Dan", amount: 15000 },
  { id: "r5", region: "West", stage: "Open", owner: "Eli", amount: 6000 },
  { id: "r6", region: "West", stage: "Lost", owner: "Eli", amount: 3000 },
  { id: "r7", region: "North", stage: "Won", owner: "Fay", amount: 11000 },
  { id: "r8", region: "North", stage: "Open", owner: "Fay", amount: 7000 },
];

const columnHelper = createColumnHelper<OutlineDealRow>();

const numberFormat = new Intl.NumberFormat("en-US");

export function RowOutlineExpansionDemo() {
  const { tokens } = useNeutralPlaygroundTable();
  const [grouping] = useState<GroupingState>(["region", "stage"]);
  const [expanded, setExpanded] = useState<ExpandedState>(true);

  const outline = useOutlineRowExpansion({ expanded, onExpandedChange: setExpanded });

  const columns = useMemo(
    () => [
      columnHelper.accessor("region", { header: "Region", enableGrouping: true, size: 120 }),
      columnHelper.accessor("stage", { header: "Stage", enableGrouping: true, size: 100 }),
      columnHelper.accessor("owner", { header: "Owner", size: 100 }),
      columnHelper.accessor("amount", {
        header: "Amount",
        size: 110,
        aggregationFn: "sum",
        cell: (info) => numberFormat.format(info.getValue()),
        aggregatedCell: (info) => `Σ ${numberFormat.format(info.getValue<number>())}`,
      }),
    ],
    [],
  );

  const table = useReactTable(
    withCoreSortingGroupedExpanded({
      data: DATA,
      columns,
      state: { grouping, expanded },
      onExpandedChange: setExpanded,
      getRowId: (r) => r.id,
    }),
  );

  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        TanStack grouped rows wired to the row-outline expansion API: expand or
        collapse every group, or a single outline level, with amount summed per
        group.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={outline.expandAll}>
          Expand all
        </Button>
        <Button size="sm" variant="outline" onClick={outline.collapseAll}>
          Collapse all
        </Button>
        <Button size="sm" variant="outline" onClick={() => outline.setLevelExpanded(rows, 0, true)}>
          Expand level 0
        </Button>
        <Button size="sm" variant="outline" onClick={() => outline.setLevelExpanded(rows, 1, true)}>
          Expand level 1
        </Button>
      </div>
      <EngineScrollTableShell className="max-h-[min(50dvh,420px)]">
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
                  <th
                    key={h.id}
                    className={cn(
                      gridHeadCellClass,
                      h.column.id === "amount" && gridNumericClass,
                    )}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className={gridBodyHoverClass}>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  gridRowClass,
                  neutralTanStackRowFillClass(tokens, row.index),
                  row.getIsGrouped() && "font-medium",
                )}
                {...playgroundTanStackRowStripeData(tokens, row.index)}
              >
                {row.getVisibleCells().map((cell) => {
                  const isGroupAnchor = row.getIsGrouped() && cell.column.id === grouping[row.depth];
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        gridCellClass,
                        cell.column.id === "amount" && gridNumericClass,
                      )}
                      style={isGroupAnchor ? getOutlineRowIndentStyle(row.depth) : undefined}
                    >
                      {isGroupAnchor ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={row.getToggleExpandedHandler()}
                        >
                          {row.getIsExpanded() ? "▾" : "▸"}{" "}
                          {flexRender(cell.column.columnDef.cell, cell.getContext())} (
                          {row.subRows.length})
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
