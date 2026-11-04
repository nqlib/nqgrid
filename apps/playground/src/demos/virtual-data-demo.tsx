import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { Button, cn, Input } from "@nqlib/nqui";
import {
  VirtualDataManager,
  useTableRowVirtualizer,
  getVirtualTableRowStyle,
  withCoreSorting,
  type VirtualDataSource,
} from "@nqlib/nqgrid";
import {
  NEUTRAL_TABLE_ROW_HEIGHT_PX,
  neutralTanStackRowFillClass,
  useNeutralPlaygroundTable,
} from "../lib/playground-neutral-table";
import { createSelectColumn, getSelectColumnMode, selectColumnRowHeaderProps, selectColumnTdClass } from "../lib/playground-canonical-select-column";
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
  gridRowClass,
  gridTableClass,
} from "../lib/grid-styles";
import { EngineScrollTableShell, useEngineScrollViewport } from "../parity/engine-scroll-table-shell";

const ROW_COUNT = 10_000;
const COL_HEADERS = [
  "ID",
  "Name",
  "Department",
  "Status",
  "Score",
  "Region",
  "Role",
  "Manager",
  "Hire date",
  "Tier",
  "Email",
  "Tickets",
] as const;

const COL_WIDTHS = [64, 140, 120, 80, 56, 72, 96, 120, 96, 64, 180, 72] as const;
const COLUMN_COUNT = COL_HEADERS.length;

const DEPARTMENTS = ["Engineering", "Design", "Product", "Sales", "Support"];
const STATUSES = ["Active", "Idle", "Away", "Offline"];
const REGIONS = ["NA", "EU", "APAC", "LATAM"];
const ROLES = ["IC", "Lead", "Manager", "Director"];
const TIERS = ["Bronze", "Silver", "Gold", "Platinum"];

type VirtualRow = { id: string; index: number };

function makeSource(delayMs: number): VirtualDataSource {
  return {
    rowCount: ROW_COUNT,
    columnCount: COLUMN_COUNT,
    pageSize: 200,
    prefetch: true,
    async fetchRows(offset, limit) {
      await new Promise((r) => setTimeout(r, delayMs));
      return Array.from({ length: limit }, (_, i) => {
        const row = offset + i;
        const id = row + 1;
        return [
          String(id).padStart(5, "0"),
          `User ${id}`,
          DEPARTMENTS[row % DEPARTMENTS.length]!,
          STATUSES[row % STATUSES.length]!,
          String(((row * 37 + 13) % 100) + 1),
          REGIONS[row % REGIONS.length]!,
          ROLES[row % ROLES.length]!,
          `Mgr ${(row % 40) + 1}`,
          `2024-${String((row % 12) + 1).padStart(2, "0")}-15`,
          TIERS[row % TIERS.length]!,
          `user${id}@example.com`,
          String((row * 3) % 120),
        ];
      });
    },
  };
}

const columnHelper = createColumnHelper<VirtualRow>();
const VISIBLE_ROWS = 20;

const SELECT_MODE = "index" as const;

export type VirtualDataDemoOptions = {
  sort?: boolean;
  pinDataColumnIds?: readonly string[];
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
};

export function VirtualDataDemo({ options }: { options?: VirtualDataDemoOptions } = {}) {
  const sortEnabled = options?.sort ?? false;
  const pinDataColumnIds = options?.pinDataColumnIds ?? [];
  const globalFilter = options?.globalFilter ?? "";
  const filterEnabled = options?.onGlobalFilterChange != null;

  const [latency, setLatency] = useState(300);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [loadCount, setLoadCount] = useState(0);
  const [, bump] = useState(0);
  const managerRef = useRef<VirtualDataManager | null>(null);
  const { viewportRef, scrollRoot, scrolledX } = useEngineScrollViewport(true);
  const { tokens } = useNeutralPlaygroundTable();

  useEffect(() => {
    const mgr = new VirtualDataManager(makeSource(latency), { cacheSize: 20 });
    managerRef.current = mgr;

    const unsub = mgr.subscribe(() => {
      setLoadCount((n) => n + 1);
      bump((n) => n + 1);
    });

    void mgr.ensureLoaded(0, VISIBLE_ROWS);

    return () => {
      unsub();
      managerRef.current = null;
    };
  }, [latency]);

  const stubData = useMemo(
    () => Array.from({ length: ROW_COUNT }, (_, index) => ({ id: String(index), index })),
    [],
  );

  const filteredStubData = useMemo(() => {
    if (!filterEnabled || !globalFilter.trim()) return stubData;
    const q = globalFilter.trim().toLowerCase();
    return stubData.filter((row) => String(row.index + 1).includes(q) || row.id.includes(q));
  }, [stubData, filterEnabled, globalFilter]);

  const columns = useMemo(
    () => [
      createSelectColumn(columnHelper, { mode: SELECT_MODE }),
      ...COL_HEADERS.map((header, colIndex) =>
        columnHelper.display({
          id: `col-${colIndex}`,
          header,
          size: COL_WIDTHS[colIndex],
          enableSorting: sortEnabled && colIndex === 0,
          sortingFn:
            colIndex === 0
              ? (a, b) => a.original.index - b.original.index
              : undefined,
          cell: ({ row }) => {
            const mgr = managerRef.current;
            const value = mgr?.getCell(row.original.index, colIndex);
            if (value != null) return value;
            return (
              <div className="h-2.5 w-24 max-w-full animate-pulse rounded bg-muted" aria-hidden />
            );
          },
        }),
      ),
    ],
    [sortEnabled],
  );

  const table = useReactTable(
    sortEnabled
      ? withCoreSorting({
          data: filteredStubData,
          columns,
          state: { sorting },
          onSortingChange: setSorting,
          getRowId: (row) => row.id,
        })
      : {
          data: filteredStubData,
          columns,
          getRowId: (row) => row.id,
          getCoreRowModel: getCoreRowModel(),
        },
  );

  const tableTotalWidth = table.getTotalSize();

  const pinnedLayout = usePlaygroundPinnedLayout({
    table,
    selectColumnMode: SELECT_MODE,
    dataPinnedLeftIds: pinDataColumnIds,
  });

  const { virtualRows, totalSize, measureElement } = useTableRowVirtualizer({
    table,
    scrollElement: scrollRoot,
    estimateSize: NEUTRAL_TABLE_ROW_HEIGHT_PX,
    overscan: 6,
  });

  const rows = table.getRowModel().rows;

  useEffect(() => {
    if (virtualRows.length === 0) return;
    const start = virtualRows[0]!.index;
    const end = virtualRows[virtualRows.length - 1]!.index + 1;
    void managerRef.current?.ensureLoaded(start, end);
  }, [virtualRows]);

  const resetCache = useCallback(() => {
    managerRef.current?.clearCache();
    if (scrollRoot) scrollRoot.scrollTop = 0;
    void managerRef.current?.ensureLoaded(0, VISIBLE_ROWS);
    bump((n) => n + 1);
  }, [scrollRoot]);

  const mgr = managerRef.current;
  const startRow = virtualRows[0]?.index ?? 0;
  const endRow = (virtualRows[virtualRows.length - 1]?.index ?? 0) + 1;
  const stats = mgr?.getStats();
  const isLoadingVisible = mgr?.isLoadingRange(startRow, endRow) ?? true;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {filterEnabled ? (
          <Input
            type="search"
            placeholder="Filter by row #…"
            value={globalFilter}
            onChange={(e) => options?.onGlobalFilterChange?.(e.target.value)}
            className="h-8 max-w-xs text-xs"
            aria-label="Filter rows"
          />
        ) : null}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Simulated latency</span>
          {[0, 100, 300, 800].map((ms) => (
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
        <Button size="sm" variant="outline" onClick={resetCache}>
          Clear cache
        </Button>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
          {isLoadingVisible && (
            <span className="flex items-center gap-1">
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" />
              Loading…
            </span>
          )}
          {stats && (
            <>
              <span>
                {stats.loadedPages}/{stats.totalPages} pages cached
              </span>
              <span>{loadCount} fetches</span>
            </>
          )}
        </div>
      </div>

      <EngineScrollTableShell viewportRef={viewportRef} className="max-h-[min(50dvh,420px)]">
        <table className={gridTableClass} style={{ width: tableTotalWidth }}>
          <colgroup>
            {table.getVisibleLeafColumns().map((col) => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>
          <thead className={gridHeaderClass}>
            {table.getHeaderGroups().map((hg) => (
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
                  return (
                    <th
                      key={h.id}
                      className={cn(gridHeadCellClass, pin.className)}
                      style={{ width: h.getSize(), ...pin.style }}
                      {...(pin["data-pinned"] ? { "data-pinned": true as const } : {})}
                    >
                      {sortEnabled && h.column.getCanSort() ? (
                        <SortableColumnHeader header={h} />
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
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
                  // Tag tinted (odd-index) rows when striped so pinned cells
                  // can pick up the matching zebra via the [data-stripe] CSS.
                  data-stripe={
                    tokens.body.fillMode === "striped" && row.original.index % 2 === 1
                      ? "even"
                      : undefined
                  }
                  className={cn(gridRowClass, neutralTanStackRowFillClass(tokens, row.original.index))}
                  style={getVirtualTableRowStyle(vr.start, tableTotalWidth)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isGutter = cell.column.id === ROW_INDEX_GUTTER_ID;
                    const mode = isGutter ? getSelectColumnMode(cell.column) : undefined;
                    const pin = pinPlaygroundCell({
                      pinnedLayout,
                      columnId: cell.column.id,
                      variant: "body",
                      scrolledX,
                      rowIndexGutter: isGutter,
                      rowFillTokens: tokens,
                      rowIndex: row.original.index,
                    });
                    return (
                      <td
                        key={cell.id}
                        {...(isGutter ? selectColumnRowHeaderProps(mode) : {})}
                        {...(pin.style ? { "data-pinned": true as const } : {})}
                        className={cn(
                          isGutter
                            ? selectColumnTdClass(mode, gridCellClass, { pinned: !!pin.style })
                            : gridCellClass,
                          pin.className,
                        )}
                        style={{
                          flex: `0 0 ${cell.column.getSize()}px`,
                          width: cell.column.getSize(),
                          ...pin.style,
                        }}
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
