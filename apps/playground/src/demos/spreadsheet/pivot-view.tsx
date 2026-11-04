import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, cn } from "@nqlib/nqui";
import {
  collectPivotExpandableGroupKeys,
  computePivot,
  copyMatrixToClipboard,
  filterVisiblePivotRows,
  getOutlineRowIndentStyle,
  getSelectionBounds,
  isCellSelection,
  isPivotGroupHeaderRow,
  pivotGroupKey,
  type PivotConfig,
  type PivotField,
  type PivotResult,
  type PivotRow,
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
import { EngineScrollTableShell } from "../../parity/engine-scroll-table-shell";
import {
  ORDER_DIMENSIONS,
  ORDER_MEASURES,
  SALES_ORDERS,
  type OrderRow,
} from "./mock-data";
import { formatCurrency, formatNumber, formatPercent, cellReference } from "./format";
import { useNeutralPlaygroundTable } from "../../lib/playground-neutral-table";
import { useSheetCellSelection } from "./sheet-cell-selection";
import { useRowHeightOverrides } from "./sheet-row-heights";
import {
  DEFAULT_PIVOT_ZONES,
  PivotFieldPanel,
  fieldLabel,
  type FilterSelections,
  type PivotZones,
} from "./pivot-field-panel";
import { InfiniteSheetCanvas, type SheetCanvasMode } from "./infinite-sheet-canvas";
import {
  ColumnResizeHandle,
  RowBottomResizeHandle,
  useAnalyticsColumnWidths,
} from "./sheet-resize-ui";

/** Excel-style row banding: subtotal = light gray row, grand total = stronger band + top rule. */
const pivotSubtotalRowClass =
  "bg-muted/50 font-medium [&>td]:bg-muted/50 [&>td]:text-foreground";
const pivotGrandTotalRowClass =
  "border-t-2 border-border bg-muted/80 font-semibold [&>td]:bg-muted/80";

/** Header tiers — corner row labels vs column groups vs measure names (COMPOSITION / clarity). */
const pivotRowLabelHeadClass = cn(
  gridHeadCellClass,
  "border-r border-border bg-muted/35 text-left normal-case tracking-normal",
);
const pivotColumnGroupHeadClass = cn(
  gridHeadCellClass,
  "bg-muted/25 text-center normal-case tracking-normal",
);
const pivotMeasureHeadClass = cn(
  gridHeadCellClass,
  gridNumericClass,
  "border-t border-border/70 bg-muted/15 text-[10px] font-normal normal-case text-muted-foreground",
);

function formatPivotTotalLabel(label: string): string {
  return label.replace(/\btotal\b/i, "Total");
}

function ResizableHeaderCell({
  columnId,
  label,
  className,
  colSpan,
  rowSpan,
  scope,
  columnResizeEnabled,
  getWidth,
  setWidth,
  children,
}: {
  columnId: string;
  label: string;
  className?: string;
  colSpan?: number;
  rowSpan?: number;
  scope?: "col";
  columnResizeEnabled: boolean;
  getWidth: (id: string) => number;
  setWidth: (id: string, width: number) => void;
  children?: ReactNode;
}) {
  return (
    <th
      data-resize-col
      className={cn("group/col relative", className)}
      style={{ width: getWidth(columnId), minWidth: getWidth(columnId) }}
      colSpan={colSpan}
      rowSpan={rowSpan}
      scope={scope}
    >
      {children ?? label}
      <ColumnResizeHandle
        enabled={columnResizeEnabled}
        label={label}
        getStartWidth={() => getWidth(columnId)}
        onWidthChange={(width) => setWidth(columnId, width)}
      />
    </th>
  );
}

export interface PivotViewSheetProps {
  canvasMode?: SheetCanvasMode;
  columnResizeEnabled?: boolean;
  rowResizeEnabled?: boolean;
  bodyRowHeightPx?: number;
  onActiveCellChange?: (ref: string, value: string) => void;
  onActiveCellIndexChange?: (cell: { row: number; col: number } | null) => void;
  onSelectionNumbersChange?: (numbers: number[]) => void;
  onCopyReady?: (copy: () => void) => void;
}

/** Default pivot: region → category rows, quarter columns, revenue + margin summed. */
export function buildOrdersPivot(
  rowDims: readonly (keyof OrderRow)[] = ["region", "category"],
  columnDim: keyof OrderRow = "quarter",
  measureKeys: readonly string[] = ["revenue", "margin"],
): PivotResult {
  const rows: PivotConfig<OrderRow>["rows"] = rowDims.map((key) => ({
    key: String(key),
    get: (r) => r[key] as string,
    label: ORDER_DIMENSIONS.find((d) => d.key === key)?.label ?? String(key),
  }));
  const measures: PivotConfig<OrderRow>["measures"] = measureKeys.map((mk) => {
    const m = ORDER_MEASURES.find((x) => x.key === mk)!;
    return { key: m.key, get: (r) => r[m.key] as number, agg: m.agg, label: m.label };
  });
  return computePivot(SALES_ORDERS, {
    rows,
    columns: [
      {
        key: String(columnDim),
        get: (r) => r[columnDim] as string,
        label: ORDER_DIMENSIONS.find((d) => d.key === columnDim)?.label ?? String(columnDim),
      },
    ],
    measures,
  });
}

function measureFormatter(measureKey: string): (value: number | null) => string {
  const m = ORDER_MEASURES.find((x) => x.key === measureKey);
  if (m?.money) return formatCurrency;
  if (measureKey === "marginPct") return formatPercent;
  return formatNumber;
}

function pivotField(key: string): PivotField<OrderRow> {
  return {
    key,
    get: (r) => r[key as keyof OrderRow] as string,
    label: ORDER_DIMENSIONS.find((d) => d.key === key)?.label ?? key,
  };
}

/**
 * Map a field-list `zones` state to a `computePivot` result.
 * - rows ← Rows zone, columns ← Columns zone (dimensions).
 * - measures ← Values zone (defaults to `[revenue]` so the table is never blank).
 * - filters ← Filters-zone selections applied to the data BEFORE computePivot.
 */
export function buildPivotFromZones(
  zones: PivotZones,
  filterSelections: FilterSelections = {},
): PivotResult {
  const filtered = SALES_ORDERS.filter((row) =>
    zones.filters.every((key) => {
      const selected = filterSelections[key];
      if (!selected || selected === "All") return true;
      return String(row[key as keyof OrderRow]) === selected;
    }),
  );

  const rows = zones.rows.map(pivotField);
  const columns = zones.columns.map(pivotField);

  const valueKeys = zones.values.length > 0 ? zones.values : ["revenue"];
  const measures: PivotConfig<OrderRow>["measures"] = valueKeys.map((mk) => {
    const m = ORDER_MEASURES.find((x) => x.key === mk)!;
    return { key: m.key, get: (r) => Number(r[m.key as keyof OrderRow]), agg: m.agg, label: m.label };
  });

  return computePivot(filtered, { rows, columns, measures });
}

function pivotCellText(
  row: PivotRow,
  col: number,
  rowHeadersLen: number,
  columnLeaves: PivotResult["columnLeaves"],
): string {
  if (col < rowHeadersLen) {
    if (row.kind === "grandTotal" && col === 0) return formatPivotTotalLabel(row.label);
    if (row.kind === "grandTotal") return "";
    const value = row.path[col];
    if (row.kind === "subtotal" && col === row.path.length - 1) {
      return formatPivotTotalLabel(row.label);
    }
    return value ?? "";
  }
  const leaf = columnLeaves[col - rowHeadersLen];
  if (!leaf) return "";
  return measureFormatter(leaf.measureKey)(row.cells[leaf.key] ?? null);
}

function pivotCellNumeric(
  row: PivotRow,
  col: number,
  rowHeadersLen: number,
  columnLeaves: PivotResult["columnLeaves"],
): number | null {
  if (col < rowHeadersLen) return null;
  const leaf = columnLeaves[col - rowHeadersLen];
  if (!leaf) return null;
  const value = row.cells[leaf.key];
  return value != null && Number.isFinite(value) ? value : null;
}

function PivotRowCells({
  row,
  rowIndex,
  prevRow,
  rowHeaders,
  rowFieldCount,
  expanded,
  onToggleGroup,
  columnLeaves,
  formatCell,
  selectCell,
  isSelected,
  rowResizeEnabled,
  rowHeightPx,
  onRowHeightChange,
}: {
  row: PivotRow;
  rowIndex: number;
  prevRow: PivotRow | undefined;
  rowHeaders: string[];
  rowFieldCount: number;
  expanded: ReadonlySet<string>;
  onToggleGroup: (groupKey: string) => void;
  columnLeaves: PivotResult["columnLeaves"];
  formatCell: (measureKey: string, value: number | null) => string;
  selectCell: (row: number, col: number, extend?: boolean) => void;
  isSelected: (row: number, col: number) => boolean;
  rowResizeEnabled: boolean;
  rowHeightPx: number;
  onRowHeightChange: (heightPx: number) => void;
}) {
  const { bundle } = useNeutralPlaygroundTable();
  const isSubtotal = row.kind === "subtotal";
  const isGrand = row.kind === "grandTotal";
  const leadingSpan = rowHeaders.length;

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

  return (
    <>
      {rowHeaders.map((_, dimIndex) => {
        const value = row.path[dimIndex];
        if (isGrand && dimIndex === 0) {
          const props = makeCellProps(dimIndex);
          return (
            <td
              key={dimIndex}
              {...props}
              className={cn(gridCellClass, props.className, "relative")}
              colSpan={leadingSpan}
            >
              {formatPivotTotalLabel(row.label)}
              <RowBottomResizeHandle
                enabled={rowResizeEnabled}
                rowLabel={String(rowIndex + 1)}
                startHeightPx={rowHeightPx}
                onHeightChange={onRowHeightChange}
              />
            </td>
          );
        }
        if (isGrand) return null;

        const canExpand = rowFieldCount > 1 && dimIndex < rowFieldCount - 1;
        const showToggle = canExpand && isPivotGroupHeaderRow(row, prevRow, dimIndex);
        const groupKey = dimIndex < row.path.length ? pivotGroupKey(row.path, dimIndex) : "";
        const open = groupKey ? expanded.has(groupKey) : false;
        const label =
          isSubtotal && dimIndex === row.path.length - 1
            ? formatPivotTotalLabel(row.label)
            : (value ?? "");
        const props = makeCellProps(dimIndex);

        return (
          <td
            key={dimIndex}
            {...props}
            className={cn(
              gridCellClass,
              props.className,
              dimIndex === 0 && "relative",
              isSubtotal && dimIndex === row.path.length - 1 && "font-semibold",
            )}
            style={dimIndex > 0 ? getOutlineRowIndentStyle(dimIndex) : undefined}
          >
            <div className="flex items-center gap-0.5">
              {showToggle ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 shrink-0 p-0"
                  aria-expanded={open}
                  aria-label={open ? `Collapse ${value ?? row.label}` : `Expand ${value ?? row.label}`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => onToggleGroup(groupKey)}
                >
                  {open ? "▾" : "▸"}
                </Button>
              ) : canExpand ? (
                <span className="inline-block size-7 shrink-0" aria-hidden />
              ) : null}
              <span>{label}</span>
            </div>
            {dimIndex === 0 ? (
              <RowBottomResizeHandle
                enabled={rowResizeEnabled}
                rowLabel={String(rowIndex + 1)}
                startHeightPx={rowHeightPx}
                onHeightChange={onRowHeightChange}
              />
            ) : null}
          </td>
        );
      })}
      {columnLeaves.map((leaf, leafIndex) => {
        const col = rowHeaders.length + leafIndex;
        const props = makeCellProps(col);
        return (
          <td
            key={leaf.key}
            {...props}
            className={cn(
              gridCellClass,
              gridNumericClass,
              props.className,
              (isSubtotal || isGrand) && "font-semibold tabular-nums",
            )}
          >
            {formatCell(leaf.measureKey, row.cells[leaf.key] ?? null)}
          </td>
        );
      })}
    </>
  );
}

/** Pivot sheet — configurable cross-tab over SALES_ORDERS driven by the field-list panel. */
export function PivotView({
  canvasMode = "infinite",
  columnResizeEnabled = true,
  rowResizeEnabled = false,
  bodyRowHeightPx = 28,
  onActiveCellChange,
  onActiveCellIndexChange,
  onSelectionNumbersChange,
  onCopyReady,
}: PivotViewSheetProps) {
  const [zones, setZones] = useState<PivotZones>(DEFAULT_PIVOT_ZONES);
  const [filterSelections, setFilterSelections] = useState<FilterSelections>({});
  const [copied, setCopied] = useState(false);
  const { getRowHeightPx, setRowHeightPx } = useRowHeightOverrides(bodyRowHeightPx);
  const rowFieldKey = zones.rows.join("\0");

  const result = useMemo(
    () => buildPivotFromZones(zones, filterSelections),
    [zones, filterSelections],
  );

  const rowFieldCount = zones.rows.length;
  const allGroupKeys = useMemo(
    () => collectPivotExpandableGroupKeys(result.rows, rowFieldCount),
    [result.rows, rowFieldCount],
  );
  const allGroupKeysKey = allGroupKeys.join("\0");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(allGroupKeys));

  useEffect(() => {
    setExpanded(new Set(allGroupKeys));
  }, [rowFieldKey, allGroupKeysKey, allGroupKeys]);

  const visibleRows = useMemo(
    () => filterVisiblePivotRows(result.rows, expanded, rowFieldCount),
    [result.rows, expanded, rowFieldCount],
  );

  const toggleGroup = (groupKey: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  // One row-header column per row dimension; fall back to a single "Total" column.
  const rowHeaders = useMemo(
    () => (zones.rows.length > 0 ? zones.rows.map(fieldLabel) : ["Total"]),
    [zones.rows],
  );
  const canOutline = rowFieldCount > 1 && allGroupKeys.length > 0;

  const columnIds = useMemo(
    () => [
      ...rowHeaders.map((_, index) => `row-${index}`),
      ...result.columnLeaves.map((leaf) => leaf.key),
    ],
    [rowHeaders, result.columnLeaves],
  );
  const { getWidth, setWidth } = useAnalyticsColumnWidths(columnIds);
  const tableWidth = useMemo(
    () => columnIds.reduce((sum, id) => sum + getWidth(id), 0),
    [columnIds, getWidth],
  );
  const columnCount = columnIds.length;
  const rowHeadersLen = rowHeaders.length;

  const getCellRef = useCallback((row: number, col: number) => cellReference(row, col), []);

  const getCellValue = useCallback(
    (row: number, col: number) =>
      pivotCellText(visibleRows[row]!, col, rowHeadersLen, result.columnLeaves),
    [visibleRows, rowHeadersLen, result.columnLeaves],
  );

  const getCellNumeric = useCallback(
    (row: number, col: number) =>
      pivotCellNumeric(visibleRows[row]!, col, rowHeadersLen, result.columnLeaves),
    [visibleRows, rowHeadersLen, result.columnLeaves],
  );

  const { selection, onKeyDown, selectCell, isSelected } = useSheetCellSelection({
    rowCount: visibleRows.length,
    columnCount,
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
    const matrix = visibleRows.slice(b.startRow, b.endRow + 1).map((row) =>
      Array.from({ length: b.endCol - b.startCol + 1 }, (_, colOffset) =>
        pivotCellText(row, b.startCol + colOffset, rowHeadersLen, result.columnLeaves),
      ),
    );
    const ok = await copyMatrixToClipboard(matrix);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }, [selection, visibleRows, rowHeadersLen, result.columnLeaves]);

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

  return (
    <div className="flex min-h-0 flex-1 gap-2 p-2">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {canOutline ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => setExpanded(new Set(allGroupKeys))}
            >
              Expand all
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => setExpanded(new Set())}
            >
              Collapse all
            </Button>
          </div>
        ) : null}
        {multiCellSelection ? (
          <div className="flex shrink-0 items-center justify-end px-2 py-1">
            <Button size="sm" variant="outline" className="h-7" onClick={() => void handleCopy()}>
              {copied ? "Copied" : "Copy selection"}
            </Button>
          </div>
        ) : null}
        <EngineScrollTableShell className="h-[calc(100dvh-15rem)] min-h-[18rem] max-h-none">
          <InfiniteSheetCanvas mode={canvasMode}>
            <div
              role="grid"
              aria-label="Pivot"
              aria-rowcount={visibleRows.length}
              aria-colcount={columnCount}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              className="outline-none"
            >
            <table className={gridTableClass} style={{ width: tableWidth }}>
              <colgroup>
                {rowHeaders.map((_, index) => (
                  <col key={`row-${index}`} style={{ width: getWidth(`row-${index}`) }} />
                ))}
                {result.columnLeaves.map((leaf) => (
                  <col key={leaf.key} style={{ width: getWidth(leaf.key) }} />
                ))}
              </colgroup>
            <thead className={gridHeaderClass}>
              {result.columnHeaderRows.map((headerRow, rowIndex) => (
                <tr key={rowIndex}>
                  {rowIndex === 0
                    ? rowHeaders.map((label, index) => (
                        <ResizableHeaderCell
                          key={label}
                          columnId={`row-${index}`}
                          label={label}
                          className={pivotRowLabelHeadClass}
                          rowSpan={result.columnHeaderRows.length}
                          scope="col"
                          columnResizeEnabled={columnResizeEnabled}
                          getWidth={getWidth}
                          setWidth={setWidth}
                        />
                      ))
                    : null}
                  {headerRow.map((cell) => {
                    const isMeasureHeader = cell.isLeaf && cell.measureKey != null;
                    const isColumnGroup = !cell.isLeaf;
                    if (isMeasureHeader) {
                      return (
                        <ResizableHeaderCell
                          key={cell.key}
                          columnId={cell.key}
                          label={cell.label}
                          className={pivotMeasureHeadClass}
                          scope="col"
                          columnResizeEnabled={columnResizeEnabled}
                          getWidth={getWidth}
                          setWidth={setWidth}
                        />
                      );
                    }
                    return (
                      <th
                        key={cell.key}
                        className={cn(
                          isColumnGroup
                            ? pivotColumnGroupHeadClass
                            : cn(gridHeadCellClass, gridNumericClass),
                        )}
                        colSpan={cell.span}
                        scope="col"
                      >
                        {cell.label}
                      </th>
                    );
                  })}
                </tr>
              ))}
              {result.columnHeaderRows.length === 0 ? (
                <tr>
                  {rowHeaders.map((label, index) => (
                    <ResizableHeaderCell
                      key={label}
                      columnId={`row-${index}`}
                      label={label}
                      className={pivotRowLabelHeadClass}
                      scope="col"
                      columnResizeEnabled={columnResizeEnabled}
                      getWidth={getWidth}
                      setWidth={setWidth}
                    />
                  ))}
                  {result.columnLeaves.map((leaf) => (
                    <ResizableHeaderCell
                      key={leaf.key}
                      columnId={leaf.key}
                      label={leaf.label}
                      className={cn(gridHeadCellClass, gridNumericClass)}
                      scope="col"
                      columnResizeEnabled={columnResizeEnabled}
                      getWidth={getWidth}
                      setWidth={setWidth}
                    />
                  ))}
                </tr>
              ) : null}
            </thead>
            <tbody className={gridBodyHoverClass}>
              {visibleRows.map((row, rowIndex) => {
                const prevRow = rowIndex > 0 ? visibleRows[rowIndex - 1] : undefined;
                const isSubtotal = row.kind === "subtotal";
                const isGrand = row.kind === "grandTotal";
                const rowHeightPx = getRowHeightPx(row.key);
                return (
                  <tr
                    key={row.key}
                    style={{ height: rowHeightPx, minHeight: rowHeightPx }}
                    className={cn(
                      gridRowClass,
                      "group/row",
                      isSubtotal && pivotSubtotalRowClass,
                      isGrand && pivotGrandTotalRowClass,
                    )}
                  >
                    <PivotRowCells
                      row={row}
                      rowIndex={rowIndex}
                      prevRow={prevRow}
                      rowHeaders={rowHeaders}
                      rowFieldCount={rowFieldCount}
                      expanded={expanded}
                      onToggleGroup={toggleGroup}
                      columnLeaves={result.columnLeaves}
                      formatCell={(measureKey, value) =>
                        measureFormatter(measureKey)(value)
                      }
                      selectCell={selectCell}
                      isSelected={isSelected}
                      rowResizeEnabled={rowResizeEnabled}
                      rowHeightPx={rowHeightPx}
                      onRowHeightChange={(height) => setRowHeightPx(row.key, height)}
                    />
                  </tr>
                );
              })}
            </tbody>
          </table>
            </div>
          </InfiniteSheetCanvas>
        </EngineScrollTableShell>
      </div>
      <aside className="flex h-[calc(100dvh-15rem)] w-[17rem] shrink-0 flex-col">
        <PivotFieldPanel
          zones={zones}
          onChange={setZones}
          filterSelections={filterSelections}
          onFilterSelectionsChange={setFilterSelections}
        />
      </aside>
    </div>
  );
}
