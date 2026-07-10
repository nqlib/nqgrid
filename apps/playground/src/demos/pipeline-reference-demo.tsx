import { useState } from "react";
import {
  createColumnHelper,
  flexRender,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { cn } from "@nqlib/nqui";
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
import { WIDE_PIPELINE_ROWS, type WidePipelineRow } from "../parity/parity-wide-mock-data";

const PINNED_LEFT_IDS = ["id", "name"] as const;
const columnHelper = createColumnHelper<WidePipelineRow>();

const columns = [
  columnHelper.accessor("id", { header: "#", size: 48 }),
  columnHelper.accessor("name", { header: "Account", size: 200 }),
  columnHelper.accessor("score", {
    header: () => <span className="w-full text-right">Score</span>,
    cell: (info) => <span className={gridNumericClass}>{info.getValue()}</span>,
    size: 72,
  }),
  columnHelper.accessor("stage", { header: "Stage", size: 96 }),
  columnHelper.accessor("owner", { header: "Owner", size: 88 }),
  columnHelper.accessor("region", { header: "Region", size: 72 }),
  columnHelper.accessor("sector", { header: "Sector", size: 96 }),
  columnHelper.accessor("arrK", {
    header: () => <span className="w-full text-right">ARR (k)</span>,
    cell: (info) => <span className={gridNumericClass}>{info.getValue()}</span>,
    size: 88,
  }),
  columnHelper.accessor("mrrK", {
    header: () => <span className="w-full text-right">MRR (k)</span>,
    cell: (info) => <span className={gridNumericClass}>{info.getValue()}</span>,
    size: 80,
  }),
  columnHelper.accessor("health", { header: "Health", size: 88 }),
  columnHelper.accessor("lastTouch", { header: "Last touch", size: 108 }),
  columnHelper.accessor("nextStep", { header: "Next step", size: 160 }),
];

export function PipelineReferenceDemo() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }]);
  const { viewportRef, scrolledX } = useEngineScrollViewport(true);
  const { tokens } = useNeutralPlaygroundTable();

  const table = useReactTable(
    withCoreSorting({
      data: WIDE_PIPELINE_ROWS,
      columns,
      state: { sorting },
      onSortingChange: setSorting,
      getRowId: (r) => r.id,
    }),
  );

  const leafColumns = table.getVisibleLeafColumns();
  const pinnedLayout = usePlaygroundPinnedLayout({
    table,
    dataPinnedLeftIds: PINNED_LEFT_IDS,
  });

  return (
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
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
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
                const id = cell.column.id;
                const pin = pinPlaygroundCell({
                  pinnedLayout,
                  columnId: id,
                  variant: "body",
                  scrolledX,
                  rowFillTokens: tokens,
                  rowIndex: row.index,
                });
                const numeric = ["score", "arrK", "mrrK"].includes(id);
                return (
                  <td
                    key={cell.id}
                    className={cn(gridCellClass, numeric && gridNumericClass, pin.className)}
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
  );
}
