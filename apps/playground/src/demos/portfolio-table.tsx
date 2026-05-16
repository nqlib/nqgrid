import { useEffect, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Button, ScrollArea, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@nqlib/nqui";
import {
  type PortfolioRow,
  tableCellClass,
  tableDenseTypography,
  tableFooterClass,
  tableHeaderClass,
  tableHeadClass,
  tableNumericClass,
  tableNumericMutedClass,
  tableNumericStrongClass,
  tableRowClass,
  tableScrollAreaContentClass,
  tableScrollAreaRootClass,
  tableScrollViewportStyle,
  tableShellClass,
} from "@nqlib/nqgrid";
import { usePlaygroundTableBodyClass } from "../playground-table-settings";

const PAGE_SIZE = 10;

const columnHelper = createColumnHelper<PortfolioRow>();

const fmt2 = (n: number) => n.toFixed(2);

export function PortfolioTable({ data }: { data: PortfolioRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "weightPct", desc: true }]);
  const [page, setPage] = useState(0);
  const tableBodyClassName = usePlaygroundTableBodyClass();

  const columns = useMemo(
    () => [
      columnHelper.accessor("ticker", {
        header: "Ticker",
        cell: (info) => (
          <span className={tableNumericStrongClass}>{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("name", {
        header: "Name",
        cell: (info) => (
          <span className="max-w-[10rem] truncate font-medium leading-normal text-foreground sm:max-w-none">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("sector", {
        header: "Sector",
        cell: (info) => <span className="leading-normal text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor("shares", {
        header: () => <span className="w-full text-right">Shares</span>,
        cell: (info) => (
          <div className={cn("text-right", tableNumericStrongClass)}>{info.getValue()}</div>
        ),
      }),
      columnHelper.accessor("avgCost", {
        header: () => <span className="w-full text-right">Avg</span>,
        cell: (info) => (
          <div className={cn("text-right", tableNumericMutedClass)}>${fmt2(info.getValue())}</div>
        ),
      }),
      columnHelper.accessor("last", {
        header: () => <span className="w-full text-right">Last</span>,
        cell: (info) => (
          <div className={cn("text-right", tableNumericStrongClass)}>${fmt2(info.getValue())}</div>
        ),
      }),
      columnHelper.accessor("dayPnLPct", {
        header: () => <span className="w-full text-right">Day</span>,
        cell: (info) => {
          const v = info.getValue();
          const pos = v >= 0;
          return (
            <div
              className={cn(
                "text-right",
                pos ? "text-foreground" : "text-destructive",
                tableNumericClass,
              )}
            >
              {pos ? "+" : ""}
              {v.toFixed(2)}%
            </div>
          );
        },
      }),
      columnHelper.accessor("weightPct", {
        header: () => <span className="w-full text-right">Weight</span>,
        cell: (info) => (
          <div className={cn("text-right", tableNumericMutedClass)}>
            {fmt2(info.getValue())}%
          </div>
        ),
      }),
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack useReactTable
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const maxPage = pageCount - 1;

  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  useEffect(() => {
    setPage(0);
  }, [data, sorting]);

  useEffect(() => {
    setPage((p) => Math.min(p, maxPage));
  }, [maxPage]);

  const rangeStart = rows.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = rows.length === 0 ? 0 : Math.min((page + 1) * PAGE_SIZE, rows.length);
  const canGoPrevious = page > 0;
  const canGoNext = page < maxPage;

  return (
    <div className={tableShellClass}>
      <ScrollArea
        orientation="both"
        fadeMask={false}
        className={tableScrollAreaRootClass}
        viewportStyle={tableScrollViewportStyle}
      >
        <div className={tableScrollAreaContentClass}>
        <table className={tableDenseTypography}>
          <TableHeader className={tableHeaderClass}>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className={tableRowClass}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      tableHeadClass,
                      ["shares", "avgCost", "last", "dayPnLPct", "weightPct"].includes(header.column.id) && "text-right",
                    )}
                  >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <button
                      type="button"
                      className="inline-flex cursor-pointer select-none items-center gap-0.5 text-inherit hover:text-foreground"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: " ↑",
                        desc: " ↓",
                      }[header.column.getIsSorted() as string] ?? null}
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={tableBodyClassName}>
            {pageRows.map((row) => (
              <TableRow key={row.id} className={tableRowClass}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={tableCellClass}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </table>
        </div>
      </ScrollArea>

      <div className={tableFooterClass}>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm leading-normal text-muted-foreground">
            Rows <span className="font-medium text-foreground">{rangeStart}</span>–
            <span className="font-medium text-foreground">{rangeEnd}</span> of{" "}
            <span className="font-medium text-foreground">{rows.length}</span> · Page{" "}
            <span className="font-medium text-foreground">{page + 1}</span> of{" "}
            <span className="font-medium text-foreground">{pageCount}</span>
          </p>
          <p className="text-sm leading-normal text-muted-foreground">Use Back / Next to change page.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGoPrevious}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Show previous rows"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" aria-hidden />
            Back
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGoNext}
            onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
            aria-label="Show more rows"
          >
            Next
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
