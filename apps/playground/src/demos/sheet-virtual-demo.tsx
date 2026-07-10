import { useCallback, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  useReactTable,
  type ColumnPinningState,
} from "@tanstack/react-table";
import {
  useTableRowVirtualizer,
  getVirtualTableRowStyle,
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
  pinPlaygroundCell,
  usePlaygroundPinnedLayout,
} from "../lib/playground-row-index-gutter";
import {
  NEUTRAL_TABLE_ROW_HEIGHT_PX,
  neutralTanStackRowFillClass,
  playgroundTanStackRowStripeData,
  useNeutralPlaygroundTable,
} from "../lib/playground-neutral-table";
import { EngineScrollTableShell, useEngineScrollViewport } from "../parity/engine-scroll-table-shell";

const ROW_COUNT = 4000;
const COLUMN_COUNT = 80;
const FROZEN_COUNT = 2;

type SheetRow = { index: number };

const columnHelper = createColumnHelper<SheetRow>();

export function SheetVirtualDemo() {
  const { tokens } = useNeutralPlaygroundTable();
  const [seed] = useState(() => Date.now());
  const { viewportRef, scrollRoot, scrolledX } = useEngineScrollViewport(true);
  const [columnPinning] = useState<ColumnPinningState>({
    left: Array.from({ length: FROZEN_COUNT }, (_, i) => `c${i}`),
  });

  const getCellValue = useCallback(
    (row: number, col: number) => {
      const v = ((row * 31 + col * 17 + seed) % 997) / 10;
      return v.toFixed(1);
    },
    [seed],
  );

  const stubData = useMemo(
    () => Array.from({ length: ROW_COUNT }, (_, index) => ({ index })),
    [],
  );

  const columns = useMemo(
    () =>
      Array.from({ length: COLUMN_COUNT }, (_, col) =>
        columnHelper.display({
          id: `c${col}`,
          header: col < FROZEN_COUNT ? `F${col + 1}` : String(col + 1),
          size: col < FROZEN_COUNT ? 56 : 72,
          cell: ({ row }) => (
            <span className={gridNumericClass}>{getCellValue(row.original.index, col)}</span>
          ),
        }),
      ),
    [getCellValue],
  );

  const table = useReactTable(
    withCoreSorting({
      data: stubData,
      columns,
      state: { columnPinning },
      getRowId: (r) => String(r.index),
    }),
  );

  const pinnedLayout = usePlaygroundPinnedLayout({ table, fromColumnPinning: true });
  const leafColumns = table.getVisibleLeafColumns();

  const { virtualRows, totalSize, measureElement } = useTableRowVirtualizer({
    table,
    scrollElement: scrollRoot,
    estimateSize: NEUTRAL_TABLE_ROW_HEIGHT_PX,
    overscan: 8,
  });

  const rows = table.getRowModel().rows;

  const tableTotalWidth = table.getTotalSize();

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        TanStack Table + row virtualizer over 4k × 80 cells. First two columns stay pinned left (frozen).
      </p>
      <EngineScrollTableShell viewportRef={viewportRef} className="max-h-[min(55dvh,440px)]">
        <table className={gridTableClass} style={{ width: tableTotalWidth }}>
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
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
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
                  className={cn(
                    gridRowClass,
                    neutralTanStackRowFillClass(tokens, row.original.index),
                  )}
                  {...playgroundTanStackRowStripeData(tokens, row.original.index)}
                  style={getVirtualTableRowStyle(vr.start, tableTotalWidth)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const pin = pinPlaygroundCell({
                      pinnedLayout,
                      columnId: cell.column.id,
                      variant: "body",
                      scrolledX,
                      rowFillTokens: tokens,
                      rowIndex: row.original.index,
                    });
                    return (
                      <td
                        key={cell.id}
                        className={cn(gridCellClass, pin.className)}
                        style={{
                          ...pin.style,
                          flex: `0 0 ${cell.column.getSize()}px`,
                          width: cell.column.getSize(),
                        }}
                        {...(pin["data-pinned"] ? { "data-pinned": true as const } : {})}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </EngineScrollTableShell>
    </div>
  );
}
