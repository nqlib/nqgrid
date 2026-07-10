import { useCallback, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button, cn } from "@nqlib/nqui";
import { copyMatrixToClipboard, useGridKeyboard } from "@nqlib/nqgrid";
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
import type { SelectionRange } from "@nqlib/nqgrid";
import { isCellSelection, isRowSelection, isColumnSelection, getSelectionBounds } from "@nqlib/nqgrid";

type GridRow = {
  id: string;
  name: string;
  role: string;
  team: string;
  status: string;
  score: string;
};

const columnHelper = createColumnHelper<GridRow>();

function selectionLabel(sel: SelectionRange | null): string {
  if (!sel) return "None";
  if (isCellSelection(sel)) {
    const b = getSelectionBounds(sel);
    const rows = b.endRow - b.startRow + 1;
    const cols = b.endCol - b.startCol + 1;
    if (rows === 1 && cols === 1) return `Cell (${b.startRow + 1}, ${b.startCol + 1})`;
    return `Cell range ${rows}r × ${cols}c`;
  }
  if (isRowSelection(sel)) {
    const b = getSelectionBounds(sel);
    return `Rows ${b.startRow + 1}–${b.endRow + 1}`;
  }
  if (isColumnSelection(sel)) {
    const b = getSelectionBounds(sel);
    return `Cols ${b.startCol + 1}–${b.endCol + 1}`;
  }
  return "None";
}

function isCellSelected(row: number, col: number, sel: SelectionRange | null): boolean {
  if (!sel) return false;
  const b = getSelectionBounds(sel);
  return row >= b.startRow && row <= b.endRow && col >= b.startCol && col <= b.endCol;
}

export function GridKeyboardDemo() {
  const { tokens, bundle } = useNeutralPlaygroundTable();
  const [selection, setSelection] = useState<SelectionRange | null>({
    type: "cell",
    start: { row: 0, col: 0 },
    end: { row: 0, col: 0 },
  });
  const [copied, setCopied] = useState(false);

  const data = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: String(i + 1),
        name: `User ${i + 1}`,
        role: ["Engineer", "Designer", "PM", "Lead"][i % 4]!,
        team: ["Alpha", "Beta", "Gamma", "Delta"][Math.floor(i / 4) % 4]!,
        status: ["Active", "Idle", "Away"][i % 3]!,
        score: String(((i * 37 + 11) % 99) + 1),
      })),
    [],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", { header: "#", size: 48 }),
      columnHelper.accessor("name", { header: "Name", size: 120 }),
      columnHelper.accessor("role", { header: "Role", size: 96 }),
      columnHelper.accessor("team", { header: "Team", size: 88 }),
      columnHelper.accessor("status", { header: "Status", size: 80 }),
      columnHelper.accessor("score", { header: "Score", size: 64 }),
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
  });

  const columnCount = table.getVisibleLeafColumns().length;
  const rowCount = table.getRowModel().rows.length;

  const { onKeyDown } = useGridKeyboard({
    selection,
    onSelectionChange: setSelection,
    rowCount,
    columnCount,
  });

  const handleCopy = useCallback(async () => {
    if (!selection) return;
    const b = getSelectionBounds(selection);
    const rows = table.getRowModel().rows;
    const cols = table.getVisibleLeafColumns();
    const matrix = rows.slice(b.startRow, b.endRow + 1).map((row) =>
      cols.slice(b.startCol, b.endCol + 1).map((col) => {
        const cell = row.getVisibleCells().find((c) => c.column.id === col.id);
        return cell ? String(cell.getValue() ?? "") : "";
      }),
    );
    const ok = await copyMatrixToClipboard(matrix);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [selection, table]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        <code className="rounded bg-muted px-1">useGridKeyboard</code> on a TanStack row model with{" "}
        <code className="rounded bg-muted px-1">SelectionRange</code> and{" "}
        <code className="rounded bg-muted px-1">copyMatrixToClipboard</code>.
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">Selection:</span>
          <span className="font-mono font-medium">{selectionLabel(selection)}</span>
          {selection && (
            <span className="text-muted-foreground">
              type=<span className="text-foreground">{selection.type}</span>
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" disabled={!selection} onClick={handleCopy}>
          {copied ? "Copied!" : "Copy selection"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSelection(null)}>
          Clear
        </Button>
      </div>

      <EngineScrollTableShell className="max-h-[min(50dvh,400px)]">
        <div
          role="grid"
          tabIndex={0}
          onKeyDown={onKeyDown}
          aria-label="Grid keyboard demo"
          className="outline-none"
        >
          <table className={gridTableClass} style={{ width: table.getTotalSize() }}>
            <colgroup>
              {table.getVisibleLeafColumns().map((col) => (
                <col key={col.id} style={{ width: col.getSize() }} />
              ))}
            </colgroup>
            <thead className={gridHeaderClass}>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header, colIndex) => (
                    <th
                      key={header.id}
                      className={cn(
                        gridHeadCellClass,
                        selection !== null &&
                          isCellSelected(0, colIndex, selection) &&
                          bundle.cellRangeFill,
                      )}
                      onClick={() =>
                        setSelection({
                          type: "cell",
                          start: { row: 0, col: colIndex },
                          end: { row: 0, col: colIndex },
                        })
                      }
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className={gridBodyHoverClass}>
              {table.getRowModel().rows.map((row, rowIndex) => (
                <tr
                  key={row.id}
                  className={cn(
                    gridRowClass,
                    neutralTanStackRowFillClass(tokens, rowIndex),
                  )}
                  {...playgroundTanStackRowStripeData(tokens, rowIndex)}
                >
                  {row.getVisibleCells().map((cell, colIndex) => {
                    const selected = isCellSelected(rowIndex, colIndex, selection);
                    return (
                      <td
                        key={cell.id}
                        className={cn(gridCellClass, selected && bundle.cellRangeActive)}
                        onClick={() =>
                          setSelection({
                            type: "cell",
                            start: { row: rowIndex, col: colIndex },
                            end: { row: rowIndex, col: colIndex },
                          })
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EngineScrollTableShell>

      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 rounded-lg border bg-muted/20 px-4 py-3 text-xs sm:grid-cols-3">
        {[
          ["↑ ↓ ← →", "Move focus"],
          ["Ctrl + ↑↓←→", "Jump to edge"],
          ["Shift + arrows", "Extend selection"],
          ["Page Up / Down", "Jump 10 rows"],
          ["Home / End", "Row start / end"],
          ["Ctrl + Home/End", "Document start / end"],
          ["Tab / Shift+Tab", "Next / prev cell (wraps)"],
          ["Enter / Shift+Enter", "Down / up one row"],
          ["Ctrl+A", "Select all"],
          ["Escape", "Clear selection"],
          ["Click cell", "Select single cell"],
        ].map(([key, desc]) => (
          <div key={key} className="flex items-baseline gap-2 py-0.5">
            <kbd className="shrink-0 font-mono text-[10px] text-muted-foreground">{key}</kbd>
            <span className="text-muted-foreground">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
