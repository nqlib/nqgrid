import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@nqlib/nqui";
import { matrixToTsv } from "@nqlib/nqgrid";
import { MenuBar } from "./menu-bar";
import { FormulaBar } from "./formula-bar";
import { Toolbar } from "./toolbar";
import { GridView, type FormatApi } from "./grid-view";
import { PivotView } from "./pivot-view";
import { SummaryView } from "./summary-view";
import { SheetTabs, type SheetId } from "./sheet-tabs";
import { StatusBar } from "./status-bar";
import {
  readSheetCanvasMode,
  SHEET_CANVAS_STORAGE_KEY,
  type SheetCanvasMode,
} from "./infinite-sheet-canvas";
import {
  DEFAULT_SHEET_RESIZE,
  readSheetResizePreferences,
  SHEET_RESIZE_STORAGE_KEY,
  type SheetResizePreferences,
} from "./sheet-resize-preferences";
import { ORDER_COLUMNS, SALES_ORDERS, type OrderRow } from "./mock-data";
import { FindReplaceDialog } from "./find-replace-dialog";
import { ChartDialog } from "./chart-dialog";
import {
  applyReplaceAll,
  applyReplaceFirst,
  type FindReplaceColumn,
  type FindReplaceOptions,
} from "./find-replace";
import { historyReducer, type HistoryState } from "./sheet-edit";
import type { CellFormat, CellNumberFormat, TextStyleKey } from "./format";

/** Excel-style freeze origin: number of leading data columns + body rows frozen. */
export interface FrozenPane {
  /** Leading DATA columns frozen at inline-start (0 = none). */
  col: number;
  /** Leading body rows frozen below the header (0 = none). */
  row: number;
}

/** Default ≈ current behavior: header + first 2 data columns frozen, 1 body row. */
const DEFAULT_FROZEN_PANE: FrozenPane = { row: 1, col: 2 };

/** Build a CSV blob from the orders fixture and trigger a download. */
function exportOrdersCsv(rows: readonly OrderRow[]) {
  const header = ORDER_COLUMNS.map((c) => c.label);
  const body = rows.map((row) => ORDER_COLUMNS.map((c) => String(row[c.key] ?? "")));
  // matrixToTsv gives us tab-joined rows; swap to commas + quote for CSV.
  const tsv = matrixToTsv([header, ...body]);
  const csv = tsv
    .split("\n")
    .map((line) =>
      line
        .split("\t")
        .map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "orders.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** Excel / Sheets-style spreadsheet page over the SALES_ORDERS fixture. */
const SHEET_STORAGE_KEY = "nqgrid-spreadsheet-sheet";

/** Columns the find & replace spans — full ledger, in display order. */
const FIND_REPLACE_COLUMNS: FindReplaceColumn[] = ORDER_COLUMNS.map((c) => ({
  key: c.key,
  numeric: c.numeric,
}));

export function SpreadsheetPage() {
  const [activeSheet, setActiveSheet] = useState<SheetId>(() => {
    try {
      return (localStorage.getItem(SHEET_STORAGE_KEY) as SheetId | null) ?? "orders";
    } catch {
      return "orders";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SHEET_STORAGE_KEY, activeSheet);
    } catch {
      /* ignore */
    }
  }, [activeSheet]);
  const [search, setSearch] = useState("");
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [frozenPane, setFrozenPane] = useState<FrozenPane>(DEFAULT_FROZEN_PANE);
  const [groupByKey, setGroupByKey] = useState<string | null>(null);
  const [sheetCanvasMode, setSheetCanvasMode] = useState<SheetCanvasMode>(() =>
    readSheetCanvasMode("infinite"),
  );
  const [sheetResize, setSheetResize] = useState<SheetResizePreferences>(() =>
    readSheetResizePreferences(),
  );
  useEffect(() => {
    try {
      localStorage.setItem(SHEET_CANVAS_STORAGE_KEY, sheetCanvasMode);
    } catch {
      /* ignore */
    }
  }, [sheetCanvasMode]);
  useEffect(() => {
    try {
      localStorage.setItem(SHEET_RESIZE_STORAGE_KEY, JSON.stringify(sheetResize));
    } catch {
      /* ignore */
    }
  }, [sheetResize]);
  const [activeCellRef, setActiveCellRef] = useState("");
  const [activeCellValue, setActiveCellValue] = useState("");
  const [selectionNumbers, setSelectionNumbers] = useState<number[]>([]);
  const [copyAvailable, setCopyAvailable] = useState(false);
  // Live active-cell indices (selection end), used to derive a freeze origin.
  const activeCellIndexRef = useRef<{ row: number; col: number } | null>(null);
  const copyRef = useRef<(() => void) | null>(null);
  // Per-cell formatting API supplied by GridView (mirrors copyRef); `activeFormat`
  // is the active cell's format, lifted so the toolbar shows pressed states.
  const formatApiRef = useRef<FormatApi | null>(null);
  const [activeFormat, setActiveFormat] = useState<CellFormat>({});
  // Commits a value to the grid's ACTIVE cell — supplied by GridView, called by
  // the formula bar (same pattern as copyRef).
  const activeCellCommitRef = useRef<((value: string) => void) | null>(null);

  // Master row order + cell values — every mutation (edit, fill, delete, row
  // move) routes through `commitData`, making it undoable. The grid reads
  // `data`, not the SALES_ORDERS import, so changes survive re-renders.
  const initialHistory: HistoryState = { past: [], present: SALES_ORDERS, future: [] };
  const [history, dispatchHistory] = useReducer(historyReducer, initialHistory);
  const data = history.present;
  const commitData = useCallback((next: OrderRow[]) => {
    dispatchHistory({ type: "commit", next });
  }, []);
  const undo = useCallback(() => dispatchHistory({ type: "undo" }), []);
  const redo = useCallback(() => dispatchHistory({ type: "redo" }), []);
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // Find & replace: apply across all columns and commit once (one undo step).
  // Returns the number of cells changed so the dialog can report it.
  const handleReplaceAll = useCallback(
    (query: string, replacement: string, opts: FindReplaceOptions) => {
      const { next, replaced } = applyReplaceAll(
        data,
        FIND_REPLACE_COLUMNS,
        query,
        replacement,
        opts,
      );
      if (replaced > 0) commitData(next);
      return replaced;
    },
    [data, commitData],
  );

  const handleReplaceFirst = useCallback(
    (query: string, replacement: string, opts: FindReplaceOptions) => {
      const { next, replaced } = applyReplaceFirst(
        data,
        FIND_REPLACE_COLUMNS,
        query,
        replacement,
        opts,
      );
      if (replaced > 0) commitData(next);
      return replaced;
    },
    [data, commitData],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      ORDER_COLUMNS.some((c) => String(row[c.key] ?? "").toLowerCase().includes(q)),
    );
  }, [search, data]);

  const onActiveCellChange = useCallback((ref: string, value: string) => {
    setActiveCellRef(ref);
    setActiveCellValue(value);
  }, []);

  const onActiveCellIndexChange = useCallback((cell: { row: number; col: number } | null) => {
    activeCellIndexRef.current = cell;
  }, []);

  const onSelectionNumbersChange = useCallback((numbers: number[]) => {
    setSelectionNumbers(numbers);
  }, []);

  const handleGroupBy = useCallback((dimensionKey: string) => {
    setGroupByKey((prev) => (prev === dimensionKey ? null : dimensionKey));
    setActiveSheet("summary");
  }, []);

  const handleCopy = useCallback(() => {
    copyRef.current?.();
  }, []);

  const onCopyReady = useCallback((copy: () => void) => {
    copyRef.current = copy;
  }, []);

  const onActiveCellCommitReady = useCallback((commit: (value: string) => void) => {
    activeCellCommitRef.current = commit;
  }, []);

  const onFormatApiReady = useCallback((api: FormatApi) => {
    formatApiRef.current = api;
    setActiveFormat(api.active);
  }, []);

  const handleApplyTextStyle = useCallback((key: TextStyleKey) => {
    formatApiRef.current?.applyTextStyle(key);
  }, []);
  const handleApplyAlign = useCallback((align: NonNullable<CellFormat["align"]>) => {
    formatApiRef.current?.applyAlign(align);
  }, []);
  const handleApplyValign = useCallback((valign: NonNullable<CellFormat["valign"]>) => {
    formatApiRef.current?.applyValign(valign);
  }, []);
  const handleApplyNumberFormat = useCallback((format: CellNumberFormat) => {
    formatApiRef.current?.applyNumberFormat(format);
  }, []);

  const handleFormulaCommit = useCallback((value: string) => {
    activeCellCommitRef.current?.(value);
  }, []);

  // Global undo/redo. Ignore the shortcut while an editable field is focused so
  // it doesn't fight in-cell or formula-bar editing.
  useEffect(() => {
    const isEditingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (isEditingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      } else if (key === "h") {
        e.preventDefault();
        setFindReplaceOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Excel "Freeze panes": freeze columns LEFT of and rows ABOVE the active cell.
  const handleFreezePanes = useCallback(() => {
    const cell = activeCellIndexRef.current;
    if (!cell) return;
    setFrozenPane({ col: cell.col, row: cell.row });
  }, []);

  const handleFreezeTopRow = useCallback(() => {
    setFrozenPane((p) => ({ col: p.col, row: 1 }));
  }, []);

  const handleFreezeFirstColumn = useCallback(() => {
    setFrozenPane((p) => ({ col: 1, row: p.row }));
  }, []);

  const handleUnfreezeAll = useCallback(() => {
    setFrozenPane({ col: 0, row: 0 });
  }, []);

  const isOrders = activeSheet === "orders";
  const isAnalyticsSheet = activeSheet === "pivot" || activeSheet === "summary";
  const showEmpty = isOrders && filteredRows.length === 0;
  const freezeActive = frozenPane.col > 0 || frozenPane.row > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-muted/40">
      <MenuBar
        onExportCsv={() => exportOrdersCsv(filteredRows)}
        onCopy={handleCopy}
        onSelectAll={() => setActiveSheet("orders")}
        onFreezePanes={handleFreezePanes}
        onFreezeTopRow={handleFreezeTopRow}
        onFreezeFirstColumn={handleFreezeFirstColumn}
        onUnfreezeAll={handleUnfreezeAll}
        freezeActive={freezeActive}
        onGroupBy={handleGroupBy}
        onOpenPivot={() => setActiveSheet("pivot")}
        canCopy={!showEmpty}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onFindReplace={() => setFindReplaceOpen(true)}
        onInsertChart={() => setChartOpen(true)}
      />
      <FormulaBar
        cellRef={activeCellRef}
        value={activeCellValue}
        editable={isOrders}
        onCommit={handleFormulaCommit}
      />
      <Toolbar
        search={search}
        onSearchChange={setSearch}
        frozenPane={frozenPane}
        onFreezePanes={handleFreezePanes}
        onFreezeTopRow={handleFreezeTopRow}
        onFreezeFirstColumn={handleFreezeFirstColumn}
        onUnfreezeAll={handleUnfreezeAll}
        onGroupBy={handleGroupBy}
        groupByKey={groupByKey}
        pivotActive={activeSheet === "pivot"}
        onTogglePivot={() => setActiveSheet((s) => (s === "pivot" ? "orders" : "pivot"))}
        searchDisabled={!isOrders}
        showAnalyticsCanvasToggle={isAnalyticsSheet}
        analyticsCanvasMode={sheetCanvasMode}
        onAnalyticsCanvasModeChange={setSheetCanvasMode}
        columnResizeEnabled={sheetResize.columnResize}
        rowResizeEnabled={sheetResize.rowResize}
        onColumnResizeEnabledChange={(columnResize) =>
          setSheetResize((prev) => ({ ...prev, columnResize }))
        }
        onRowResizeEnabledChange={(rowResize) =>
          setSheetResize((prev) => ({ ...prev, rowResize }))
        }
        onApplyTextStyle={handleApplyTextStyle}
        onApplyAlign={handleApplyAlign}
        onApplyValign={handleApplyValign}
        onApplyNumberFormat={handleApplyNumberFormat}
        activeFormat={activeFormat}
        formattingDisabled={!isOrders}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        {showEmpty ? (
          <Empty className="min-h-0 flex-1 border-0 bg-transparent">
            <EmptyHeader>
              <EmptyTitle>No orders match this filter</EmptyTitle>
              <EmptyDescription>Clear the search to see all 2,000 orders.</EmptyDescription>
            </EmptyHeader>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setSearch("")}>
              Clear filter
            </Button>
          </Empty>
        ) : isOrders ? (
          <GridView
            data={data}
            onDataChange={commitData}
            search={search}
            frozenPane={frozenPane}
            onActiveCellChange={onActiveCellChange}
            onActiveCellIndexChange={onActiveCellIndexChange}
            onSelectionNumbersChange={onSelectionNumbersChange}
            onCopyReady={onCopyReady}
            onActiveCellCommitReady={onActiveCellCommitReady}
            onFormatApiReady={onFormatApiReady}
            onCopyAvailableChange={setCopyAvailable}
            columnResizeEnabled={sheetResize.columnResize}
            rowResizeEnabled={sheetResize.rowResize}
            bodyRowHeightPx={sheetResize.bodyRowHeightPx}
          />
        ) : activeSheet === "pivot" ? (
          <PivotView
            data={data}
            canvasMode={sheetCanvasMode}
            columnResizeEnabled={sheetResize.columnResize}
            rowResizeEnabled={sheetResize.rowResize}
            bodyRowHeightPx={sheetResize.bodyRowHeightPx}
            onActiveCellChange={onActiveCellChange}
            onActiveCellIndexChange={onActiveCellIndexChange}
            onSelectionNumbersChange={onSelectionNumbersChange}
            onCopyReady={onCopyReady}
          />
        ) : (
          <SummaryView
            data={data}
            canvasMode={sheetCanvasMode}
            columnResizeEnabled={sheetResize.columnResize}
            rowResizeEnabled={sheetResize.rowResize}
            bodyRowHeightPx={sheetResize.bodyRowHeightPx}
            onActiveCellChange={onActiveCellChange}
            onActiveCellIndexChange={onActiveCellIndexChange}
            onSelectionNumbersChange={onSelectionNumbersChange}
            onCopyReady={onCopyReady}
          />
        )}
      </div>

      <StatusBar
        selectedNumbers={selectionNumbers}
        rowCount={isOrders ? filteredRows.length : data.length}
        filterActive={search.trim().length > 0}
        onCopy={handleCopy}
        canCopy={isOrders && copyAvailable}
      />
      <SheetTabs active={activeSheet} onChange={setActiveSheet} />

      <FindReplaceDialog
        open={findReplaceOpen}
        onOpenChange={setFindReplaceOpen}
        data={data}
        onReplaceAll={handleReplaceAll}
        onReplaceFirst={handleReplaceFirst}
      />

      <ChartDialog open={chartOpen} onOpenChange={setChartOpen} data={data} />
    </div>
  );
}
