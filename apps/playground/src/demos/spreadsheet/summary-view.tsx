import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, cn } from "@nqlib/nqui";
import {
  aggregate,
  buildGroupedFlatRows,
  copyMatrixToClipboard,
  getOutlineRowIndentStyle,
  getSelectionBounds,
  isCellSelection,
  type GroupRow,
} from "@nqlib/nqgrid";
import {
  gridBodyHoverClass,
  gridCellClass,
  gridHeadCellClass,
  gridHeaderClass,
  gridNumericClass,
  gridRowClass,
  gridTableClass,
} from "../../lib/grid-styles";
import { useNeutralPlaygroundTable } from "../../lib/playground-neutral-table";
import { EngineScrollTableShell } from "../../parity/engine-scroll-table-shell";
import { SALES_ORDERS, type OrderRow } from "./mock-data";
import { cellReference, formatCurrency, formatNumber } from "./format";
import { InfiniteSheetCanvas, type SheetCanvasMode } from "./infinite-sheet-canvas";
import { useSheetCellSelection } from "./sheet-cell-selection";
import { useRowHeightOverrides } from "./sheet-row-heights";
import {
  ColumnResizeHandle,
  RowBottomResizeHandle,
  useAnalyticsColumnWidths,
} from "./sheet-resize-ui";

const GROUP_BY = ["region", "category"] as const;

const SUMMARY_COLUMNS = [
  { id: "label", label: "Region / category", numeric: false },
  { id: "revenue", label: "Revenue", numeric: true },
  { id: "margin", label: "Margin", numeric: true },
  { id: "units", label: "Units", numeric: true },
] as const;

function rowGrouper(
  rows: readonly OrderRow[],
  columnKey: string,
): Record<string, readonly OrderRow[]> {
  const buckets: Record<string, OrderRow[]> = {};
  for (const row of rows) {
    const key = String(row[columnKey as keyof OrderRow]);
    (buckets[key] ??= []).push(row);
  }
  return buckets;
}

/** Every group id, walking the tree fully expanded. */
function collectAllGroupIds(data: readonly OrderRow[] = SALES_ORDERS): Set<string> {
  const ids = new Set<string>();
  const walk = (rows: readonly OrderRow[], keys: readonly string[], parentId?: string) => {
    if (keys.length === 0) return;
    const [key, ...rest] = keys;
    const groups = rowGrouper(rows, key!);
    for (const [gk, childRows] of Object.entries(groups)) {
      const gid = parentId ? `${parentId}::${gk}` : gk;
      ids.add(gid);
      walk(childRows, rest, gid);
    }
  };
  walk(data, GROUP_BY);
  return ids;
}

const isGroup = (row: OrderRow | GroupRow<OrderRow>): row is GroupRow<OrderRow> =>
  typeof row === "object" && row !== null && "type" in row && row.type === "group";

function rollup(rows: readonly OrderRow[]) {
  return {
    revenue: aggregate(rows.map((r) => r.revenue), "sum") ?? 0,
    margin: aggregate(rows.map((r) => r.margin), "sum") ?? 0,
    units: aggregate(rows.map((r) => r.units), "sum") ?? 0,
  };
}

type SummaryFlatRow = OrderRow | GroupRow<OrderRow>;

function summaryRowKey(row: SummaryFlatRow): string {
  return isGroup(row) ? row.id : row.id;
}

function summaryCellText(row: SummaryFlatRow, col: number): string {
  const column = SUMMARY_COLUMNS[col];
  if (!column) return "";
  if (column.id === "label") {
    if (isGroup(row)) return `${String(row.groupKey)} (${row.childRows.length})`;
    return `${row.orderNo} · ${row.product}`;
  }
  if (isGroup(row)) {
    const totals = rollup(row.childRows);
    if (column.id === "revenue") return formatCurrency(totals.revenue);
    if (column.id === "margin") return formatCurrency(totals.margin);
    return formatNumber(totals.units);
  }
  if (column.id === "revenue") return formatCurrency(row.revenue);
  if (column.id === "margin") return formatCurrency(row.margin);
  return formatNumber(row.units);
}

function summaryCellNumeric(row: SummaryFlatRow, col: number): number | null {
  const column = SUMMARY_COLUMNS[col];
  if (!column?.numeric) return null;
  if (isGroup(row)) {
    const totals = rollup(row.childRows);
    return totals[column.id as keyof typeof totals] ?? null;
  }
  return row[column.id as keyof OrderRow] as number;
}

export interface SummaryViewSheetProps {
  /** Rows to roll up — pass the sheet's current (edited) data. Defaults to the fixture. */
  data?: readonly OrderRow[];
  canvasMode?: SheetCanvasMode;
  columnResizeEnabled?: boolean;
  rowResizeEnabled?: boolean;
  bodyRowHeightPx?: number;
  onActiveCellChange?: (ref: string, value: string) => void;
  onActiveCellIndexChange?: (cell: { row: number; col: number } | null) => void;
  onSelectionNumbersChange?: (numbers: number[]) => void;
  onCopyReady?: (copy: () => void) => void;
}

/** Summary sheet — region → category roll-up of revenue, margin, and units. */
export function SummaryView({
  data = SALES_ORDERS,
  canvasMode = "infinite",
  columnResizeEnabled = true,
  rowResizeEnabled = false,
  bodyRowHeightPx = 28,
  onActiveCellChange,
  onActiveCellIndexChange,
  onSelectionNumbersChange,
  onCopyReady,
}: SummaryViewSheetProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => collectAllGroupIds(data));
  const [copied, setCopied] = useState(false);
  const { bundle } = useNeutralPlaygroundTable();
  const { getRowHeightPx, setRowHeightPx } = useRowHeightOverrides(bodyRowHeightPx);

  const flat = useMemo(
    () =>
      buildGroupedFlatRows<OrderRow>({
        rows: data,
        groupBy: [...GROUP_BY],
        rowGrouper,
        expandedGroupIds: expanded,
        rowKeyGetter: (row) => row.id,
      }).flat,
    [expanded, data],
  );

  const columnIds = useMemo(() => SUMMARY_COLUMNS.map((col) => col.id), []);
  const { getWidth, setWidth } = useAnalyticsColumnWidths(columnIds);
  const tableWidth = useMemo(
    () => columnIds.reduce((sum, id) => sum + getWidth(id), 0),
    [columnIds, getWidth],
  );

  const getCellRef = useCallback((row: number, col: number) => cellReference(row, col), []);

  const getCellValue = useCallback(
    (row: number, col: number) => summaryCellText(flat[row]!, col),
    [flat],
  );

  const getCellNumeric = useCallback(
    (row: number, col: number) => summaryCellNumeric(flat[row]!, col),
    [flat],
  );

  const { selection, onKeyDown, selectCell, isSelected } = useSheetCellSelection({
    rowCount: flat.length,
    columnCount: SUMMARY_COLUMNS.length,
    getCellRef,
    getCellValue,
    getCellNumeric,
    onActiveCellChange,
    onActiveCellIndexChange,
    onSelectionNumbersChange,
  });

  const handleCopy = useCallback(async () => {
    if (!selection || !isCellSelection(selection)) return;
    const b = getSelectionBounds(selection);
    const matrix = flat.slice(b.startRow, b.endRow + 1).map((row) =>
      SUMMARY_COLUMNS.slice(b.startCol, b.endCol + 1).map((_, colOffset) =>
        summaryCellText(row, b.startCol + colOffset),
      ),
    );
    const ok = await copyMatrixToClipboard(matrix);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }, [selection, flat]);

  useEffect(() => {
    onCopyReady?.(() => void handleCopy());
  }, [handleCopy, onCopyReady]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        void handleCopy();
        return;
      }
      onKeyDown(e);
    },
    [handleCopy, onKeyDown],
  );

  const multiCellSelection = (() => {
    if (!selection || !isCellSelection(selection)) return false;
    const b = getSelectionBounds(selection);
    return b.startRow !== b.endRow || b.startCol !== b.endCol;
  })();

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-7" onClick={() => setExpanded(collectAllGroupIds(data))}>
          Expand all
        </Button>
        <Button size="sm" variant="outline" className="h-7" onClick={() => setExpanded(new Set())}>
          Collapse all
        </Button>
      </div>
      {multiCellSelection ? (
        <div className="flex shrink-0 items-center justify-end px-2 py-1">
          <Button size="sm" variant="outline" className="h-7" onClick={() => void handleCopy()}>
            {copied ? "Copied" : "Copy selection"}
          </Button>
        </div>
      ) : null}
      <EngineScrollTableShell className="h-[calc(100dvh-19rem)] min-h-[18rem] max-h-none">
        <InfiniteSheetCanvas mode={canvasMode}>
          <div
            role="grid"
            aria-label="Summary"
            aria-rowcount={flat.length}
            aria-colcount={SUMMARY_COLUMNS.length}
            tabIndex={0}
            // Cells preventDefault on mousedown (drag-select), which also blocks focus.
            // Focus the grid so arrow keys work after a click; editors keep theirs.
            onMouseDownCapture={(e) => {
              if (!(e.target as Element).closest("input, textarea, select, button, [contenteditable='true']")) {
                e.currentTarget.focus({ preventScroll: true });
              }
            }}
            onKeyDown={handleKeyDown}
            className="outline-none"
          >
            <table className={gridTableClass} style={{ width: tableWidth }}>
              <colgroup>
                {SUMMARY_COLUMNS.map((col) => (
                  <col key={col.id} style={{ width: getWidth(col.id) }} />
                ))}
              </colgroup>
              <thead className={gridHeaderClass}>
                <tr>
                  {SUMMARY_COLUMNS.map((col) => (
                    <th
                      key={col.id}
                      data-resize-col
                      className={cn(
                        "group/col relative",
                        col.numeric ? cn(gridHeadCellClass, gridNumericClass) : gridHeadCellClass,
                      )}
                      style={{ width: getWidth(col.id), minWidth: getWidth(col.id) }}
                      scope="col"
                    >
                      {col.label}
                      <ColumnResizeHandle
                        enabled={columnResizeEnabled}
                        label={col.label}
                        getStartWidth={() => getWidth(col.id)}
                        onWidthChange={(width) => setWidth(col.id, width)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={gridBodyHoverClass}>
                {flat.map((row, rowIndex) => {
                  const rowKey = summaryRowKey(row);
                  const rowHeightPx = getRowHeightPx(rowKey);
                  const makeCellProps = (col: number) => {
                    const selected = isSelected(rowIndex, col);
                    return {
                      "data-state": selected ? ("selected" as const) : undefined,
                      onMouseDown: (e: React.MouseEvent) => {
                        e.preventDefault();
                        selectCell(rowIndex, col, e.shiftKey);
                      },
                      className: cn(selected && bundle.cellRangeFill),
                    };
                  };

                  if (isGroup(row)) {
                    const open = expanded.has(row.id);
                    const totals = rollup(row.childRows);
                    const labelProps = makeCellProps(0);
                    return (
                      <tr
                        key={row.id}
                        style={{ height: rowHeightPx, minHeight: rowHeightPx }}
                        className={cn(gridRowClass, "group/row font-medium")}
                      >
                        <td
                          {...labelProps}
                          className={cn(gridCellClass, "relative", labelProps.className)}
                          style={getOutlineRowIndentStyle(row.depth)}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => toggle(row.id)}
                          >
                            {open ? "▾" : "▸"} {String(row.groupKey)} ({row.childRows.length})
                          </Button>
                          <RowBottomResizeHandle
                            enabled={rowResizeEnabled}
                            rowLabel={String(rowIndex + 1)}
                            startHeightPx={rowHeightPx}
                            onHeightChange={(height) => setRowHeightPx(rowKey, height)}
                          />
                        </td>
                        {[1, 2, 3].map((col) => {
                          const props = makeCellProps(col);
                          return (
                            <td
                              key={col}
                              {...props}
                              className={cn(gridCellClass, gridNumericClass, props.className)}
                            >
                              {col === 1
                                ? formatCurrency(totals.revenue)
                                : col === 2
                                  ? formatCurrency(totals.margin)
                                  : formatNumber(totals.units)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={row.id}
                      style={{ height: rowHeightPx, minHeight: rowHeightPx }}
                      className={cn(gridRowClass, "group/row")}
                    >
                      {SUMMARY_COLUMNS.map((col, colIndex) => {
                        const props = makeCellProps(colIndex);
                        return (
                          <td
                            key={col.id}
                            {...props}
                            className={cn(
                              gridCellClass,
                              col.numeric && gridNumericClass,
                              colIndex === 0 && "relative",
                              props.className,
                            )}
                            style={colIndex === 0 ? getOutlineRowIndentStyle(GROUP_BY.length) : undefined}
                          >
                            {colIndex === 0 ? (
                              <>
                                {row.orderNo} · {row.product}
                                <RowBottomResizeHandle
                                  enabled={rowResizeEnabled}
                                  rowLabel={String(rowIndex + 1)}
                                  startHeightPx={rowHeightPx}
                                  onHeightChange={(height) => setRowHeightPx(rowKey, height)}
                                />
                              </>
                            ) : col.id === "revenue" ? (
                              formatCurrency(row.revenue)
                            ) : col.id === "margin" ? (
                              formatCurrency(row.margin)
                            ) : (
                              formatNumber(row.units)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </InfiniteSheetCanvas>
      </EngineScrollTableShell>
    </div>
  );
}
