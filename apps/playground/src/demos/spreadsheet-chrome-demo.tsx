import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button, cn } from "@nqlib/nqui";
import { matrixToTsv, useCellFormats, useSpreadsheetCommands } from "@nqlib/nqgrid";
import {
  gridBodyHoverClass,
  gridCellClass,
  gridHeadCellClass,
  gridHeaderClass,
  gridRowClass,
  gridTableClass,
} from "../lib/grid-styles";
import {
  neutralTanStackRowFillClass,
  playgroundTanStackRowStripeData,
  useNeutralPlaygroundTable,
} from "../lib/playground-neutral-table";
import { EngineScrollTableShell } from "../parity/engine-scroll-table-shell";

const SAMPLE_MATRIX = [
  ["a", "b"],
  ["1", "2"],
] as const;

type MatrixRow = { id: string; a: string; b: string };

const columnHelper = createColumnHelper<MatrixRow>();

export function SpreadsheetChromeDemo() {
  const { tokens } = useNeutralPlaygroundTable();
  const [log, setLog] = useState<string[]>([]);
  const push = (m: string) => setLog((l) => [m, ...l].slice(0, 6));

  const data = useMemo(
    () =>
      SAMPLE_MATRIX.map((row, i) => ({
        id: String(i),
        a: row[0]!,
        b: row[1]!,
      })),
    [],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("a", { header: "A", size: 80 }),
      columnHelper.accessor("b", { header: "B", size: 80 }),
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
  });

  const commands = useSpreadsheetCommands({
    onExportCsv: () => push("export csv"),
    onExportPdf: () => push("export pdf"),
    onCopy: () => push(`copy: ${matrixToTsv([...SAMPLE_MATRIX])}`),
    onPaste: () => push("paste"),
  });

  const formats = useCellFormats();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Headless <code className="rounded bg-muted px-1">useSpreadsheetCommands</code> +{" "}
        <code className="rounded bg-muted px-1">useCellFormats</code> — sample matrix rendered with TanStack Table.
      </p>
      <div className="flex flex-wrap gap-2">
        {commands.map((c) => (
          <Button key={c.id} type="button" size="sm" variant="secondary" disabled={c.disabled} onClick={() => c.onExecute?.()}>
            {c.label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={formats.handleBold}>
          Toggle bold format
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Active format: {JSON.stringify(formats.activeFormat ?? {})}</p>
      <EngineScrollTableShell className="max-w-xs">
        <table className={gridTableClass} style={{ width: table.getTotalSize() }}>
          <thead className={gridHeaderClass}>
            {table.getHeaderGroups().map((hg) => (
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
            {table.getRowModel().rows.map((row) => (
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
      <ul className="text-xs text-muted-foreground">
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
