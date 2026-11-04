import { useCallback, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  useReactTable,
  type ColumnPinningState,
  type RowPinningState,
} from "@tanstack/react-table";
import {
  createFreezePanesState,
  getBottomPinnedRowStyle,
  getFrozenRowStickyStyle,
  getVirtualTableRowStyle,
  pinRowTop,
  unpinRow,
  useFrozenTableColumns,
  useTableRowSections,
  useTableRowVirtualizer,
  withFreezePanesSupport,
} from "@nqlib/nqgrid";
import { Button, cn } from "@nqlib/nqui";
import {
  gridBodyHoverClass,
  gridCellClass,
  gridHeadCellClass,
  gridHeaderClass,
  gridNumericClass,
  gridRowClass,
  gridTableClass,
} from "../lib/grid-styles";
import { pinPlaygroundFreezeCell } from "../lib/playground-row-index-gutter";
import {
  NEUTRAL_TABLE_HEADER_HEIGHT_PX,
  NEUTRAL_TABLE_ROW_HEIGHT_PX,
  neutralTanStackRowFillClass,
  playgroundTanStackRowStripeData,
  useNeutralPlaygroundTable,
} from "../lib/playground-neutral-table";
import { EngineScrollTableShell, useEngineScrollViewport } from "../parity/engine-scroll-table-shell";

const ROW_COUNT = 2000;
const COLUMN_COUNT = 40;
const FROZEN_COL_COUNT = 2;
const FROZEN_BODY_ROW_COUNT = 2;
const ROW_H = NEUTRAL_TABLE_ROW_HEIGHT_PX;
const HEADER_H = NEUTRAL_TABLE_HEADER_HEIGHT_PX;

type SheetRow = { index: number; label: string };

const columnHelper = createColumnHelper<SheetRow>();

export function FreezePanesVirtualDemo() {
  const { tokens } = useNeutralPlaygroundTable();
  const [seed] = useState(() => Date.now());
  const { viewportRef, scrollRoot, scrolledX } = useEngineScrollViewport(true);
  const freezePanes = useMemo(
    () =>
      createFreezePanesState({
        frozenLeftColumnIds: Array.from({ length: FROZEN_COL_COUNT }, (_, i) => `c${i}`),
        frozenTopBodyRowCount: FROZEN_BODY_ROW_COUNT,
        headerRowCount: 1,
      }),
    [],
  );
  const [columnPinning] = useState<ColumnPinningState>({
    left: [...freezePanes.frozenLeftColumnIds],
  });
  const [rowPinning, setRowPinning] = useState<RowPinningState>({ top: [], bottom: [] });

  const getCellValue = useCallback(
    (row: number, col: number) => {
      const v = ((row * 31 + col * 17 + seed) % 997) / 10;
      return v.toFixed(1);
    },
    [seed],
  );

  const stubData = useMemo(
    () =>
      Array.from({ length: ROW_COUNT }, (_, index) => ({
        index,
        label: `Row ${index}`,
      })),
    [],
  );

  const columns = useMemo(
    () =>
      Array.from({ length: COLUMN_COUNT }, (_, col) =>
        columnHelper.display({
          id: `c${col}`,
          header: col < FROZEN_COL_COUNT ? `F${col + 1}` : String(col + 1),
          size: col < FROZEN_COL_COUNT ? 56 : 72,
          cell: ({ row }) => (
            <span className={gridNumericClass}>
              {col === 0 ? row.original.label : getCellValue(row.original.index, col)}
            </span>
          ),
        }),
      ),
    [getCellValue],
  );

  const table = useReactTable(
    withFreezePanesSupport({
      data: stubData,
      columns,
      state: { columnPinning, rowPinning },
      onRowPinningChange: setRowPinning,
      getRowId: (r) => String(r.index),
    }),
  );

  const columnLayout = useFrozenTableColumns({ table, freezePanes, fromColumnPinning: true });
  const sections = useTableRowSections({
    table,
    freezePanes,
    headerRowHeightPx: HEADER_H,
    rowHeightPx: ROW_H,
  });

  const bandOffsetPx = sections.topBandHeightPx;

  const { virtualRows, totalSize, totalSizeWithBandOffset, measureElement } = useTableRowVirtualizer({
    table,
    scrollElement: scrollRoot,
    rows: sections.centerRows,
    bandOffsetPx,
    estimateSize: ROW_H,
    overscan: 10,
  });

  const bottomBandTopPx = bandOffsetPx + totalSize;
  const bottomBandHeightPx = sections.bottomPinnedRows.length * ROW_H;
  const tbodyHeight = totalSizeWithBandOffset + bottomBandHeightPx;

  const leafColumns = table.getVisibleLeafColumns();
  const tableTotalWidth = table.getTotalSize();
  const rowLayout = sections.frozenTop.layout;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Excel freeze: {FROZEN_COL_COUNT} columns + {FROZEN_BODY_ROW_COUNT} body rows (prefix), center band
        virtualized ({sections.centerRows.length} rows). Pin row 5 to top via ★.
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
                  const pin = pinPlaygroundFreezeCell({
                    columnLayout,
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
            style={{
              height: tbodyHeight,
              position: "relative",
              display: "block",
              width: tableTotalWidth,
            }}
          >
            {[...sections.frozenTopRows, ...sections.topPinnedRows].map((row, bandIndex) => {
              const rowSticky =
                getFrozenRowStickyStyle(rowLayout, row.id, {
                  headerOffsetPx: sections.headerOffsetPx,
                }) ??
                ({
                  position: "sticky" as const,
                  top: sections.headerOffsetPx + bandIndex * ROW_H,
                  zIndex: 12 - bandIndex,
                });
              const isPinnedStar = sections.topPinnedRows.some((r) => r.id === row.id);
              return (
                <tr
                  key={row.id}
                  className={cn(
                    gridRowClass,
                    neutralTanStackRowFillClass(tokens, row.original.index),
                  )}
                  {...playgroundTanStackRowStripeData(tokens, row.original.index)}
                  style={{
                    display: "flex",
                    position: "sticky",
                    width: tableTotalWidth,
                    ...rowSticky,
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const pin = pinPlaygroundFreezeCell({
                      columnLayout,
                      rowLayout,
                      columnId: cell.column.id,
                      rowId: row.id,
                      variant: "body",
                      headerOffsetPx: sections.headerOffsetPx,
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
                        {cell.column.id === "c0" && !sections.frozenTopRows.some((r) => r.id === row.id) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-1 h-6 px-1"
                            onClick={() => unpinRow(row)}
                          >
                            Unpin
                          </Button>
                        ) : null}
                        {cell.column.id === "c0" && row.id === "5" && !isPinnedStar ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-1 h-6 px-1"
                            onClick={() => pinRowTop(row)}
                          >
                            ★
                          </Button>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {virtualRows.map((vr) => {
              const row = sections.centerRows[vr.index]!;
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
                  style={getVirtualTableRowStyle(vr.start, tableTotalWidth, { bandOffsetPx })}
                >
                  {row.getVisibleCells().map((cell) => {
                    const pin = pinPlaygroundFreezeCell({
                      columnLayout,
                      rowLayout,
                      columnId: cell.column.id,
                      rowId: row.id,
                      variant: "body",
                      headerOffsetPx: sections.headerOffsetPx,
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

            {sections.bottomPinnedRows.map((row, i) => (
              <tr
                key={row.id}
                className={cn(
                  gridRowClass,
                  neutralTanStackRowFillClass(tokens, row.original.index),
                )}
                {...playgroundTanStackRowStripeData(tokens, row.original.index)}
                style={getBottomPinnedRowStyle(bottomBandTopPx + i * ROW_H, ROW_H)}
              >
                {row.getVisibleCells().map((cell) => {
                  const pin = pinPlaygroundFreezeCell({
                    columnLayout,
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
            ))}
          </tbody>
        </table>
      </EngineScrollTableShell>
    </div>
  );
}
