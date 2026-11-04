import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button, cn } from "@nqlib/nqui";
import {
  neutralTanStackRowFillClass,
  playgroundTanStackRowStripeData,
  useNeutralPlaygroundTable,
} from "../lib/playground-neutral-table";
import { EngineScrollTableShell } from "../parity/engine-scroll-table-shell";
import {
  clampPageIndex,
  colSpanCrossesFrozenBoundary,
  getPageCount,
  getTableWrapperAria,
  moveRowBefore,
  slicePage,
  tsvToMatrix,
} from "@nqlib/nqgrid";
import {
  gridBodyHoverClass,
  gridCellClass,
  gridHeadCellClass,
  gridHeaderClass,
  gridRowClass,
  gridTableClass,
} from "../lib/grid-styles";

const ROWS = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Bravo" },
  { id: "c", label: "Charlie" },
  { id: "d", label: "Delta" },
];

type LabelRow = { id: string; label: string };
type PasteRow = { id: string; cells: string[] };

const labelHelper = createColumnHelper<LabelRow>();
const pasteHelper = createColumnHelper<PasteRow>();

export function EngineUtilitiesDemo() {
  const { tokens } = useNeutralPlaygroundTable();
  const [pageIndex, setPageIndex] = useState(0);
  const [order, setOrder] = useState(ROWS);
  const [paste, setPaste] = useState("");

  const pageSize = 2;
  const pageCount = getPageCount(order.length, pageSize);
  const page = slicePage(order, clampPageIndex(pageIndex, pageCount), pageSize);
  const a11y = getTableWrapperAria("grid", { ariaLabel: "Engine utilities sample", ariaRowCount: order.length });

  const pageColumns = useMemo(
    () => [labelHelper.accessor("label", { header: "Label", size: 200 })],
    [],
  );

  const pageTable = useReactTable({
    data: page,
    columns: pageColumns,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
  });

  const pasteRows = useMemo(
    () =>
      paste.trim()
        ? tsvToMatrix(paste).map((cells, i) => ({ id: String(i), cells }))
        : [],
    [paste],
  );

  const pasteColumns = useMemo(() => {
    const maxCols = pasteRows.reduce((max, row) => Math.max(max, row.cells.length), 0);
    return Array.from({ length: maxCols }, (_, colIndex) =>
      pasteHelper.display({
        id: `c${colIndex}`,
        header: `Col ${colIndex + 1}`,
        size: 96,
        cell: ({ row }) => row.original.cells[colIndex] ?? "",
      }),
    );
  }, [pasteRows]);

  const pasteTable = useReactTable({
    data: pasteRows,
    columns: pasteColumns,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Engine helpers with TanStack rendering for paging and paste preview — plus reorder, colspan+frozen, a11y.
      </p>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Paging</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPageIndex((p) => clampPageIndex(p - 1, pageCount))}>
            Prev
          </Button>
          <span className="text-sm">
            Page {pageIndex + 1} / {pageCount}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPageIndex((p) => clampPageIndex(p + 1, pageCount))}>
            Next
          </Button>
        </div>
        <EngineScrollTableShell className="max-h-[240px]">
          <table className={gridTableClass} style={{ width: pageTable.getTotalSize() }}>
            <colgroup>
              {pageTable.getVisibleLeafColumns().map((col) => (
                <col key={col.id} style={{ width: col.getSize() }} />
              ))}
            </colgroup>
            <thead className={gridHeaderClass}>
              {pageTable.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id} className={gridHeadCellClass}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className={gridBodyHoverClass}>
              {pageTable.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(gridRowClass, neutralTanStackRowFillClass(tokens, row.index))}
                  {...playgroundTanStackRowStripeData(tokens, row.index)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={gridCellClass}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </EngineScrollTableShell>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">moveRowBefore</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setOrder((rows) => moveRowBefore(rows, "d", "b"))}>
            Move Delta before Bravo
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOrder([...ROWS])}>
            Reset
          </Button>
        </div>
        <p className="text-sm">{order.map((r) => r.label).join(" → ")}</p>
      </section>

      <section className="text-sm">
        <h3 className="font-medium">colSpanCrossesFrozenBoundary</h3>
        <p className="text-muted-foreground">
          colspan 3 at col 0, 1 frozen:{" "}
          {colSpanCrossesFrozenBoundary(true, 0, 3, 1) ? "blocked" : "ok"}
        </p>
      </section>

      <section className="text-sm">
        <h3 className="font-medium">getTableWrapperAria</h3>
        <pre className="rounded-md bg-muted p-2 text-xs">{JSON.stringify(a11y, null, 2)}</pre>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">tsvToMatrix</h3>
        <textarea
          className="min-h-[4rem] rounded-md border bg-background p-2 font-mono text-xs"
          placeholder="Paste TSV…"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        {pasteRows.length > 0 ? (
          <EngineScrollTableShell className="max-h-[200px]">
          <table className={gridTableClass} style={{ width: pasteTable.getTotalSize() }} {...a11y}>
            <colgroup>
              {pasteTable.getVisibleLeafColumns().map((col) => (
                <col key={col.id} style={{ width: col.getSize() }} />
              ))}
            </colgroup>
            <thead className={gridHeaderClass}>
              {pasteTable.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id} className={gridHeadCellClass}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className={gridBodyHoverClass}>
              {pasteTable.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(gridRowClass, neutralTanStackRowFillClass(tokens, row.index))}
                  {...playgroundTanStackRowStripeData(tokens, row.index)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={gridCellClass}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </EngineScrollTableShell>
        ) : null}
      </section>
    </div>
  );
}
