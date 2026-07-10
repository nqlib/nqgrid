import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  useReactTable,
  getCoreRowModel,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  buildColumnOutlineGroups,
  columnOutlineToVisibility,
  flattenOutlineHeaderRows,
  toggleOutlineGroup,
  type ColumnOutlineNode,
} from "@nqlib/nqgrid";
import { Button, cn } from "@nqlib/nqui";
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

type SalesRow = { id: string; janA: number; janB: number; febA: number; febB: number; q2A: number; q2B: number };

const columnHelper = createColumnHelper<SalesRow>();

const OUTLINE_TREE: readonly ColumnOutlineNode[] = [
  {
    id: "q1",
    label: "Q1",
    children: [
      {
        id: "jan",
        label: "Jan",
        children: [
          { id: "jan-a", label: "Rev", leafColumnIds: ["janA"] },
          { id: "jan-b", label: "Cost", leafColumnIds: ["janB"] },
        ],
      },
      {
        id: "feb",
        label: "Feb",
        children: [
          { id: "feb-a", label: "Rev", leafColumnIds: ["febA"] },
          { id: "feb-b", label: "Cost", leafColumnIds: ["febB"] },
        ],
      },
    ],
  },
  {
    id: "q2",
    label: "Q2",
    children: [
      { id: "q2-a", label: "Rev", leafColumnIds: ["q2A"] },
      { id: "q2-b", label: "Cost", leafColumnIds: ["q2B"] },
    ],
  },
];

const ALL_LEAF_IDS = ["janA", "janB", "febA", "febB", "q2A", "q2B"] as const;

const DATA: SalesRow[] = [
  { id: "1", janA: 10, janB: 4, febA: 12, febB: 5, q2A: 8, q2B: 3 },
  { id: "2", janA: 20, janB: 9, febA: 18, febB: 7, q2A: 15, q2B: 6 },
];

const OUTLINE_BUTTON_IDS = ["q1", "jan", "feb", "q2"] as const;

export function ColumnOutlineDemo() {
  const { tokens } = useNeutralPlaygroundTable();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const groups = useMemo(() => buildColumnOutlineGroups(OUTLINE_TREE), []);

  const columnVisibility = useMemo(
    (): VisibilityState =>
      columnOutlineToVisibility(ALL_LEAF_IDS, groups, collapsed),
    [groups, collapsed],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("janA", { header: "Jan Rev", size: 72 }),
      columnHelper.accessor("janB", { header: "Jan Cost", size: 72 }),
      columnHelper.accessor("febA", { header: "Feb Rev", size: 72 }),
      columnHelper.accessor("febB", { header: "Feb Cost", size: 72 }),
      columnHelper.accessor("q2A", { header: "Q2 Rev", size: 72 }),
      columnHelper.accessor("q2B", { header: "Q2 Cost", size: 72 }),
    ],
    [],
  );

  const table = useReactTable({
    data: DATA,
    columns,
    state: { columnVisibility },
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
  });

  const headerRows = flattenOutlineHeaderRows(OUTLINE_TREE, collapsed);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Excel-style column outline: collapse groups to show a single summary column per band.
      </p>
      <div className="flex flex-wrap gap-2">
        {OUTLINE_BUTTON_IDS.map((id) => (
          <Button
            key={id}
            size="sm"
            variant={collapsed.has(id) ? "default" : "outline"}
            onClick={() => setCollapsed((prev) => toggleOutlineGroup(prev, id))}
          >
            {collapsed.has(id) ? "+" : "−"} {id}
          </Button>
        ))}
      </div>
      <EngineScrollTableShell className="max-h-[min(40dvh,280px)]">
        <table className={gridTableClass}>
          <thead className={gridHeaderClass}>
            {headerRows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell) => (
                  <th key={cell.id} colSpan={cell.colSpan} className={gridHeadCellClass}>
                    {cell.label}
                  </th>
                ))}
              </tr>
            ))}
            <tr>
              {table.getVisibleLeafColumns().map((col) => (
                <th key={col.id} className={gridHeadCellClass}>
                  {col.columnDef.header as string}
                </th>
              ))}
            </tr>
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
    </div>
  );
}
