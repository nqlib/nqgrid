import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnOrderState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Badge, cn } from "@nqlib/nqui";
import { Sortable, SortableContent, SortableItem, SortableOverlay } from "@nqlib/nqui/sortable";
import {
  computeFill,
  copyMatrixToClipboard,
  createGlobalFilterFn,
  getFrozenRowStickyStyle,
  getSelectionBounds,
  getVirtualTableRowStyle,
  isCellSelection,
  moveRowDown,
  moveRowToIndex,
  moveRowUp,
  useRowKeyboardReorder,
  useTableRowSections,
  useTableRowVirtualizer,
} from "@nqlib/nqgrid";
import {
  NEUTRAL_TABLE_HEADER_HEIGHT_PX,
  NEUTRAL_TABLE_ROW_HEIGHT_PX,
  neutralTanStackRowFillClass,
  useNeutralPlaygroundTable,
} from "../../lib/playground-neutral-table";
import {
  createSelectColumn,
  dataColumnOrder,
  getSelectColumnMode,
  selectColumnRowHeaderProps,
  selectColumnTdClass,
} from "../../lib/playground-canonical-select-column";
import { CanonicalSelectHeaderCell } from "../../lib/playground-canonical-header-cell";
import { SortableColumnHeader } from "../../lib/sortable-column-header";
import {
  pinPlaygroundCell,
  pinPlaygroundFreezeCell,
  ROW_INDEX_GUTTER_ID,
  usePlaygroundPinnedLayout,
} from "../../lib/playground-row-index-gutter";
import {
  gridBodyHoverClass,
  gridCellClass,
  gridHeadCellClass,
  gridHeaderClass,
  gridNumericClass,
  gridRowClass,
  gridRowHeaderPinnedBodyFillClass,
  gridTableClass,
} from "../../lib/grid-styles";
import { SortableColumnDragOverlay } from "../../lib/playground-sortable-drag-chrome";
import {
  sortableDropTargetProps,
  usePlaygroundSortableTableDropIndicators,
} from "../../lib/playground-sortable-drop-indicator";
import { EngineScrollTableShell, useEngineScrollViewport } from "../../parity/engine-scroll-table-shell";
import { ColumnHeaderMenu, RowActionsMenu } from "../../examples/engine-lab-table-menus";
import { ORDER_COLUMNS, type OrderRow } from "./mock-data";
import {
  cellReference,
  columnLetter,
  formatCellDisplay,
  formatCurrency,
  formatNumber,
  formatPercent,
  textStyleClass,
  toggleFormatForCells,
  type CellFormat,
  type CellNumberFormat,
  type TextStyleKey,
} from "./format";
import type { FrozenPane } from "./spreadsheet-page";
import { useSheetCellSelection } from "./sheet-cell-selection";
import { useRowHeightOverrides } from "./sheet-row-heights";
import { RowBottomResizeHandle } from "./sheet-resize-ui";
import { coerceCellValue } from "./sheet-edit";

const columnHelper = createColumnHelper<OrderRow>();

/** Letter row (h-6 = 24px) + field-header row (32px) form the sticky thead band. */
const LETTER_ROW_HEIGHT_PX = 24;
const HEAD_OFFSET_PX = LETTER_ROW_HEIGHT_PX + NEUTRAL_TABLE_HEADER_HEIGHT_PX;

/** Columns formatted as whole-dollar currency. */
const CURRENCY_KEYS = new Set(["revenue", "cost", "margin", "unitPrice"]);

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Won":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "Open":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** Render-ready string for a data cell (used for both display and clipboard). */
function cellText(row: OrderRow, key: keyof OrderRow): string {
  const value = row[key];
  if (CURRENCY_KEYS.has(key as string)) return formatCurrency(value as number);
  if (key === "marginPct") return formatPercent(value as number);
  if (key === "units") return formatNumber(value as number);
  return String(value ?? "");
}

/** Pure content for a body cell — depends only on row data + per-cell format. */
// Horizontal/vertical alignment is applied on the <td> (a flex container) in
// BodyCell — `text-align` on this inline content has no effect, which is why the
// toolbar's left/center/right used to do nothing.
function renderBodyCellContent(rowOriginal: OrderRow, key: keyof OrderRow, format: CellFormat | undefined) {
  const colDef = ORDER_COLUMNS.find((x) => x.key === key);
  const numeric = colDef?.numeric ?? false;
  const styleClass = format ? textStyleClass(format) : undefined;

  if (key === "status") {
    return (
      <span className={cn("inline-flex", styleClass)}>
        <Badge variant="secondary" className={cn("font-normal", statusBadgeClass(rowOriginal.status))}>
          {rowOriginal.status}
        </Badge>
      </span>
    );
  }

  const rawValue = rowOriginal[key];
  const text =
    numeric && format?.numberFormat
      ? formatCellDisplay(rawValue as number, format.numberFormat, cellText(rowOriginal, key))
      : cellText(rowOriginal, key);
  const className = cn(numeric && "tabular-nums", styleClass);
  // Block + full width: text alignment has no effect on an inline span.
  return className ? <span className={cn("block w-full", className)}>{text}</span> : text;
}

/** Resolve a cell's effective horizontal alignment (explicit, else numeric → right). */
function resolveHAlign(key: keyof OrderRow, format: CellFormat | undefined): "left" | "center" | "right" {
  if (format?.align) return format.align;
  return ORDER_COLUMNS.find((x) => x.key === key)?.numeric ? "right" : "left";
}

/** Flex classes that align a cell's content box horizontally + vertically. */
function cellAlignClass(hAlign: "left" | "center" | "right", vAlign: "top" | "middle" | "bottom"): string {
  return cn(
    "flex",
    hAlign === "center" ? "justify-center" : hAlign === "right" ? "justify-end" : "justify-start",
    vAlign === "top" ? "items-start" : vAlign === "bottom" ? "items-end" : "items-center",
  );
}

/** Stable callbacks/refs shared by every body cell (identity-stable across renders). */
interface BodyCellHandlers {
  selectCell: (row: number, col: number, opts?: { extend?: boolean; additive?: boolean }) => void;
  beginDrag: (row: number, col: number) => void;
  openEditor: (rowId: string, col: number, mode: "select" | "caret", text: string) => void;
  getEditableCellText: (row: number, col: number) => string;
  scheduleDrag: () => void;
  onEditChange: (value: string) => void;
  onEditBlur: () => void;
  onEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => void;
  onEditFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
  draggingRef: React.MutableRefObject<boolean>;
  fillDragRef: React.MutableRefObject<boolean>;
  fillTargetRef: React.MutableRefObject<number | null>;
  pendingDragRef: React.MutableRefObject<{ row: number; col: number } | null>;
  pendingFillRowRef: React.MutableRefObject<number | null>;
}

interface BodyCellProps {
  columnId: keyof OrderRow;
  columnSize: number;
  rowId: string;
  rowOriginal: OrderRow;
  rowIndex: number;
  colIndex: number;
  pinStyle?: CSSProperties;
  pinClassName?: string;
  dataPinned: boolean;
  // Selection chrome — the only props that change on a plain selection update.
  selected: boolean;
  edgeTop: boolean;
  edgeBottom: boolean;
  edgeLeft: boolean;
  edgeRight: boolean;
  isActiveCell: boolean;
  inPreview: boolean;
  previewEdgeTop: boolean;
  previewEdgeBottom: boolean;
  previewEdgeLeft: boolean;
  previewEdgeRight: boolean;
  showFillHandle: boolean;
  format: CellFormat | undefined;
  isEditing: boolean;
  /** Live edit value for the editing cell; "" (stable) for every other cell. */
  editValue: string;
  handlers: BodyCellHandlers;
}

/**
 * One body `<td>`, memoized. A selection change recomputes each cell's chrome
 * booleans in the parent (cheap) but React.memo skips re-rendering every cell whose
 * props are unchanged — so a click re-renders ~2 cells instead of all ~420. All
 * non-selection props (pin geometry, row data, format, handlers) are referentially
 * stable across a selection-only render, so the shallow compare bails correctly.
 */
const BodyCell = memo(function BodyCell({
  columnId,
  columnSize,
  rowId,
  rowOriginal,
  rowIndex,
  colIndex,
  pinStyle,
  pinClassName,
  dataPinned,
  selected,
  edgeTop,
  edgeBottom,
  edgeLeft,
  edgeRight,
  isActiveCell,
  inPreview,
  previewEdgeTop,
  previewEdgeBottom,
  previewEdgeLeft,
  previewEdgeRight,
  showFillHandle,
  format,
  isEditing,
  editValue,
  handlers,
}: BodyCellProps) {
  const shadowLayers: string[] = [];
  if (selected && !isActiveCell) {
    shadowLayers.push("inset 0 0 0 9999px color-mix(in oklab, var(--primary) 12%, transparent)");
  }
  if (edgeTop) shadowLayers.push("inset 0 2px 0 0 var(--primary)");
  if (edgeBottom) shadowLayers.push("inset 0 -2px 0 0 var(--primary)");
  if (edgeLeft) shadowLayers.push("inset 2px 0 0 0 var(--primary)");
  if (edgeRight) shadowLayers.push("inset -2px 0 0 0 var(--primary)");
  const selectionBoxShadow =
    shadowLayers.length > 0
      ? [pinStyle?.boxShadow, ...shadowLayers].filter(Boolean).join(", ")
      : undefined;

  return (
    <td
      data-state={selected ? "selected" : undefined}
      {...(dataPinned ? { "data-pinned": true as const } : {})}
      onDoubleClick={() =>
        handlers.openEditor(rowId, colIndex, "select", handlers.getEditableCellText(rowIndex, colIndex))
      }
      onMouseDown={(e) => {
        if (isEditing) return; // let the input own the pointer
        e.preventDefault();
        const additive = e.metaKey || e.ctrlKey;
        if (e.shiftKey || additive) {
          handlers.selectCell(rowIndex, colIndex, { extend: e.shiftKey, additive });
        } else {
          handlers.draggingRef.current = true;
          handlers.beginDrag(rowIndex, colIndex);
        }
      }}
      onMouseEnter={() => {
        if (handlers.draggingRef.current) {
          handlers.pendingDragRef.current = { row: rowIndex, col: colIndex };
          handlers.scheduleDrag();
        }
        if (handlers.fillDragRef.current) {
          handlers.pendingFillRowRef.current = rowIndex;
          handlers.scheduleDrag();
        }
      }}
      className={cn(
        gridCellClass,
        "relative cursor-cell",
        cellAlignClass(resolveHAlign(columnId, format), format?.valign ?? "middle"),
        pinClassName,
      )}
      style={{
        flex: `0 0 ${columnSize}px`,
        width: columnSize,
        ...pinStyle,
        ...(selectionBoxShadow ? { boxShadow: selectionBoxShadow } : {}),
      }}
    >
      {isEditing ? null : renderBodyCellContent(rowOriginal, columnId, format)}
      {isEditing ? (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => handlers.onEditChange(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onFocus={handlers.onEditFocus}
          onBlur={handlers.onEditBlur}
          onKeyDown={(e) => handlers.onEditKeyDown(e, rowIndex, colIndex)}
          aria-label="Edit cell"
          className={cn(
            "absolute inset-0 z-30 h-full w-full bg-background px-2 text-xs text-foreground",
            "outline-none ring-2 ring-ring ring-inset",
          )}
        />
      ) : null}
      {inPreview ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 z-10 border-dashed border-primary",
            previewEdgeTop && "border-t-2",
            previewEdgeBottom && "border-b-2",
            previewEdgeLeft && "border-l-2",
            previewEdgeRight && "border-r-2",
          )}
        />
      ) : null}
      {showFillHandle ? (
        <span
          role="button"
          aria-label="Fill"
          className="absolute -bottom-[3px] -right-[3px] z-20 h-2 w-2 cursor-crosshair bg-primary"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlers.fillDragRef.current = true;
            handlers.fillTargetRef.current = rowIndex;
          }}
        />
      ) : null}
    </td>
  );
});

/** Toolbar-facing handle for applying per-cell formatting to the selection. */
export interface FormatApi {
  applyTextStyle: (key: TextStyleKey) => void;
  applyAlign: (align: NonNullable<CellFormat["align"]>) => void;
  applyValign: (valign: NonNullable<CellFormat["valign"]>) => void;
  applyNumberFormat: (format: CellNumberFormat) => void;
  /** Format of the ACTIVE cell — drives the toolbar's pressed states. */
  active: CellFormat;
}

export interface GridViewProps {
  data: OrderRow[];
  /** Replace the master row order (row ⋯ move actions). */
  onDataChange: (next: OrderRow[]) => void;
  search: string;
  /** Excel freeze origin: leading frozen data columns + body rows. */
  frozenPane: FrozenPane;
  /** Active cell A1 reference + value, lifted for the formula bar. */
  onActiveCellChange: (ref: string, value: string) => void;
  /** Active cell row/col indices (selection end), lifted so the page can freeze at it. */
  onActiveCellIndexChange: (cell: { row: number; col: number } | null) => void;
  /** Numeric values in the current selection, lifted for the status bar. */
  onSelectionNumbersChange: (numbers: number[]) => void;
  /** Receives the copy-selection handler so the menu bar can trigger it. */
  onCopyReady?: (copy: () => void) => void;
  /** Receives a commit handler that writes a value to the ACTIVE cell (formula bar). */
  onActiveCellCommitReady?: (commit: (value: string) => void) => void;
  /** Lifts whether a copyable multi-cell range is active (drives the status-bar Copy). */
  onCopyAvailableChange?: (available: boolean) => void;
  /** Receives the per-cell formatting API (apply handlers + active-cell format). */
  onFormatApiReady?: (api: FormatApi) => void;
  columnResizeEnabled?: boolean;
  rowResizeEnabled?: boolean;
  /** Default body row height when a row has no individual override. */
  bodyRowHeightPx?: number;
}

/** Orders sheet — the full data grid with a column-letter header row above field names. */
function GridViewImpl({
  data,
  onDataChange,
  search,
  frozenPane,
  onActiveCellChange,
  onActiveCellIndexChange,
  onSelectionNumbersChange,
  onCopyReady,
  onActiveCellCommitReady,
  onCopyAvailableChange,
  onFormatApiReady,
  columnResizeEnabled = true,
  rowResizeEnabled = false,
  bodyRowHeightPx = NEUTRAL_TABLE_ROW_HEIGHT_PX,
}: GridViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  // In-cell editing: which body cell is open + its working text.
  const [editing, setEditing] = useState<{ rowId: string; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  // Per-cell display formatting, keyed by `${rowId}:${columnKey}`. Display-only:
  // never touches stored values, so editing/clipboard/fill stay value-true.
  const [cellFormats, setCellFormats] = useState<Record<string, CellFormat>>({});
  // How the edit was opened: "select" = select-all on focus, "caret" = caret at end.
  const editSelectModeRef = useRef<"select" | "caret">("select");
  const { getRowHeightPx, setRowHeightPx } = useRowHeightOverrides(bodyRowHeightPx);

  const { viewportRef, scrollRoot, scrolledX } = useEngineScrollViewport(true);
  const { tokens } = useNeutralPlaygroundTable();
  const sortableDrop = usePlaygroundSortableTableDropIndicators();

  const sortActive = sorting.length > 0;

  // --- Row move (virtualization-safe, mutates the master order) ---
  const moveRow = useCallback(
    (id: string, dir: "up" | "down" | "top") => {
      if (dir === "up") onDataChange(moveRowUp(data, id));
      else if (dir === "down") onDataChange(moveRowDown(data, id));
      else onDataChange(moveRowToIndex(data, id, 0));
    },
    [data, onDataChange],
  );

  // Keyboard grab→arrow→drop reorder for the focused row.
  const keyboardReorder = useRowKeyboardReorder({
    enabled: !sortActive,
    rowCount: data.length,
    indexOf: (id) => data.findIndex((r) => r.id === id),
    onMove: ({ id, dir }) => onDataChange(dir === -1 ? moveRowUp(data, id) : moveRowDown(data, id)),
  });

  const columns = useMemo(
    () => [
      createSelectColumn(columnHelper, { mode: "index", getRowLabel: (r) => r.orderNo }),
      ...ORDER_COLUMNS.map((col) =>
        columnHelper.accessor((row) => row[col.key], {
          id: col.key,
          header: col.label,
          size: col.width,
          enableSorting: true,
          cell: (info) => {
            const row = info.row.original;
            if (col.key === "status") {
              return (
                <Badge
                  variant="secondary"
                  className={cn("font-normal", statusBadgeClass(row.status))}
                >
                  {row.status}
                </Badge>
              );
            }
            const text = cellText(row, col.key);
            return col.numeric ? <span className={cn("block w-full", gridNumericClass)}>{text}</span> : text;
          },
        }),
      ),
      columnHelper.display({
        id: "rowActions",
        header: "",
        size: 44,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        cell: ({ row }) => {
          const id = row.original.id;
          const gripProps = keyboardReorder.getGripProps(id);
          return (
            <div
              {...gripProps}
              aria-label={`Reorder ${row.original.orderNo}`}
              className="flex items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onKeyDown={(e) => {
                e.stopPropagation();
                gripProps.onKeyDown(e);
              }}
            >
              <RowActionsMenu
                label={row.original.orderNo}
                move={{
                  onMoveUp: () => moveRow(id, "up"),
                  onMoveDown: () => moveRow(id, "down"),
                  onMoveToTop: () => moveRow(id, "top"),
                  canMove: !sortActive,
                  disabledHint: sortActive ? "Sort cleared to reorder" : undefined,
                }}
              />
            </div>
          );
        },
      }),
    ],
    [keyboardReorder, moveRow, sortActive],
  );

  const globalFilterFn = useMemo(
    () =>
      createGlobalFilterFn<OrderRow>([
        "orderNo",
        "date",
        "region",
        "country",
        "channel",
        "category",
        "product",
        "salesRep",
        "status",
      ]),
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnOrder, globalFilter: search },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    globalFilterFn,
    getRowId: (r) => r.id,
    columnResizeMode: "onChange",
    enableColumnResizing: columnResizeEnabled,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const displayRows = table.getRowModel().rows;
  /** Data leaf columns (exclude the row-index gutter + row-actions), in render order. */
  const dataColumns = useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .filter((c) => c.id !== ROW_INDEX_GUTTER_ID && c.id !== "rowActions"),
    [table, columnVisibility, columnOrder],
  );

  const getCellRef = useCallback((row: number, col: number) => cellReference(row, col), []);

  const getCellValue = useCallback(
    (row: number, col: number) => {
      const r = displayRows[row];
      const c = dataColumns[col];
      if (!r || !c) return "";
      return cellText(r.original, c.id as keyof OrderRow);
    },
    [displayRows, dataColumns],
  );

  const getCellNumeric = useCallback(
    (row: number, col: number) => {
      const r = displayRows[row];
      const c = dataColumns[col];
      if (!r || !c) return null;
      const colDef = ORDER_COLUMNS.find((x) => x.key === c.id);
      if (!colDef?.numeric) return null;
      const value = r.original[c.id as keyof OrderRow];
      return typeof value === "number" ? value : null;
    },
    [displayRows, dataColumns],
  );

  const {
    ranges,
    selection,
    setSelection,
    onKeyDown: gridKeyDown,
    selectCell,
    selectRow,
    selectColumn,
    selectAll,
    beginDrag,
    dragTo,
    isSelected,
  } = useSheetCellSelection({
    rowCount: displayRows.length,
    columnCount: dataColumns.length,
    getCellRef,
    getCellValue,
    getCellNumeric,
    columnLetter,
    onActiveCellChange,
    onActiveCellIndexChange,
    onSelectionNumbersChange,
  });

  // Active cell (selection end) for Ctrl/Shift+Space and the fill handle anchor.
  const activeCell = useMemo(() => {
    if (!selection || !isCellSelection(selection)) return null;
    const b = getSelectionBounds(selection);
    return { row: b.endRow, col: b.endCol };
  }, [selection]);

  // Bounds of the primary CELL range — anchors the fill handle (null for bands).
  const fillBounds = useMemo(
    () => (selection && isCellSelection(selection) ? getSelectionBounds(selection) : null),
    [selection],
  );

  // Live fill preview: the hovered target row while dragging the fill handle.
  // Drives a dashed ghost outline so the fill region is visible before commit.
  const [fillPreviewRow, setFillPreviewRow] = useState<number | null>(null);

  // Rows/cols that WILL be filled (exclude the source range), as a bounds box.
  // Drives a dashed `border-primary` ghost outline rendered per cell.
  const fillPreviewBounds = useMemo(() => {
    if (fillPreviewRow == null || fillBounds == null) return null;
    if (fillPreviewRow > fillBounds.endRow) {
      return {
        startRow: fillBounds.endRow + 1,
        endRow: fillPreviewRow,
        startCol: fillBounds.startCol,
        endCol: fillBounds.endCol,
      };
    }
    if (fillPreviewRow < fillBounds.startRow) {
      return {
        startRow: fillPreviewRow,
        endRow: fillBounds.startRow - 1,
        startCol: fillBounds.startCol,
        endCol: fillBounds.endCol,
      };
    }
    return null;
  }, [fillPreviewRow, fillBounds]);

  const inFillPreview = useCallback(
    (row: number, col: number) => {
      const b = fillPreviewBounds;
      return (
        b != null && row >= b.startRow && row <= b.endRow && col >= b.startCol && col <= b.endCol
      );
    },
    [fillPreviewBounds],
  );

  // Click-drag paint: armed on body mousedown, released on window mouseup.
  const draggingRef = useRef(false);
  // Fill-handle drag refs (declared here so the window mouseup can commit them).
  const fillDragRef = useRef(false);
  const fillTargetRef = useRef<number | null>(null);
  const applyVerticalFillRef = useRef<((targetEndRow: number) => void) | null>(null);

  // rAF coalescing for drag-paint and fill-handle hover: onMouseEnter fires per
  // cell (~390 visible), so we stash the latest target and flush once per frame.
  const dragRafRef = useRef<number | null>(null);
  const pendingDragRef = useRef<{ row: number; col: number } | null>(null);
  const dragToRef = useRef(dragTo);
  const pendingFillRowRef = useRef<number | null>(null);
  const flushDrag = useCallback(() => {
    dragRafRef.current = null;
    const paint = pendingDragRef.current;
    if (paint) {
      pendingDragRef.current = null;
      dragToRef.current(paint.row, paint.col);
    }
    const fillRow = pendingFillRowRef.current;
    if (fillRow != null) {
      pendingFillRowRef.current = null;
      fillTargetRef.current = fillRow;
      setFillPreviewRow(fillRow);
    }
  }, []);
  const scheduleDrag = useCallback(() => {
    if (dragRafRef.current != null) return;
    dragRafRef.current = requestAnimationFrame(flushDrag);
  }, [flushDrag]);

  useEffect(() => {
    const onUp = () => {
      draggingRef.current = false;
      if (dragRafRef.current != null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      pendingDragRef.current = null;
      pendingFillRowRef.current = null;
      if (fillDragRef.current) {
        fillDragRef.current = false;
        const target = fillTargetRef.current;
        fillTargetRef.current = null;
        setFillPreviewRow(null);
        if (target != null) applyVerticalFillRef.current?.(target);
      }
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  // Frozen LEFT columns: prefix of the (re-ordered) data columns.
  const dataPinnedLeftIds = useMemo(
    () => dataColumns.slice(0, frozenPane.col).map((c) => c.id),
    [dataColumns, frozenPane.col],
  );

  const pinnedLayout = usePlaygroundPinnedLayout({
    table,
    selectColumnMode: "index",
    dataPinnedLeftIds,
  });

  // Frozen TOP rows: first N body rows pinned as a sticky band above the center.
  const sections = useTableRowSections({
    table,
    frozenTopBodyRowCount: frozenPane.row,
    headerRowCount: 1,
    headerRowHeightPx: HEAD_OFFSET_PX,
    rowHeightPx: bodyRowHeightPx,
    getRowHeightPx,
  });
  const bandOffsetPx = sections.topBandHeightPx;
  const rowLayout = sections.frozenTop.layout;
  const headerOffsetPx = sections.headerOffsetPx;

  // Memoize pinned-cell geometry so a selection change doesn't recompute the
  // sticky offset (`getPinnedTableCellStickyStyle`) for all ~390 visible cells.
  // The cache is rebuilt whenever any geometry input changes (layout, horizontal
  // scroll state, fill tokens, frozen-row offsets); within a render the same
  // (columnId, variant, rowIndex, gutter) inputs reuse one result.
  const getPinnedBodyCell = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof pinPlaygroundCell>>();
    return (columnId: string, rowIndex: number, isGutter: boolean) => {
      const key = `${columnId}|${isGutter ? "g" : "d"}|${isGutter ? "" : rowIndex}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const result = pinPlaygroundCell({
        pinnedLayout,
        columnId,
        variant: "body",
        scrolledX,
        rowIndexGutter: isGutter,
        rowFillTokens: isGutter ? undefined : tokens,
        rowIndex: isGutter ? undefined : rowIndex,
      });
      cache.set(key, result);
      return result;
    };
  }, [pinnedLayout, scrolledX, tokens]);

  const getPinnedFreezeCell = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof pinPlaygroundFreezeCell>>();
    return (columnId: string, rowId: string, rowIndex: number, isGutter: boolean) => {
      const key = `${columnId}|${rowId}|${isGutter ? "g" : "d"}|${isGutter ? "" : rowIndex}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const result = pinPlaygroundFreezeCell({
        columnLayout: pinnedLayout,
        rowLayout,
        columnId,
        rowId,
        variant: "body",
        headerOffsetPx,
        scrolledX,
        rowFillTokens: isGutter ? undefined : tokens,
        rowIndex: isGutter ? undefined : rowIndex,
      });
      cache.set(key, result);
      return result;
    };
  }, [pinnedLayout, rowLayout, headerOffsetPx, scrolledX, tokens]);

  const { virtualRows, totalSizeWithBandOffset, measureElement } = useTableRowVirtualizer({
    table,
    scrollElement: scrollRoot,
    rows: sections.centerRows,
    bandOffsetPx,
    estimateSize: (index) => getRowHeightPx(sections.centerRows[index]?.id ?? ""),
    overscan: 8,
  });

  const handleCopy = useCallback(async () => {
    if (!selection) return;
    const b = getSelectionBounds(selection);
    const matrix = displayRows.slice(b.startRow, b.endRow + 1).map((row) =>
      dataColumns
        .slice(b.startCol, b.endCol + 1)
        .map((col) => cellText(row.original, col.id as keyof OrderRow)),
    );
    await copyMatrixToClipboard(matrix);
  }, [selection, displayRows, dataColumns]);

  useEffect(() => {
    onCopyReady?.(() => void handleCopy());
  }, [handleCopy, onCopyReady]);

  /**
   * Vertical fill: extend the selected cell range's source rows down/up to the
   * target rows. For each selected column take the source column values, run
   * `computeFill`, and write the results back into `data` (numeric columns get
   * coerced back to number). No-op while a sort is active (ambiguous order).
   */
  const applyVerticalFill = useCallback(
    (targetEndRow: number) => {
      if (sortActive) return;
      if (!selection || !isCellSelection(selection)) return;
      const b = getSelectionBounds(selection);
      const sourceCount = b.endRow - b.startRow + 1;
      const target = Math.max(0, Math.min(displayRows.length - 1, targetEndRow));
      const fillDown = target > b.endRow;
      const fillUp = target < b.startRow;
      if (!fillDown && !fillUp) return;

      // Rows to write (excluding the source rows), ordered to match the source
      // direction so computeFill's series continues correctly.
      const targetRowIndices: number[] = [];
      if (fillDown) {
        for (let r = b.endRow + 1; r <= target; r++) targetRowIndices.push(r);
      } else {
        // Filling up: nearest-to-source first so the series counts away from it.
        for (let r = b.startRow - 1; r >= target; r--) targetRowIndices.push(r);
      }
      if (targetRowIndices.length === 0) return;

      // Patch by row id so it survives filtering (sort is already excluded).
      const patch = new Map<string, Partial<OrderRow>>();
      for (let col = b.startCol; col <= b.endCol; col++) {
        const column = dataColumns[col];
        if (!column) continue;
        const key = column.id as keyof OrderRow;
        const colDef = ORDER_COLUMNS.find((x) => x.key === key);
        if (!colDef) continue; // skip non-data columns (e.g. status badge has no editable text)

        // Source values, ordered to match the fill direction.
        const source: (string | number)[] = [];
        const orderedSourceRows = fillUp
          ? Array.from({ length: sourceCount }, (_, i) => b.endRow - i)
          : Array.from({ length: sourceCount }, (_, i) => b.startRow + i);
        for (const r of orderedSourceRows) {
          const value = displayRows[r]?.original[key];
          source.push(colDef.numeric && typeof value === "number" ? value : String(value ?? ""));
        }

        const filled = computeFill(source, targetRowIndices.length);
        targetRowIndices.forEach((rowIndex, i) => {
          const id = displayRows[rowIndex]?.id;
          if (id == null) return;
          const raw = filled[i];
          const coerced = colDef.numeric ? Number(raw) : raw;
          const next = patch.get(id) ?? {};
          (next as Record<string, unknown>)[key as string] =
            colDef.numeric && !Number.isFinite(coerced as number) ? source[source.length - 1] : coerced;
          patch.set(id, next);
        });
      }

      if (patch.size === 0) return;
      onDataChange(data.map((row) => (patch.has(row.id) ? { ...row, ...patch.get(row.id) } : row)));
      // Grow the selection to include the filled rows.
      const newStart = fillUp ? { row: target, col: b.startCol } : { row: b.startRow, col: b.startCol };
      const newEnd = fillUp ? { row: b.endRow, col: b.endCol } : { row: target, col: b.endCol };
      setSelection({ type: "cell", start: newStart, end: newEnd });
    },
    [data, dataColumns, displayRows, onDataChange, selection, setSelection, sortActive],
  );

  useEffect(() => {
    applyVerticalFillRef.current = applyVerticalFill;
  }, [applyVerticalFill]);

  useEffect(() => {
    dragToRef.current = dragTo;
  }, [dragTo]);

  /**
   * Shared cell-write: map a visible data-column index → its column key, coerce
   * by the column's numeric flag, and write into `data` by row id. Status (badge)
   * has a column key too, so its text is editable. No-op when sort is active and
   * the column isn't found.
   */
  const commitCell = useCallback(
    (rowId: string, colIndex: number, rawValue: string) => {
      const column = dataColumns[colIndex];
      if (!column) return;
      const key = column.id as keyof OrderRow;
      const colDef = ORDER_COLUMNS.find((x) => x.key === key);
      if (!colDef) return;
      const value = coerceCellValue(rawValue, colDef.numeric);
      // Not a number → keep the previous value rather than writing 0.
      if (value === null) return;
      let changed = false;
      const next = data.map((row) => {
        if (row.id !== rowId) return row;
        if (row[key] === value) return row;
        changed = true;
        return { ...row, [key]: value } as OrderRow;
      });
      if (changed) onDataChange(next);
    },
    [data, dataColumns, onDataChange],
  );

  // --- In-cell editing lifecycle ---
  const openEditor = useCallback(
    (rowId: string, col: number, mode: "select" | "caret", initial: string) => {
      editSelectModeRef.current = mode;
      setEditing({ rowId, col });
      setEditValue(initial);
    },
    [],
  );

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setEditValue("");
  }, []);

  // Commit a value to the ACTIVE cell (formula bar). Maps the active cell's
  // visible row index → its row id, writes, and moves the active cell down.
  const commitActiveCell = useCallback(
    (value: string) => {
      if (!activeCell) return;
      const row = displayRows[activeCell.row];
      if (!row) return;
      commitCell(row.id, activeCell.col, value);
      const nextRow = Math.min(displayRows.length - 1, activeCell.row + 1);
      selectCell(nextRow, activeCell.col);
    },
    [activeCell, displayRows, commitCell, selectCell],
  );

  useEffect(() => {
    onActiveCellCommitReady?.(commitActiveCell);
  }, [commitActiveCell, onActiveCellCommitReady]);

  /** Raw stored value (uncoerced/unformatted) for an active cell, for editing. */
  const getEditableCellText = useCallback(
    (rowIndex: number, colIndex: number): string => {
      const row = displayRows[rowIndex];
      const column = dataColumns[colIndex];
      if (!row || !column) return "";
      const value = row.original[column.id as keyof OrderRow];
      return value == null ? "" : String(value);
    },
    [displayRows, dataColumns],
  );

  // Mirror edit state into refs so the edit handlers below stay identity-stable
  // across keystrokes — otherwise BodyCell's memo would break and every cell would
  // re-render on each keypress.
  const editingRef = useRef(editing);
  const editValueRef = useRef(editValue);
  const rowCountRef = useRef(0);
  const colCountRef = useRef(0);
  editingRef.current = editing;
  editValueRef.current = editValue;
  rowCountRef.current = displayRows.length;
  colCountRef.current = dataColumns.length;

  const handleEditChange = useCallback((value: string) => {
    editValueRef.current = value;
    setEditValue(value);
  }, []);
  const handleEditCommit = useCallback(() => {
    const ed = editingRef.current;
    if (!ed) return;
    commitCell(ed.rowId, ed.col, editValueRef.current);
    setEditing(null);
    setEditValue("");
  }, [commitCell]);
  const handleEditFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    if (editSelectModeRef.current === "select") {
      e.currentTarget.select();
    } else {
      const len = e.currentTarget.value.length;
      e.currentTarget.setSelectionRange(len, len);
    }
  }, []);
  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        handleEditCommit();
        selectCell(Math.min(rowCountRef.current - 1, rowIndex + 1), colIndex);
      } else if (e.key === "Tab") {
        e.preventDefault();
        handleEditCommit();
        selectCell(rowIndex, Math.min(colCountRef.current - 1, colIndex + 1));
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    },
    [handleEditCommit, cancelEdit, selectCell],
  );

  // One identity-stable handler bundle for every body cell (refs are stable).
  const bodyCellHandlers = useMemo<BodyCellHandlers>(
    () => ({
      selectCell,
      beginDrag,
      openEditor,
      getEditableCellText,
      scheduleDrag,
      onEditChange: handleEditChange,
      onEditBlur: handleEditCommit,
      onEditKeyDown: handleEditKeyDown,
      onEditFocus: handleEditFocus,
      draggingRef,
      fillDragRef,
      fillTargetRef,
      pendingDragRef,
      pendingFillRowRef,
    }),
    [
      selectCell,
      beginDrag,
      openEditor,
      getEditableCellText,
      scheduleDrag,
      handleEditChange,
      handleEditCommit,
      handleEditKeyDown,
      handleEditFocus,
    ],
  );

  /** Clear every cell in all current selection ranges (text → "", numeric → 0). */
  const clearSelection = useCallback(() => {
    if (sortActive) return;
    const patch = new Map<string, Partial<OrderRow>>();
    for (const sel of ranges) {
      const b = getSelectionBounds(sel);
      const startRow = Math.max(0, b.startRow);
      const endRow = Math.min(displayRows.length - 1, b.endRow);
      const startCol = Math.max(0, b.startCol);
      const endCol = Math.min(dataColumns.length - 1, b.endCol);
      for (let r = startRow; r <= endRow; r++) {
        const row = displayRows[r];
        if (!row) continue;
        for (let c = startCol; c <= endCol; c++) {
          const column = dataColumns[c];
          if (!column) continue;
          const key = column.id as keyof OrderRow;
          const colDef = ORDER_COLUMNS.find((x) => x.key === key);
          if (!colDef) continue;
          const next = patch.get(row.id) ?? {};
          (next as Record<string, unknown>)[key as string] = colDef.numeric ? 0 : "";
          patch.set(row.id, next);
        }
      }
    }
    if (patch.size === 0) return;
    onDataChange(data.map((row) => (patch.has(row.id) ? { ...row, ...patch.get(row.id) } : row)));
  }, [ranges, displayRows, dataColumns, data, onDataChange, sortActive]);

  /** Format-map key for a body cell: `${rowId}:${columnKey}`. */
  const formatKey = useCallback((rowId: string, columnId: string) => `${rowId}:${columnId}`, []);

  /** Format entry for a visible body cell (row/col indices), or undefined. */
  const getCellFormat = useCallback(
    (rowIndex: number, colIndex: number): CellFormat | undefined => {
      const row = displayRows[rowIndex];
      const column = dataColumns[colIndex];
      if (!row || !column) return undefined;
      return cellFormats[formatKey(row.id, column.id)];
    },
    [displayRows, dataColumns, cellFormats, formatKey],
  );

  /**
   * Apply a format patch to every cell in the current selection range(s),
   * clamped to the grid extent across all data columns. Toggle/set semantics
   * live in the pure `toggleFormatForCells` helper (tested in isolation).
   */
  const applyFormatToSelection = useCallback(
    (patch: Partial<CellFormat>) => {
      const keys: string[] = [];
      for (const sel of ranges) {
        const b = getSelectionBounds(sel);
        const startRow = Math.max(0, b.startRow);
        const endRow = Math.min(displayRows.length - 1, b.endRow);
        const startCol = Math.max(0, b.startCol);
        const endCol = Math.min(dataColumns.length - 1, b.endCol);
        for (let r = startRow; r <= endRow; r++) {
          const row = displayRows[r];
          if (!row) continue;
          for (let c = startCol; c <= endCol; c++) {
            const column = dataColumns[c];
            if (!column) continue;
            keys.push(formatKey(row.id, column.id));
          }
        }
      }
      if (keys.length === 0) return;
      setCellFormats((prev) => toggleFormatForCells(prev, keys, patch));
    },
    [ranges, displayRows, dataColumns, formatKey],
  );

  const applyTextStyle = useCallback(
    (key: TextStyleKey) => applyFormatToSelection({ [key]: true }),
    [applyFormatToSelection],
  );
  const applyAlign = useCallback(
    (align: NonNullable<CellFormat["align"]>) => applyFormatToSelection({ align }),
    [applyFormatToSelection],
  );
  const applyValign = useCallback(
    (valign: NonNullable<CellFormat["valign"]>) => applyFormatToSelection({ valign }),
    [applyFormatToSelection],
  );
  const applyNumberFormat = useCallback(
    (numberFormat: CellNumberFormat) => applyFormatToSelection({ numberFormat }),
    [applyFormatToSelection],
  );

  // Active-cell format drives the toolbar's pressed states.
  const activeFormat = useMemo<CellFormat>(
    () => (activeCell ? getCellFormat(activeCell.row, activeCell.col) ?? {} : {}),
    [activeCell, getCellFormat],
  );

  // Mirror the copy-ready pattern: hand the page a fresh format API whenever the
  // handlers or the active-cell format change, so the toolbar reflects selection.
  useEffect(() => {
    onFormatApiReady?.({ applyTextStyle, applyAlign, applyValign, applyNumberFormat, active: activeFormat });
  }, [onFormatApiReady, applyTextStyle, applyAlign, applyValign, applyNumberFormat, activeFormat]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (editing) return; // input owns its own keys while open
      if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        void handleCopy();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        selectAll();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        clearSelection();
        return;
      }
      // Open the editor on the active cell: Enter / F2 (select-all), or a
      // printable character (which replaces the value, caret at end).
      if (activeCell) {
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          const row = displayRows[activeCell.row];
          if (row) {
            openEditor(
              row.id,
              activeCell.col,
              "select",
              getEditableCellText(activeCell.row, activeCell.col),
            );
          }
          return;
        }
        if (
          e.key.length === 1 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.altKey
        ) {
          e.preventDefault();
          const row = displayRows[activeCell.row];
          if (row) {
            openEditor(row.id, activeCell.col, "caret", e.key);
          }
          return;
        }
      }
      if (e.key === " " && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        // Ctrl+Space → select the active cell's column.
        if (activeCell) {
          e.preventDefault();
          selectColumn(activeCell.col);
        }
        return;
      }
      if (e.key === " " && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // Shift+Space → select the active cell's row.
        if (activeCell) {
          e.preventDefault();
          selectRow(activeCell.row);
        }
        return;
      }
      gridKeyDown(e);
    },
    [
      editing,
      activeCell,
      displayRows,
      gridKeyDown,
      handleCopy,
      selectAll,
      selectColumn,
      selectRow,
      clearSelection,
      openEditor,
      getEditableCellText,
    ],
  );

  const tableWidth = table.getTotalSize();

  /** Column ids eligible for header drag-reorder (data columns only). */
  const sortableColumnIds = useMemo(
    () => dataColumnOrder(dataColumns.map((c) => c.id)),
    [dataColumns],
  );

  const columnOverlayLabels = useMemo(
    () => Object.fromEntries(ORDER_COLUMNS.map((c) => [c.key, c.label])),
    [],
  );

  const onColumnReorder = useCallback(
    (next: string[]) => {
      // Keep the select gutter first and the row-actions column last.
      setColumnOrder([ROW_INDEX_GUTTER_ID, ...next, "rowActions"]);
    },
    [],
  );

  // The header (column-letter row + field-header row + dnd Sortable) has NO
  // selection dependency, but is otherwise rebuilt on every selection/drag render —
  // including its 15 Radix column menus. Memoize the element so React skips the
  // whole header subtree unless a header input actually changes (cols/sort/scroll).
  const gridHeader = useMemo(() => {
  const renderColumnLetterRow = () => {
    const leaves = table.getVisibleLeafColumns();
    // Letter = the column's absolute position among ALL data columns (incl.
    // hidden), so hiding a column leaves an Excel-style gap (A B C D F…) and the
    // remaining columns keep their letters, instead of re-packing.
    const ordered = table
      .getAllLeafColumns()
      .filter((c) => c.id !== ROW_INDEX_GUTTER_ID && c.id !== "rowActions");
    const letterIndexById = new Map(ordered.map((c, i) => [c.id, i] as const));
    // Visible data-column index (what selectColumn expects) keyed by column id.
    const dataIndexById = new Map(dataColumns.map((c, i) => [c.id, i] as const));
    return (
      <tr>
        {leaves.map((leaf) => {
          const isGutter = leaf.id === ROW_INDEX_GUTTER_ID;
          const isActions = leaf.id === "rowActions";
          const dataIndex = dataIndexById.get(leaf.id);
          const isDataLetter = !isGutter && !isActions && dataIndex != null;
          const pin = pinPlaygroundCell({
            pinnedLayout,
            columnId: leaf.id,
            variant: "head",
            scrolledX,
            rowIndexGutter: isGutter,
          });
          return (
            <th
              key={`letter-${leaf.id}`}
              className={cn(
                gridHeadCellClass,
                "h-6 py-0 text-center text-[10px] font-medium text-muted-foreground",
                isGutter && "cursor-pointer",
                isDataLetter && "cursor-pointer",
                pin.className,
              )}
              style={{ width: leaf.getSize(), ...pin.style }}
              {...(pin["data-pinned"] ? { "data-pinned": true as const } : {})}
              {...(isGutter ? { "aria-label": "Select all" } : {})}
              {...(isDataLetter
                ? { "aria-label": `Select column ${columnLetter(letterIndexById.get(leaf.id) ?? 0)}` }
                : {})}
              onMouseDown={(e) => {
                if (isGutter) {
                  e.preventDefault();
                  selectAll();
                } else if (isDataLetter) {
                  e.preventDefault();
                  selectColumn(dataIndex!, {
                    extend: e.shiftKey,
                    additive: e.metaKey || e.ctrlKey,
                  });
                }
              }}
            >
              {isGutter || isActions ? "" : columnLetter(letterIndexById.get(leaf.id) ?? 0)}
            </th>
          );
        })}
      </tr>
    );
  };

  const renderFieldHeaderRow = () =>
    table.getHeaderGroups().map((hg) => (
      <tr key={hg.id}>
        {hg.headers.map((h) => {
          if (h.column.id === ROW_INDEX_GUTTER_ID) {
            const pin = pinPlaygroundCell({
              pinnedLayout,
              columnId: h.column.id,
              variant: "head",
              scrolledX,
              rowIndexGutter: true,
            });
            return (
              <CanonicalSelectHeaderCell
                key={h.id}
                header={h}
                headClassName={gridHeadCellClass}
                style={pin.style}
                className={pin.className}
                data-pinned={pin["data-pinned"]}
              />
            );
          }
          const pin = pinPlaygroundCell({
            pinnedLayout,
            columnId: h.column.id,
            variant: "head",
            scrolledX,
          });
          const resizeHandle =
            columnResizeEnabled &&
            h.column.getCanResize?.() &&
            h.column.id !== "rowActions" ? (
              <span
                role="separator"
                aria-orientation="vertical"
                aria-label={`Resize ${typeof h.column.columnDef.header === "string" ? h.column.columnDef.header : h.column.id}`}
                // Keep resize from arming the column-drag Sortable (it owns the th handle).
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  h.getResizeHandler()(e);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  h.getResizeHandler()(e);
                }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none",
                  "opacity-0 transition-opacity group-hover/col:opacity-100",
                  "before:absolute before:inset-y-1 before:right-0.5 before:w-px before:bg-border",
                  h.column.getIsResizing() && "opacity-100 before:bg-primary",
                )}
              />
            ) : null;

          const isSortable = h.column.id !== "rowActions" && sortableColumnIds.includes(h.column.id);
          const headerInner = (
            <div className="group/col flex w-full items-center gap-1">
              <div className="min-w-0 flex-1">
                {h.column.getCanSort() ? (
                  <SortableColumnHeader header={h} />
                ) : (
                  flexRender(h.column.columnDef.header, h.getContext())
                )}
              </div>
              <ColumnHeaderMenu header={h} />
            </div>
          );

          if (!isSortable) {
            return (
              <th
                key={h.id}
                className={cn(gridHeadCellClass, "group/col relative", pin.className)}
                style={{ width: h.getSize(), ...pin.style }}
                {...(pin["data-pinned"] ? { "data-pinned": true as const } : {})}
              >
                {headerInner}
                {resizeHandle}
              </th>
            );
          }

          return (
            <SortableItem
              key={h.id}
              value={h.column.id}
              asChild
              asHandle
              {...sortableDropTargetProps(h.column.id)}
            >
              <th
                className={cn(gridHeadCellClass, "group/col relative", pin.className)}
                style={{ width: h.getSize(), ...pin.style }}
                {...(pin["data-pinned"] ? { "data-pinned": true as const } : {})}
              >
                {headerInner}
                {resizeHandle}
              </th>
            </SortableItem>
          );
        })}
      </tr>
    ));

    // Only the <thead> is memoized — its inputs are all stable across selection.
    // The <Sortable> wrapper (whose dnd props are intentionally fresh each render)
    // stays in the return; because this thead element identity is stable, React
    // skips reconciling the 15 Radix column menus even when the dnd context churns.
    return (
      <thead className={gridHeaderClass}>
        {renderColumnLetterRow()}
        {renderFieldHeaderRow()}
      </thead>
    );
  }, [
    table,
    pinnedLayout,
    scrolledX,
    dataColumns,
    selectColumn,
    selectAll,
    columnResizeEnabled,
    sortableColumnIds,
  ]);

  /**
   * Render a body data cell's content with its per-cell format applied. Status
   * keeps its badge; numeric columns honor a numberFormat override (display
   * only); text style + alignment are layered on a wrapping span. Falls back to
   * the column's default formatter when no override is set.
   */
  /** Shared cell rendering for all body bands (frozen + center). */
  const renderRowCells = (
    row: (typeof displayRows)[number],
    rowIndex: number,
    options?: { inFrozenRowBand?: boolean },
  ) => {
    const inFrozenRowBand = options?.inFrozenRowBand ?? false;
    let dataColIndex = -1;
    const rowHeightPx = getRowHeightPx(row.id);
    return row.getVisibleCells().map((cell) => {
      const isGutter = cell.column.id === ROW_INDEX_GUTTER_ID;
      const isActions = cell.column.id === "rowActions";
      const mode = isGutter ? getSelectColumnMode(cell.column) : undefined;
      const isBodyCell = !isGutter && !isActions;
      if (isBodyCell) dataColIndex += 1;
      const colIndex = dataColIndex;
      let pin = inFrozenRowBand
        ? getPinnedFreezeCell(cell.column.id, row.id, rowIndex, isGutter)
        : getPinnedBodyCell(cell.column.id, rowIndex, isGutter);
      if (isGutter && inFrozenRowBand && pin.style) {
        pin = { ...pin, className: cn(gridRowHeaderPinnedBodyFillClass, pin.className) };
      }
      const columnSize = cell.column.getSize();

      // --- Non-body cells (row-index gutter, row actions) — never selectable,
      // no selection chrome/editing/fill, so they render inline (and cheaply). ---
      if (!isBodyCell) {
        if (isGutter) {
          return (
            <td
              key={cell.id}
              {...selectColumnRowHeaderProps(mode)}
              {...(pin["data-pinned"] ? { "data-pinned": true as const } : {})}
              onMouseDown={(e) => {
                e.preventDefault();
                selectRow(rowIndex, { extend: e.shiftKey, additive: e.metaKey || e.ctrlKey });
              }}
              className={cn(
                selectColumnTdClass(mode, gridCellClass, { pinned: !!pin.style }),
                "relative cursor-pointer",
                pin.className,
              )}
              style={{ flex: `0 0 ${columnSize}px`, width: columnSize, ...pin.style }}
              aria-label={`Select row ${rowIndex + 1}`}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
              <RowBottomResizeHandle
                enabled={rowResizeEnabled}
                rowLabel={String(rowIndex + 1)}
                startHeightPx={rowHeightPx}
                onHeightChange={(height) => setRowHeightPx(row.id, height)}
              />
            </td>
          );
        }
        return (
          <td
            key={cell.id}
            {...(pin["data-pinned"] ? { "data-pinned": true as const } : {})}
            className={cn(gridCellClass, pin.className)}
            style={{ flex: `0 0 ${columnSize}px`, width: columnSize, ...pin.style }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        );
      }

      // --- Body cell — compute the selection/preview chrome booleans (cheap; no
      // DOM) and hand them to the memoized BodyCell. Unchanged cells skip the
      // costly <td> reconciliation on a selection change. ---
      const selected = isSelected(rowIndex, colIndex);
      const edgeTop = selected && !isSelected(rowIndex - 1, colIndex);
      const edgeBottom = selected && !isSelected(rowIndex + 1, colIndex);
      const edgeLeft = selected && !isSelected(rowIndex, colIndex - 1);
      const edgeRight = selected && !isSelected(rowIndex, colIndex + 1);
      const isActiveCell =
        selection != null &&
        isCellSelection(selection) &&
        rowIndex === selection.end.row &&
        colIndex === selection.end.col;
      const inPreview = inFillPreview(rowIndex, colIndex);
      const previewEdgeTop = inPreview && !inFillPreview(rowIndex - 1, colIndex);
      const previewEdgeBottom = inPreview && !inFillPreview(rowIndex + 1, colIndex);
      const previewEdgeLeft = inPreview && !inFillPreview(rowIndex, colIndex - 1);
      const previewEdgeRight = inPreview && !inFillPreview(rowIndex, colIndex + 1);
      const showFillHandle =
        !sortActive &&
        fillBounds != null &&
        rowIndex === fillBounds.endRow &&
        colIndex === fillBounds.endCol;
      const isEditingCell = editing != null && editing.rowId === row.id && editing.col === colIndex;

      return (
        <BodyCell
          key={cell.id}
          columnId={cell.column.id as keyof OrderRow}
          columnSize={columnSize}
          rowId={row.id}
          rowOriginal={row.original}
          rowIndex={rowIndex}
          colIndex={colIndex}
          pinStyle={pin.style}
          pinClassName={pin.className}
          dataPinned={!!pin["data-pinned"]}
          selected={selected}
          edgeTop={edgeTop}
          edgeBottom={edgeBottom}
          edgeLeft={edgeLeft}
          edgeRight={edgeRight}
          isActiveCell={isActiveCell}
          inPreview={inPreview}
          previewEdgeTop={previewEdgeTop}
          previewEdgeBottom={previewEdgeBottom}
          previewEdgeLeft={previewEdgeLeft}
          previewEdgeRight={previewEdgeRight}
          showFillHandle={showFillHandle}
          format={getCellFormat(rowIndex, colIndex)}
          isEditing={isEditingCell}
          editValue={isEditingCell ? editValue : ""}
          handlers={bodyCellHandlers}
        />
      );
    });
  };

  /** Frozen top body rows — tr sticky band + cell-level corner stickiness for pinned cols. */
  const renderFrozenRow = (row: (typeof displayRows)[number], bandIndex: number) => {
    const rowHeightPx = getRowHeightPx(row.id);
    const rowSticky =
      getFrozenRowStickyStyle(rowLayout, row.id, { headerOffsetPx: sections.headerOffsetPx }) ??
      ({
        position: "sticky" as const,
        top: sections.headerOffsetPx + bandIndex * rowHeightPx,
        zIndex: 21 - bandIndex,
      });
    return (
      <tr
        key={row.id}
        className={cn(gridRowClass, "group/row", neutralTanStackRowFillClass(tokens, row.index))}
        style={{
          display: "flex",
          width: tableWidth,
          minHeight: rowHeightPx,
          height: rowHeightPx,
          ...rowSticky,
        }}
      >
        {renderRowCells(row, row.index, { inFrozenRowBand: true })}
      </tr>
    );
  };

  const multiCellSelection = (() => {
    if (!selection || !isCellSelection(selection)) return false;
    const b = getSelectionBounds(selection);
    return b.startRow !== b.endRow || b.startCol !== b.endCol;
  })();

  // Surface "copyable range active" to the page so the always-present status
  // bar (not a toggling row above the grid) can offer Copy — no layout jump.
  useEffect(() => {
    onCopyAvailableChange?.(multiCellSelection);
  }, [multiCellSelection, onCopyAvailableChange]);

  const tbodyHeight = totalSizeWithBandOffset;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EngineScrollTableShell viewportRef={viewportRef} className="h-[calc(100dvh-19rem)] min-h-[18rem] max-h-none">
        <div
          ref={sortableDrop.containerRef}
          className={sortableDrop.containerClassName}
        >
          <div
            role="grid"
            aria-label="Orders"
            aria-rowcount={displayRows.length}
            aria-colcount={dataColumns.length}
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
                {table.getVisibleLeafColumns().map((col) => (
                  <col key={col.id} style={{ width: col.getSize() }} />
                ))}
              </colgroup>
              {/* Column drag-reorder Sortable wraps the memoized <thead> (gridHeader). */}
              <Sortable
                value={sortableColumnIds}
                onValueChange={onColumnReorder}
                orientation="horizontal"
                flatCursor
                {...sortableDrop.columnSortableProps}
              >
                <SortableContent withoutSlot>{gridHeader}</SortableContent>
                <SortableOverlay dropAnimation={null}>
                  {({ value }) => {
                    const id = String(value);
                    const col = table.getColumn(id);
                    return (
                      <SortableColumnDragOverlay
                        label={columnOverlayLabels[id] ?? id}
                        widthPx={col?.getSize() ?? 80}
                        heightPx={NEUTRAL_TABLE_HEADER_HEIGHT_PX}
                        className={gridHeadCellClass}
                      />
                    );
                  }}
                </SortableOverlay>
              </Sortable>
              <tbody
                className={gridBodyHoverClass}
                style={{ height: tbodyHeight, position: "relative", display: "block", width: tableWidth }}
              >
                {sections.frozenTopRows.map((row, bandIndex) => renderFrozenRow(row, bandIndex))}
                {virtualRows.map((vr) => {
                  const row = sections.centerRows[vr.index]!;
                  const rowHeightPx = getRowHeightPx(row.id);
                  return (
                    <tr
                      key={row.id}
                      data-index={vr.index}
                      ref={measureElement}
                      className={cn(
                        gridRowClass,
                        "group/row",
                        neutralTanStackRowFillClass(tokens, row.index),
                      )}
                      style={{
                        // Round the absolute top so adjacent rows don't land on
                        // sub-pixel offsets that leave a 1px seam between their
                        // box-shadow selection edges.
                        ...getVirtualTableRowStyle(Math.round(vr.start), tableWidth, {
                          bandOffsetPx: Math.round(bandOffsetPx),
                        }),
                        // Overlap the next row by 1px so the inset edge lines of a
                        // multi-row selection meet with no horizontal break.
                        height: rowHeightPx + 1,
                        minHeight: rowHeightPx + 1,
                      }}
                    >
                      {renderRowCells(row, row.index)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sortableDrop.indicators}
        </div>
      </EngineScrollTableShell>
    </div>
  );
}

/**
 * Memoized so the page re-rendering on selection-derived state it OWNS (formula-bar
 * value, status-bar numbers, active-cell ref) does not re-render the whole grid.
 * GridView pushes those up via stable `useCallback` props, so the shallow compare
 * bails and a click commits just ONE grid render instead of three.
 */
export const GridView = memo(GridViewImpl);
