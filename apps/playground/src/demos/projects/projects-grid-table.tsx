/**
 * Grid-engine table: selection, type-aware inline edit, column + row drag.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  createColumnHelper,
  flexRender,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { cn } from "@nqlib/nqui";
import { Sortable, SortableContent, SortableItem, SortableOverlay } from "@nqlib/nqui/sortable";
import {
  getSelectionBounds,
  isCellSelection,
  useGridKeyboard,
  withCoreSorting,
  type SelectionRange,
} from "@nqlib/nqgrid";
import { compareCells, type ColumnSchema } from "@nqlib/nqgrid/engine";
import {
  neutralTanStackRowFillClass,
  playgroundTanStackRowStripeData,
  useNeutralPlaygroundTable,
} from "../../lib/playground-neutral-table";
import { SortableDragOverlay } from "../../lib/playground-sortable-drag-chrome";
import {
  sortableDropTargetProps,
  usePlaygroundSortableTableDropIndicators,
} from "../../lib/playground-sortable-drop-indicator";
import { stopSortableChain } from "../../lib/playground-sortable-utils";
import {
  gridBodyHoverClass,
  gridCellClass,
  gridHeadCellClass,
  gridHeaderClass,
  gridRowClass,
  gridTableClass,
} from "../../lib/grid-styles";
import { EngineScrollTableShell } from "../../parity/engine-scroll-table-shell";
import {
  applyVisibleColumnOrder,
  patchColumnModel,
  removeColumnModel,
  toColumnSchema,
  type PmColumnModel,
} from "./pm-column-model";
import { ProjectsColumnHeader } from "./projects-column-header-menu";
import { EditableCell } from "./editable-cell";
import { pmRegistry, setTaskValue, taskValue, type Task } from "./pm-schema";

const columnHelper = createColumnHelper<Task>();

const COLUMN_WIDTH: Record<string, number> = {
  title: 220,
  status: 112,
  priority: 104,
  assignee: 112,
  effort: 72,
  progress: 96,
  budget: 96,
  due: 108,
  timeline: 148,
};

function columnSize(schema: ColumnSchema): number {
  return COLUMN_WIDTH[schema.id] ?? 96;
}

function isCellSelected(row: number, col: number, sel: SelectionRange | null): boolean {
  if (!sel || !isCellSelection(sel)) return false;
  const b = getSelectionBounds(sel);
  return row >= b.startRow && row <= b.endRow && col >= b.startCol && col <= b.endCol;
}

function isPrintableKey(key: string): boolean {
  return key.length === 1;
}

type EditTarget = { row: number; col: number; seed?: string };

export function ProjectsGridTable({
  tasks,
  onTasksChange,
  columnModels,
  onColumnModelsChange,
  onConfigureColumn,
}: {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  columnModels: PmColumnModel[];
  onColumnModelsChange: (models: PmColumnModel[]) => void;
  onConfigureColumn: (id: string) => void;
}) {
  const { tokens, bundle } = useNeutralPlaygroundTable();
  const [sorting, setSorting] = useState<SortingState>([{ id: "title", desc: false }]);
  const [selection, setSelection] = useState<SelectionRange | null>({
    type: "cell",
    start: { row: 0, col: 0 },
    end: { row: 0, col: 0 },
  });
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tasksRef = useRef(tasks);
  const sortableDrop = usePlaygroundSortableTableDropIndicators();

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const visibleModels = useMemo(() => columnModels.filter((m) => m.visible), [columnModels]);
  const schema = useMemo(() => visibleModels.map(toColumnSchema), [visibleModels]);
  const schemaById = useMemo(() => new Map(schema.map((c) => [c.id, c])), [schema]);
  const modelById = useMemo(() => new Map(columnModels.map((m) => [m.id, m])), [columnModels]);
  const sortableColumnIds = useMemo(() => visibleModels.map((m) => m.id), [visibleModels]);

  const commitCell = useCallback(
    (taskId: string, columnId: string, raw: unknown) => {
      onTasksChange(
        tasksRef.current.map((t) => (t.id === taskId ? setTaskValue(t, columnId, raw) : t)),
      );
      setEditing(null);
      gridRef.current?.focus();
    },
    [onTasksChange],
  );

  const startEdit = useCallback((row: number, col: number, seed?: string) => {
    const colSchema = schema[col];
    if (!colSchema) return;
    const editor = pmRegistry.require(colSchema.type).editor(colSchema);
    if (editor.control === "none") return;
    setEditing({ row, col, seed });
  }, [schema]);

  const columns = useMemo(
    () =>
      schema.map((col) =>
        columnHelper.accessor((row) => taskValue(row, col.id), {
          id: col.id,
          header: col.label,
          size: columnSize(col),
          cell: ({ row, column, table }) => {
            const colIndex = table.getVisibleLeafColumns().findIndex((c) => c.id === column.id);
            const colSchema = schemaById.get(column.id)!;
            return (
              <EditableCell
                task={row.original}
                schema={colSchema}
                isSelected={isCellSelected(row.index, colIndex, selection)}
                isEditing={editing?.row === row.index && editing?.col === colIndex}
                editSeed={
                  editing?.row === row.index && editing?.col === colIndex ? editing.seed : undefined
                }
                onSelect={() =>
                  setSelection({
                    type: "cell",
                    start: { row: row.index, col: colIndex },
                    end: { row: row.index, col: colIndex },
                  })
                }
                onStartEdit={() => startEdit(row.index, colIndex)}
                onCommit={(raw) => commitCell(row.original.id, column.id, raw)}
                onCancelEdit={() => {
                  setEditing(null);
                  gridRef.current?.focus();
                }}
              />
            );
          },
          sortingFn: (rowA, rowB, columnId) => {
            const colSchema = schemaById.get(columnId);
            if (!colSchema) return 0;
            return compareCells(
              taskValue(rowA.original, columnId),
              taskValue(rowB.original, columnId),
              pmRegistry.require(colSchema.type),
              colSchema,
            );
          },
        }),
      ),
    [schema, schemaById, selection, editing, commitCell, startEdit],
  );

  const table = useReactTable(
    withCoreSorting({
      data: tasks,
      columns,
      state: { sorting },
      onSortingChange: setSorting,
      getRowId: (r) => r.id,
    }),
  );

  const rowCount = table.getRowModel().rows.length;
  const columnCount = table.getVisibleLeafColumns().length;

  const { onKeyDown: gridKeyDown } = useGridKeyboard({
    selection,
    onSelectionChange: setSelection,
    rowCount,
    columnCount,
  });

  const onGridKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (editing) return;

      if (e.key === "F2" && selection && isCellSelection(selection)) {
        e.preventDefault();
        const b = getSelectionBounds(selection);
        startEdit(b.startRow, b.startCol);
        return;
      }

      if (e.key === "Enter" && selection && isCellSelection(selection)) {
        e.preventDefault();
        const b = getSelectionBounds(selection);
        startEdit(b.startRow, b.startCol);
        return;
      }

      if (
        selection &&
        isCellSelection(selection) &&
        isPrintableKey(e.key) &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const b = getSelectionBounds(selection);
        const colSchema = schema[b.startCol];
        if (colSchema) {
          const editor = pmRegistry.require(colSchema.type).editor(colSchema);
          if (editor.control === "text" || editor.control === "number") {
            e.preventDefault();
            startEdit(b.startRow, b.startCol, e.key);
            return;
          }
        }
      }

      gridKeyDown(e);
    },
    [editing, selection, gridKeyDown, startEdit, schema],
  );

  const onColumnReorder = useCallback(
    (nextIds: string[]) => {
      onColumnModelsChange(applyVisibleColumnOrder(columnModels, nextIds));
    },
    [columnModels, onColumnModelsChange],
  );

  const hideColumn = useCallback(
    (id: string) => {
      onColumnModelsChange(patchColumnModel(columnModels, id, { visible: false }));
    },
    [columnModels, onColumnModelsChange],
  );

  const deleteColumn = useCallback(
    (id: string) => {
      onColumnModelsChange(removeColumnModel(columnModels, id));
    },
    [columnModels, onColumnModelsChange],
  );

  return (
    <div ref={sortableDrop.containerRef} className={sortableDrop.containerClassName}>
      <EngineScrollTableShell className="max-h-[min(60dvh,480px)]">
        <div
          ref={gridRef}
          role="grid"
          tabIndex={0}
          className="outline-none"
          aria-label="Project tasks grid"
          onKeyDown={onGridKeyDown}
        >
          <table className={gridTableClass} style={{ width: "100%", minWidth: table.getTotalSize() }}>
            <colgroup>
              {table.getVisibleLeafColumns().map((col) => (
                <col
                  key={col.id}
                  style={{
                    width: col.id === "title" ? undefined : col.getSize(),
                    minWidth: col.id === "title" ? col.getSize() : undefined,
                  }}
                />
              ))}
            </colgroup>

            <Sortable
              value={sortableColumnIds}
              onValueChange={onColumnReorder}
              orientation="horizontal"
              flatCursor
              {...sortableDrop.columnSortableProps}
            >
              <SortableContent withoutSlot>
                <thead className={gridHeaderClass}>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => {
                        const model = modelById.get(h.column.id);
                        if (!model) return null;
                        return (
                          <SortableItem
                            key={h.id}
                            value={h.column.id}
                            asChild
                            asHandle
                            {...sortableDropTargetProps(h.column.id)}
                          >
                            <th
                              className={cn(gridHeadCellClass, "group/col relative")}
                              style={{ width: h.getSize() }}
                            >
                              <ProjectsColumnHeader
                                header={h}
                                model={model}
                                onConfigure={() => onConfigureColumn(h.column.id)}
                                onHide={() => hideColumn(h.column.id)}
                                onDelete={() => deleteColumn(h.column.id)}
                              />
                            </th>
                          </SortableItem>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
              </SortableContent>
              <SortableOverlay>
                {({ value }) => {
                  const m = modelById.get(String(value));
                  return <SortableDragOverlay axis="column" label={m?.label ?? String(value)} />;
                }}
              </SortableOverlay>
            </Sortable>

            <Sortable
              value={tasks}
              onValueChange={onTasksChange}
              getItemValue={(r) => r.id}
              orientation="vertical"
              flatCursor
              {...sortableDrop.rowSortableProps}
            >
              <SortableContent withoutSlot>
                <tbody className={gridBodyHoverClass}>
                  {rowCount === 0 ? (
                    <tr>
                      <td
                        colSpan={schema.length}
                        className={cn(gridCellClass, "py-8 text-center text-muted-foreground")}
                      >
                        No tasks in this view
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <SortableItem
                        key={row.id}
                        value={row.original.id}
                        asChild
                        asHandle
                        {...sortableDropTargetProps(row.original.id)}
                      >
                        <tr
                          className={cn(
                            gridRowClass,
                            "group/row",
                            neutralTanStackRowFillClass(tokens, row.index),
                          )}
                          {...playgroundTanStackRowStripeData(tokens, row.index)}
                          title="Drag row to reorder · click cell to select · F2 to edit"
                        >
                          {row.getVisibleCells().map((cell, colIndex) => {
                            const selected = isCellSelected(row.index, colIndex, selection);
                            return (
                              <td
                                key={cell.id}
                                className={cn(
                                  gridCellClass,
                                  selected && !editing && bundle.cellRangeFill,
                                  selected && !editing && bundle.cellRangeActive,
                                )}
                                onClick={(e) => {
                                  stopSortableChain(e);
                                  if (
                                    editing?.row === row.index &&
                                    editing?.col === colIndex
                                  ) {
                                    return;
                                  }
                                  const alreadySelected = isCellSelected(
                                    row.index,
                                    colIndex,
                                    selection,
                                  );
                                  if (alreadySelected) {
                                    startEdit(row.index, colIndex);
                                    return;
                                  }
                                  setSelection({
                                    type: "cell",
                                    start: { row: row.index, col: colIndex },
                                    end: { row: row.index, col: colIndex },
                                  });
                                  gridRef.current?.focus();
                                }}
                                onDoubleClick={(e) => {
                                  stopSortableChain(e);
                                  if (editing) return;
                                  startEdit(row.index, colIndex);
                                }}
                                onPointerDown={stopSortableChain}
                                onMouseDown={stopSortableChain}
                                onTouchStart={stopSortableChain}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            );
                          })}
                        </tr>
                      </SortableItem>
                    ))
                  )}
                </tbody>
              </SortableContent>
              <SortableOverlay>
                {({ value }) => {
                  const t = tasks.find((x) => x.id === value);
                  return <SortableDragOverlay axis="row" label={t?.title ?? String(value)} />;
                }}
              </SortableOverlay>
            </Sortable>
          </table>
        </div>
        {sortableDrop.indicators}
      </EngineScrollTableShell>
    </div>
  );
}
