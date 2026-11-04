import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnOrderState,
  type ExpandedState,
  type GroupingState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Badge, Button, cn, Input } from "@nqlib/nqui";
import { Sortable, SortableContent, SortableItem, SortableOverlay } from "@nqlib/nqui/sortable";
import {
  EMPTY_ROW_SELECTION,
  VirtualDataManager,
  copyMatrixToClipboard,
  getOutlineRowIndentStyle,
  getSelectionBounds,
  getVirtualTableRowStyle,
  isCellSelection,
  useGridKeyboard,
  useTableRowVirtualizer,
  type SelectionRange,
  type VirtualDataSource,
} from "@nqlib/nqgrid";
import {
  NEUTRAL_TABLE_ROW_HEIGHT_PX,
  neutralTanStackRowFillClass,
  useNeutralPlaygroundTable,
} from "../lib/playground-neutral-table";
import {
  createSelectColumn,
  dataColumnOrder,
  getSelectColumnMode,
  selectColumnRowHeaderProps,
  selectColumnTdClass,
} from "../lib/playground-canonical-select-column";
import { CanonicalSelectHeaderCell } from "../lib/playground-canonical-header-cell";
import { SortableColumnHeader } from "../lib/sortable-column-header";
import {
  pinPlaygroundCell,
  ROW_INDEX_GUTTER_ID,
  usePlaygroundPinnedLayout,
} from "../lib/playground-row-index-gutter";
import {
  gridBodyHoverClass,
  gridCellClass,
  gridHeadCellClass,
  gridHeaderClass,
  gridNumericClass,
  gridRowClass,
  gridTableClass,
} from "../lib/grid-styles";
import { SortableDragOverlay } from "../lib/playground-sortable-drag-chrome";
import {
  sortableDropTargetProps,
  usePlaygroundSortableTableDropIndicators,
} from "../lib/playground-sortable-drop-indicator";
import { EngineScrollTableShell, useEngineScrollViewport } from "../parity/engine-scroll-table-shell";
import type { EngineLabFeatureId } from "./engine-lab-config";
import { ColumnHeaderMenu, RowActionsMenu, SpreadsheetColumnsMenu } from "./engine-lab-table-menus";
import {
  ENGINE_LAB_CLIENT_ROWS,
  ENGINE_LAB_COLUMN_HEADERS,
  ENGINE_LAB_COLUMN_WIDTHS,
  engineLabStatusLabel,
  engineLabVirtualCell,
  formatEngineLabCurrency,
  type EngineLabCommitmentStatus,
  type EngineLabRow,
} from "./engine-lab-mock-data";

const VIRTUAL_ROW_COUNT = 10_000;
const VIRTUAL_VISIBLE = 24;

type VirtualStub = { id: string; index: number };

const columnHelper = createColumnHelper<EngineLabRow>();
const stubHelper = createColumnHelper<VirtualStub>();

function statusBadgeClass(status: EngineLabCommitmentStatus): string {
  switch (status) {
    case "on_track":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "at_risk":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-400";
    case "over_budget":
      return "bg-destructive/15 text-destructive";
    case "closed":
      return "bg-muted text-muted-foreground";
  }
}

function makeVirtualSource(delayMs: number): VirtualDataSource {
  return {
    rowCount: VIRTUAL_ROW_COUNT,
    columnCount: ENGINE_LAB_COLUMN_HEADERS.length,
    pageSize: 200,
    prefetch: true,
    async fetchRows(offset, limit) {
      await new Promise((r) => setTimeout(r, delayMs));
      return Array.from({ length: limit }, (_, i) => {
        const row = offset + i;
        return ENGINE_LAB_COLUMN_HEADERS.map((_, col) => engineLabVirtualCell(row, col));
      });
    },
  };
}

function filterRows(rows: EngineLabRow[], query: string): EngineLabRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.wbs.toLowerCase().includes(q) ||
      r.project.toLowerCase().includes(q) ||
      r.costCenter.toLowerCase().includes(q) ||
      r.glAccount.toLowerCase().includes(q) ||
      r.manager.toLowerCase().includes(q),
  );
}

function selectionSummary(sel: SelectionRange | null): string {
  if (!sel) return "None";
  const b = getSelectionBounds(sel);
  if (isCellSelection(sel)) {
    const rows = b.endRow - b.startRow + 1;
    const cols = b.endCol - b.startCol + 1;
    return rows === 1 && cols === 1 ? `Cell ${b.startRow + 1}:${b.startCol + 1}` : `${rows}×${cols} cells`;
  }
  return `${sel.type} selection`;
}

export function EngineLabTable({ active }: { active: ReadonlySet<EngineLabFeatureId> }) {
  const virtualMode = active.has("infiniteRows");
  const sortEnabled = active.has("sort");
  const filterEnabled = active.has("filter");
  const pinEnabled = active.has("pinColumns");
  const paginationEnabled = active.has("pagination") && !virtualMode;
  const groupingEnabled = active.has("grouping") && !virtualMode;
  const selectionEnabled = active.has("selectionLab") && !virtualMode;
  const rangeEnabled = active.has("rangeSelect") && !virtualMode;
  const detailEnabled = active.has("masterDetail") && !virtualMode;
  const richEnabled = active.has("richCells");
  const currencyEnabled = active.has("numberFormats");
  const rowDnDEnabled = selectionEnabled && !groupingEnabled;

  const [clientData, setClientData] = useState(ENGINE_LAB_CLIENT_ROWS);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(EMPTY_ROW_SELECTION);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [selection, setSelection] = useState<SelectionRange | null>(
    rangeEnabled ? { type: "cell", start: { row: 0, col: 0 }, end: { row: 0, col: 0 } } : null,
  );
  const [copied, setCopied] = useState(false);
  const [latency, setLatency] = useState(200);
  const [, bumpVirtual] = useState(0);

  const managerRef = useRef<VirtualDataManager | null>(null);
  const { viewportRef, scrollRoot, scrolledX } = useEngineScrollViewport(true);
  const { tokens, bundle } = useNeutralPlaygroundTable();
  const sortableDrop = usePlaygroundSortableTableDropIndicators();

  const selectMode = selectionEnabled ? ("index+checkbox" as const) : ("index" as const);

  useEffect(() => {
    if (!virtualMode) {
      managerRef.current = null;
      return;
    }
    const mgr = new VirtualDataManager(makeVirtualSource(latency), { cacheSize: 16 });
    managerRef.current = mgr;
    const unsub = mgr.subscribe(() => bumpVirtual((n) => n + 1));
    void mgr.ensureLoaded(0, VIRTUAL_VISIBLE);
    return () => {
      unsub();
      managerRef.current = null;
    };
  }, [virtualMode, latency]);

  useEffect(() => {
    if (groupingEnabled) setGrouping(["costCenter"]);
    else setGrouping([]);
  }, [groupingEnabled]);

  const filteredClient = useMemo(
    () => (filterEnabled ? filterRows(clientData, globalFilter) : clientData),
    [clientData, filterEnabled, globalFilter],
  );

  const stubData = useMemo(
    () =>
      Array.from({ length: VIRTUAL_ROW_COUNT }, (_, index) => ({
        id: String(index),
        index,
      })),
    [],
  );

  const filteredStub = useMemo(() => {
    if (!virtualMode || !filterEnabled || !globalFilter.trim()) return stubData;
    const q = globalFilter.trim();
    return stubData.filter((row) => String(row.index + 1).includes(q) || row.id.includes(q));
  }, [stubData, virtualMode, filterEnabled, globalFilter]);

  const duplicateRow = useCallback((id: string) => {
    setClientData((rows) => {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) return rows;
      const original = rows[idx]!;
      const copy = { ...original, id: `${original.id}-copy-${rows.length}` };
      const next = [...rows];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const deleteRow = useCallback((id: string) => {
    setClientData((rows) => rows.filter((r) => r.id !== id));
  }, []);

  const clientColumns = useMemo(() => {
    const money = (value: number) =>
      currencyEnabled ? formatEngineLabCurrency(value) : value.toLocaleString();
    return [
      createSelectColumn(columnHelper, {
        mode: selectMode,
        getRowLabel: (r) => r.wbs,
      }),
      columnHelper.accessor("wbs", {
        id: "wbs",
        header: "WBS",
        size: ENGINE_LAB_COLUMN_WIDTHS[0],
        enableSorting: sortEnabled,
      }),
      columnHelper.accessor("project", {
        id: "project",
        header: "Program",
        size: ENGINE_LAB_COLUMN_WIDTHS[1],
        enableSorting: sortEnabled,
      }),
      columnHelper.accessor("costCenter", {
        id: "costCenter",
        header: "Cost center",
        size: ENGINE_LAB_COLUMN_WIDTHS[2],
        enableGrouping: groupingEnabled,
      }),
      columnHelper.accessor("glAccount", {
        id: "glAccount",
        header: "GL account",
        size: ENGINE_LAB_COLUMN_WIDTHS[3],
      }),
      columnHelper.accessor("budgetUsd", {
        id: "budgetUsd",
        header: () => <span className="w-full text-right">Budget</span>,
        size: ENGINE_LAB_COLUMN_WIDTHS[4],
        enableSorting: sortEnabled,
        cell: (i) => <span className={gridNumericClass}>{money(i.getValue())}</span>,
      }),
      columnHelper.accessor("actualUsd", {
        id: "actualUsd",
        header: () => <span className="w-full text-right">Actual</span>,
        size: ENGINE_LAB_COLUMN_WIDTHS[5],
        enableSorting: sortEnabled,
        cell: (i) => <span className={gridNumericClass}>{money(i.getValue())}</span>,
      }),
      columnHelper.accessor("variancePct", {
        id: "variancePct",
        header: () => <span className="w-full text-right">Var %</span>,
        size: ENGINE_LAB_COLUMN_WIDTHS[6],
        enableSorting: sortEnabled,
        aggregationFn: "mean",
        cell: (i) => (
          <span className={cn(gridNumericClass, i.getValue() > 0 && "text-destructive")}>
            {i.getValue() > 0 ? "+" : ""}
            {i.getValue()}%
          </span>
        ),
      }),
      columnHelper.accessor("period", { id: "period", header: "Period", size: ENGINE_LAB_COLUMN_WIDTHS[7] }),
      columnHelper.accessor("manager", { id: "manager", header: "Manager", size: ENGINE_LAB_COLUMN_WIDTHS[8] }),
      columnHelper.accessor("status", {
        id: "status",
        header: "Status",
        size: ENGINE_LAB_COLUMN_WIDTHS[9],
        cell: (i) => {
          const status = i.getValue();
          if (richEnabled) {
            return (
              <Badge variant="secondary" className={cn("font-normal", statusBadgeClass(status))}>
                {engineLabStatusLabel(status)}
              </Badge>
            );
          }
          return engineLabStatusLabel(status);
        },
      }),
      ...(detailEnabled
        ? [
            columnHelper.display({
              id: "expand",
              header: "",
              size: 40,
              cell: ({ row }) =>
                row.original.detail ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={row.getToggleExpandedHandler()}
                  >
                    {row.getIsExpanded() ? "▼" : "▶"}
                  </Button>
                ) : null,
            }),
          ]
        : []),
      columnHelper.display({
        id: "rowActions",
        header: "",
        size: 44,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <RowActionsMenu
            label={row.original.wbs}
            onDuplicate={() => duplicateRow(row.original.id)}
            onDelete={() => deleteRow(row.original.id)}
          />
        ),
      }),
    ];
  }, [currencyEnabled, deleteRow, detailEnabled, duplicateRow, groupingEnabled, richEnabled, selectMode, sortEnabled]);

  const virtualColumns = useMemo(
    () => [
      createSelectColumn(stubHelper, { mode: "index" }),
      ...ENGINE_LAB_COLUMN_HEADERS.map((header, colIndex) =>
        stubHelper.display({
          id: `col-${colIndex}`,
          header,
          size: ENGINE_LAB_COLUMN_WIDTHS[colIndex],
          enableSorting: sortEnabled && colIndex === 0,
          sortingFn:
            colIndex === 0 ? (a, b) => a.original.index - b.original.index : undefined,
          cell: ({ row }) => {
            const mgr = managerRef.current;
            const value = mgr?.getCell(row.original.index, colIndex);
            if (value != null) {
              if (currencyEnabled && (colIndex === 4 || colIndex === 5)) {
                return (
                  <span className={gridNumericClass}>
                    {formatEngineLabCurrency(Number(value))}
                  </span>
                );
              }
              if (colIndex === 4 || colIndex === 5 || colIndex === 6) {
                return <span className={gridNumericClass}>{value}</span>;
              }
              return value;
            }
            return (
              <div className="h-2.5 w-20 max-w-full animate-pulse rounded bg-muted" aria-hidden />
            );
          },
        }),
      ),
    ],
    [currencyEnabled, sortEnabled],
  );

  const tableOptions = useMemo(() => {
    if (virtualMode) {
      const base = {
        data: filteredStub,
        columns: virtualColumns,
        state: { sorting, columnVisibility },
        onSortingChange: setSorting,
        onColumnVisibilityChange: setColumnVisibility,
        getRowId: (r: VirtualStub) => r.id,
        getCoreRowModel: getCoreRowModel(),
        ...(sortEnabled ? { getSortedRowModel: getSortedRowModel() } : {}),
      };
      return base;
    }

    const state: Record<string, unknown> = {};
    const handlers: Record<string, unknown> = {};
    if (sortEnabled) {
      state.sorting = sorting;
      handlers.onSortingChange = setSorting;
    }
    if (paginationEnabled) {
      state.pagination = pagination;
      handlers.onPaginationChange = setPagination;
    }
    if (groupingEnabled) {
      state.grouping = grouping;
      state.expanded = expanded;
      handlers.onGroupingChange = setGrouping;
      handlers.onExpandedChange = setExpanded;
    } else if (detailEnabled) {
      state.expanded = expanded;
      handlers.onExpandedChange = setExpanded;
    }
    if (selectionEnabled) {
      state.rowSelection = rowSelection;
      handlers.onRowSelectionChange = setRowSelection;
    }
    if (columnOrder.length > 0) {
      state.columnOrder = columnOrder;
      handlers.onColumnOrderChange = setColumnOrder;
    }
    state.columnVisibility = columnVisibility;
    handlers.onColumnVisibilityChange = setColumnVisibility;

    return {
      data: filteredClient,
      columns: clientColumns,
      state,
      ...handlers,
      getRowId: (r: EngineLabRow) => r.id,
      getCoreRowModel: getCoreRowModel(),
      ...(sortEnabled ? { getSortedRowModel: getSortedRowModel() } : {}),
      ...(paginationEnabled ? { getPaginationRowModel: getPaginationRowModel() } : {}),
      ...(groupingEnabled
        ? {
            getGroupedRowModel: getGroupedRowModel(),
            getExpandedRowModel: getExpandedRowModel(),
            groupedColumnMode: "reorder" as const,
          }
        : detailEnabled
          ? {
              getExpandedRowModel: getExpandedRowModel(),
              getRowCanExpand: (row: { original: EngineLabRow }) => Boolean(row.original.detail),
            }
          : {}),
      ...(selectionEnabled
        ? { enableRowSelection: true, enableMultiRowSelection: true }
        : {}),
    };
  }, [
    clientColumns,
    columnOrder,
    detailEnabled,
    expanded,
    filteredClient,
    filteredStub,
    grouping,
    groupingEnabled,
    pagination,
    paginationEnabled,
    rowSelection,
    selectionEnabled,
    sortEnabled,
    sorting,
    columnVisibility,
    virtualColumns,
    virtualMode,
  ]);

  const table = useReactTable(tableOptions as never);

  const pinnedLayout = usePlaygroundPinnedLayout({
    table,
    selectColumnMode: selectMode,
    dataPinnedLeftIds: pinEnabled ? (["wbs", "project"] as const) : [],
  });

  const { virtualRows, totalSize, measureElement } = useTableRowVirtualizer({
    table,
    scrollElement: scrollRoot,
    estimateSize: NEUTRAL_TABLE_ROW_HEIGHT_PX,
    overscan: 6,
  });

  const useVirtualizer = virtualMode || (!paginationEnabled && !groupingEnabled && !rowDnDEnabled);

  useEffect(() => {
    if (!virtualMode || virtualRows.length === 0) return;
    const start = virtualRows[0]!.index;
    const end = virtualRows[virtualRows.length - 1]!.index + 1;
    void managerRef.current?.ensureLoaded(start, end);
  }, [virtualMode, virtualRows]);

  const displayRows = paginationEnabled || groupingEnabled ? table.getRowModel().rows : table.getRowModel().rows;

  const dataColOffset = 1;
  const { onKeyDown: gridKeyDown } = useGridKeyboard({
    selection: rangeEnabled ? selection : null,
    onSelectionChange: rangeEnabled ? setSelection : () => {},
    rowCount: displayRows.length,
    columnCount: Math.max(0, table.getVisibleLeafColumns().length - dataColOffset),
  });

  const handleCopy = useCallback(async () => {
    if (!rangeEnabled || !selection) return;
    const b = getSelectionBounds(selection);
    const rows = displayRows;
    const cols = table.getVisibleLeafColumns().slice(dataColOffset);
    const matrix = rows.slice(b.startRow, b.endRow + 1).map((row) =>
      cols.slice(b.startCol, b.endCol + 1).map((col) => {
        const cell = row.getVisibleCells().find((c) => c.column.id === col.id);
        return cell ? String(cell.getValue() ?? "") : "";
      }),
    );
    const ok = await copyMatrixToClipboard(matrix);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }, [displayRows, rangeEnabled, selection, table]);

  const sortableColumnIds = useMemo(
    () => (rowDnDEnabled ? dataColumnOrder(table.getVisibleLeafColumns().map((c) => c.id)) : []),
    [rowDnDEnabled, table],
  );

  const onColumnReorder = useCallback((next: string[]) => {
    setColumnOrder(["select", ...next]);
  }, []);

  const tableWidth = table.getTotalSize();
  const selectedCount = Object.keys(rowSelection).length;
  const mgr = managerRef.current;

  const renderHeaderRow = () =>
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
          const sortableCol = rowDnDEnabled && sortableColumnIds.includes(h.column.id);
          if (!sortableCol) {
            return (
              <th
                key={h.id}
                className={cn(gridHeadCellClass, pin.className)}
                style={{ width: h.getSize(), ...pin.style }}
                {...(pin["data-pinned"] ? { "data-pinned": true as const } : {})}
              >
                <div className="group/col flex w-full items-center gap-1">
                  <div className="min-w-0 flex-1">
                    {sortEnabled && h.column.getCanSort() ? (
                      <SortableColumnHeader header={h} />
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </div>
                  <ColumnHeaderMenu header={h} />
                </div>
              </th>
            );
          }
          return (
            <SortableItem key={h.id} value={h.column.id} asChild asHandle {...sortableDropTargetProps(h.column.id)}>
              <th
                className={cn(gridHeadCellClass, "group/col relative", pin.className)}
                style={{ width: h.getSize(), ...pin.style }}
                {...(pin["data-pinned"] ? { "data-pinned": true as const } : {})}
              >
                <div className="group/col flex w-full items-center gap-1">
                  <div className="min-w-0 flex-1">
                    {sortEnabled && h.column.getCanSort() ? (
                      <SortableColumnHeader header={h} />
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </div>
                  <ColumnHeaderMenu header={h} />
                </div>
              </th>
            </SortableItem>
          );
        })}
      </tr>
    ));

  const isCellInRange = (rowIndex: number, colIndex: number) => {
    if (!rangeEnabled || !selection) return false;
    const b = getSelectionBounds(selection);
    return (
      rowIndex >= b.startRow &&
      rowIndex <= b.endRow &&
      colIndex >= b.startCol + dataColOffset &&
      colIndex <= b.endCol + dataColOffset
    );
  };

  const renderBodyRow = (row: (typeof displayRows)[number], rowIndex: number, style?: CSSProperties) => {
    const rowEl = (
      <tr
        key={row.id}
        data-index={rowIndex}
        ref={useVirtualizer ? measureElement : undefined}
        data-state={row.getIsSelected?.() ? "selected" : undefined}
        className={cn(gridRowClass, "group/row", neutralTanStackRowFillClass(tokens, rowIndex))}
        style={style}
        title={selectionEnabled ? "Drag row to reorder · click # to select" : undefined}
      >
        {row.getVisibleCells().map((cell, colIndex) => {
          const isGutter = cell.column.id === ROW_INDEX_GUTTER_ID;
          const mode = isGutter ? getSelectColumnMode(cell.column) : undefined;
          const pin = pinPlaygroundCell({
            pinnedLayout,
            columnId: cell.column.id,
            variant: "body",
            scrolledX,
            rowIndexGutter: isGutter,
            rowFillTokens: isGutter ? undefined : tokens,
            rowIndex: isGutter ? undefined : rowIndex,
          });
          const selected = isCellInRange(rowIndex, colIndex);
          return (
            <td
              key={cell.id}
              {...(isGutter ? selectColumnRowHeaderProps(mode) : {})}
              {...(pin["data-pinned"] ? { "data-pinned": true as const } : {})}
              data-state={selected ? "selected" : undefined}
              className={cn(
                isGutter
                  ? selectColumnTdClass(mode, gridCellClass, { pinned: !!pin.style })
                  : gridCellClass,
                selected && bundle.cellRangeFill,
                pin.className,
              )}
              style={{
                ...(useVirtualizer ? { flex: `0 0 ${cell.column.getSize()}px`, width: cell.column.getSize() } : {}),
                ...(groupingEnabled && row.getIsGrouped?.() && colIndex === 1
                  ? getOutlineRowIndentStyle(row.depth)
                  : {}),
                ...pin.style,
              }}
            >
              {groupingEnabled && row.getIsGrouped?.() && cell.column.id === "costCenter" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={row.getToggleExpandedHandler()}
                >
                  {row.getIsExpanded() ? "▼" : "▶"}{" "}
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Button>
              ) : groupingEnabled && row.getIsGrouped?.() ? (
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
    );

    const detail =
      detailEnabled && row.getIsExpanded?.() && "original" in row && (row.original as EngineLabRow).detail ? (
        <tr key={`${row.id}-detail`} className="hover:bg-transparent">
          <td
            colSpan={table.getVisibleLeafColumns().length}
            className={cn(gridCellClass, "bg-muted/30 text-sm text-muted-foreground")}
          >
            {(row.original as EngineLabRow).detail}
          </td>
        </tr>
      ) : null;

    if (!rowDnDEnabled) {
      return (
        <Fragment key={row.id}>
          {rowEl}
          {detail}
        </Fragment>
      );
    }

    return (
      <Fragment key={row.id}>
        <SortableItem value={(row.original as EngineLabRow).id} asChild asHandle {...sortableDropTargetProps((row.original as EngineLabRow).id)}>
          {rowEl}
        </SortableItem>
        {detail}
      </Fragment>
    );
  };

  const tbodyInner = useVirtualizer ? (
    <tbody
      className={gridBodyHoverClass}
      style={{ height: totalSize, position: "relative", display: "block", width: tableWidth }}
    >
      {virtualRows.map((vr) => {
        const row = displayRows[vr.index]!;
        return renderBodyRow(row, vr.index, getVirtualTableRowStyle(vr.start, tableWidth));
      })}
    </tbody>
  ) : (
    <tbody className={gridBodyHoverClass}>
      {displayRows.map((row, rowIndex) => renderBodyRow(row, rowIndex))}
    </tbody>
  );

  const tableEl = (
    <table className={gridTableClass} style={{ width: tableWidth }}>
      <colgroup>
        {table.getVisibleLeafColumns().map((col) => (
          <col key={col.id} style={{ width: col.getSize() }} />
        ))}
      </colgroup>
      {rowDnDEnabled ? (
        <Sortable
          value={sortableColumnIds}
          onValueChange={onColumnReorder}
          orientation="horizontal"
          flatCursor
          {...sortableDrop.columnSortableProps}
        >
          <SortableContent withoutSlot>
            <thead className={gridHeaderClass}>{renderHeaderRow()}</thead>
          </SortableContent>
          <SortableOverlay>
            {({ value }) => <SortableDragOverlay axis="column" label={String(value)} />}
          </SortableOverlay>
        </Sortable>
      ) : (
        <thead className={gridHeaderClass}>{renderHeaderRow()}</thead>
      )}
      {rowDnDEnabled ? (
        <Sortable
          value={clientData}
          onValueChange={setClientData}
          getItemValue={(r) => r.id}
          orientation="vertical"
          flatCursor
          {...sortableDrop.rowSortableProps}
        >
          <SortableContent withoutSlot>{tbodyInner}</SortableContent>
          <SortableOverlay>
            {({ value }) => {
              const r = clientData.find((x) => x.id === value);
              return <SortableDragOverlay axis="row" label={r ? `${r.wbs} · ${r.project}` : String(value)} />;
            }}
          </SortableOverlay>
        </Sortable>
      ) : (
        tbodyInner
      )}
    </table>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        role="toolbar"
        aria-label="Spreadsheet toolbar"
        className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2"
      >
        <div className="flex items-center gap-2 pr-1">
          <span className="text-xs font-semibold text-foreground">Commitments</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Sheet
          </span>
        </div>
        <span className="h-5 w-px bg-border" aria-hidden />
        <SpreadsheetColumnsMenu
          table={table}
          excludeIds={["select", ROW_INDEX_GUTTER_ID, "rowActions", "expand"]}
        />
        {sortEnabled && (table.getState().sorting?.length ?? 0) > 0 ? (
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setSorting([])}>
            Clear sort
          </Button>
        ) : null}
        {filterEnabled ? (
          <Input
            type="search"
            placeholder="Search WBS, program, GL, manager…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 max-w-sm text-xs"
            aria-label="Filter commitments"
          />
        ) : null}
        {rangeEnabled ? (
          <>
            <span className="rounded-md border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
              Range: <span className="font-medium text-foreground">{selectionSummary(selection)}</span>
            </span>
            <Button size="sm" variant="outline" onClick={() => void handleCopy()}>
              {copied ? "Copied" : "Copy selection"}
            </Button>
          </>
        ) : null}
        {virtualMode ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Latency</span>
            {[0, 100, 200, 500].map((ms) => (
              <button
                key={ms}
                type="button"
                onClick={() => setLatency(ms)}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                  latency === ms
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {ms === 0 ? "instant" : `${ms}ms`}
              </button>
            ))}
          </div>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground tabular-nums">
          {selectionEnabled && selectedCount > 0 ? (
            <span>{selectedCount} selected</span>
          ) : null}
          <span>
            {virtualMode
              ? `${VIRTUAL_ROW_COUNT.toLocaleString()} virtual rows`
              : `${filteredClient.length.toLocaleString()} commitment lines`}
          </span>
          {virtualMode && mgr ? (
            <span>
              {mgr.getStats()?.loadedPages}/{mgr.getStats()?.totalPages} pages cached
            </span>
          ) : null}
          {paginationEnabled ? (
            <span>
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
          ) : null}
        </div>
      </div>

      <EngineScrollTableShell
        viewportRef={viewportRef}
        className="max-h-[min(58dvh,520px)]"
        footer={
          paginationEnabled ? (
            <div className="flex w-full items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {table.getRowModel().rows.length} rows on this page
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        <div
          ref={sortableDrop.containerRef}
          className={sortableDrop.containerClassName}
          tabIndex={rangeEnabled ? 0 : undefined}
          onKeyDown={rangeEnabled ? gridKeyDown : undefined}
        >
          {tableEl}
          {sortableDrop.indicators}
        </div>
      </EngineScrollTableShell>
    </div>
  );
}
