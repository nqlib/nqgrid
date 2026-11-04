import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  type ColumnOrderState,
  type ColumnSizingState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { cn } from "@nqlib/nqui";
import { Sortable, SortableContent, SortableItem, SortableOverlay } from "@nqlib/nqui/sortable";
import {
  EMPTY_ROW_SELECTION,
  moveRowDown,
  moveRowUp,
  useRowKeyboardReorder,
  withCoreSortingRowSelection,
} from "@nqlib/nqgrid";
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
import type { WideSelectionRow } from "../parity/parity-wide-mock-data";
import { createSelectColumn, dataColumnOrder } from "../lib/playground-canonical-select-column";
import { CanonicalHeaderCell, CanonicalSelectHeaderCell } from "../lib/playground-canonical-header-cell";
import {
  sortableDropTargetProps,
  usePlaygroundSortableTableDropIndicators,
} from "../lib/playground-sortable-drop-indicator";
import { SortableDragOverlay, sortableColumnOverlayLabel } from "../lib/playground-sortable-drag-chrome";

type Row = WideSelectionRow;

const helper = createColumnHelper<Row>();

const DEFAULT_COLUMN_ORDER: ColumnOrderState = [
  "select",
  "label",
  "category",
  "amount",
  "owner",
  "status",
  "region",
  "updated",
  "priority",
];

const COLUMN_SIZING_STORAGE_KEY = "nqgrid-playground-table-selection-column-sizing-v1";

const COLUMN_OVERLAY_LABELS: Record<string, string> = {
  label: "Label",
  category: "Category",
  amount: "Amount",
  owner: "Owner",
  status: "Status",
  region: "Region",
  updated: "Updated",
  priority: "Priority",
};

function readStoredColumnSizing(): ColumnSizingState {
  try {
    const raw = localStorage.getItem(COLUMN_SIZING_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as ColumnSizingState;
  } catch {
    /* ignore */
  }
  return {};
}

export function TableSelectionDemo({ data }: { data: Row[] }) {
  const [rowData, setRowData] = useState<Row[]>(data);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(EMPTY_ROW_SELECTION);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(readStoredColumnSizing);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(DEFAULT_COLUMN_ORDER);
  const { tokens, bundle } = useNeutralPlaygroundTable();

  useEffect(() => {
    setRowData(data);
  }, [data]);

  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_SIZING_STORAGE_KEY, JSON.stringify(columnSizing));
    } catch {
      /* ignore */
    }
  }, [columnSizing]);

  const sortableColumnIds = useMemo(() => dataColumnOrder(columnOrder), [columnOrder]);

  // Keyboard reorder: focus row # → Enter to grab → Arrow Up/Down → Enter to drop.
  const rowReorder = useRowKeyboardReorder({
    rowCount: rowData.length,
    indexOf: (id) => rowData.findIndex((r) => r.id === id),
    onMove: ({ id, dir }) =>
      setRowData((prev) => (dir < 0 ? moveRowUp(prev, id) : moveRowDown(prev, id))),
  });

  const columns = useMemo(
    () => [
      createSelectColumn(helper, {
        mode: "index+checkbox",
        getRowLabel: (r) => r.label,
        getKeyboardReorderProps: rowReorder.getGripProps,
        isGrabbed: rowReorder.isGrabbed,
      }),
      helper.accessor("label", {
        id: "label",
        header: "Label",
        cell: (i) => i.getValue(),
        size: 220,
        minSize: 120,
        maxSize: 480,
      }),
      helper.accessor("category", { id: "category", header: "Category", size: 96 }),
      helper.accessor("amount", {
        id: "amount",
        header: () => <span className="block w-full text-right">Amount</span>,
        cell: (i) => <span className="tabular-nums">{i.getValue()}</span>,
        size: 100,
        minSize: 80,
        maxSize: 200,
      }),
      helper.accessor("owner", { id: "owner", header: "Owner", size: 88 }),
      helper.accessor("status", { id: "status", header: "Status", size: 88 }),
      helper.accessor("region", { id: "region", header: "Region", size: 72 }),
      helper.accessor("updated", { id: "updated", header: "Updated", size: 108 }),
      helper.accessor("priority", { id: "priority", header: "Priority", size: 88 }),
    ],
    [],
  );

  const table = useReactTable<Row>(
    withCoreSortingRowSelection({
      data: rowData,
      columns,
      state: { sorting, rowSelection, columnSizing, columnOrder },
      onSortingChange: setSorting,
      onRowSelectionChange: setRowSelection,
      onColumnSizingChange: setColumnSizing,
      onColumnOrderChange: setColumnOrder,
      getRowId: (r) => r.id,
      enableColumnResizing: true,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 72, maxSize: 560, size: 160 },
    }),
  );

  const onSortableColumnReorder = useCallback((nextDataOrder: string[]) => {
    setColumnOrder(["select", ...nextDataOrder]);
  }, []);
  const sortableDrop = usePlaygroundSortableTableDropIndicators();

  return (
    <EngineScrollTableShell className="max-h-[min(60dvh,480px)]">
      <div ref={sortableDrop.containerRef} className={sortableDrop.containerClassName}>
        <table
          className={gridTableClass}
          style={{ width: table.getTotalSize(), tableLayout: "fixed" }}
        >
          <colgroup>
            {table.getVisibleLeafColumns().map((col) => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>
            <Sortable
              value={sortableColumnIds}
              onValueChange={onSortableColumnReorder}
              orientation="horizontal"
              flatCursor
              {...sortableDrop.columnSortableProps}
            >
              <SortableContent withoutSlot>
                <thead className={gridHeaderClass}>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => {
                        const id = header.column.id;
                        if (id === "select") {
                          return (
                            <CanonicalSelectHeaderCell
                              key={header.id}
                              header={header}
                              headClassName={gridHeadCellClass}
                            />
                          );
                        }
                        return (
                          <SortableItem key={header.id} value={id} asChild asHandle {...sortableDropTargetProps(id)}>
                            <CanonicalHeaderCell
                              header={header}
                              bundle={bundle}
                              headClassName={gridHeadCellClass}
                              numeric={id === "amount"}
                            />
                          </SortableItem>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
              </SortableContent>
              <SortableOverlay>
                {({ value }) => (
                  <SortableDragOverlay
                    axis="column"
                    label={sortableColumnOverlayLabel(value, COLUMN_OVERLAY_LABELS)}
                  />
                )}
              </SortableOverlay>
            </Sortable>

            <Sortable
              value={rowData}
              onValueChange={setRowData}
              getItemValue={(r: Row) => r.id}
              orientation="vertical"
              flatCursor
              {...sortableDrop.rowSortableProps}
            >
              <SortableContent withoutSlot>
                <tbody className={gridBodyHoverClass}>
                  {table.getRowModel().rows.map((row) => (
                    <SortableItem
                      key={row.id}
                      value={row.original.id}
                      asChild
                      asHandle
                      {...sortableDropTargetProps(row.original.id)}
                    >
                      <tr
                        data-state={row.getIsSelected() ? "selected" : undefined}
                        className={cn(
                          gridRowClass,
                          "group/row",
                          neutralTanStackRowFillClass(tokens, row.index),
                        )}
                        {...playgroundTanStackRowStripeData(tokens, row.index)}
                        title="Tap # or checkbox to select · drag row to reorder · ⌘/Ctrl-click row to toggle selection"
                        onClick={(e) => {
                          if (!e.metaKey && !e.ctrlKey) return;
                          e.preventDefault();
                          row.toggleSelected();
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className={cn(
                              gridCellClass,
                              cell.column.id === "select" ? "min-w-0 align-middle" : undefined,
                            )}
                            style={{ width: cell.column.getSize() }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    </SortableItem>
                  ))}
                </tbody>
              </SortableContent>
              <SortableOverlay>
                {({ value }) => {
                  const r = rowData.find((x) => x.id === value);
                  return (
                    <SortableDragOverlay
                      axis="row"
                      label={r ? `${r.label} · ${r.amount}` : String(value)}
                    />
                  );
                }}
              </SortableOverlay>
            </Sortable>
        </table>
        {sortableDrop.indicators}
      </div>
    </EngineScrollTableShell>
  );
}
