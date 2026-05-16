import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreVerticalIcon } from "@hugeicons/core-free-icons";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Label,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@nqlib/nqui";
import {
  buildRichColumnFromDef,
  tableCellClass,
  tableDenseTypography,
  tableFooterClass,
  tableHeaderClass,
  tableHeadClass,
  tableRowClass,
  tableScrollAreaContentClass,
  tableScrollAreaRootClass,
  tableScrollViewportStyle,
  tableShellClass,
  type PeopleRichColumn,
  type RichSchemaColumnDef,
  type StatusRichColumn,
} from "@nqlib/nqgrid";
import { PlaygroundPeopleComboboxCell } from "./playground-people-combobox-cell";
import { usePlaygroundTableBodyClass } from "../playground-table-settings";
import { RichGridLabAddColumnDialog } from "./rich-grid-lab-add-column-dialog";
import { RichGridLabColumnSheet } from "./rich-grid-lab-column-sheet";
import {
  INITIAL_LAB_COLUMNS,
  DEFAULT_LAB_PEOPLE_ROSTER,
  createInitialRows,
  createLabColumnFromPreset,
  defaultValueForKind,
  labColumnToRichDef,
  labNumberStyle,
  newLabId,
  type LabAddColumnPreset,
  type LabColumn,
  type LabRow,
} from "./rich-grid-lab-types";

type LocaleChoice = "en-US" | "de-DE" | "fr-FR" | "ja-JP";

type PendingInsert = { readonly anchorId: string; readonly side: "left" | "right" };

function ColumnHeaderMenu({
  column,
  canRemove,
  onConfigure,
  onInsertLeft,
  onInsertRight,
  onRemove,
}: {
  readonly column: LabColumn;
  readonly canRemove: boolean;
  readonly onConfigure: (id: string) => void;
  readonly onInsertLeft: (id: string) => void;
  readonly onInsertRight: (id: string) => void;
  readonly onRemove: (id: string) => void;
}) {
  const numeric = column.kind === "number";
  return (
    <div className={cn("flex w-full min-w-0 items-center gap-0.5", numeric && "justify-end")}>
      <span className="min-w-0 flex-1 truncate text-xs font-medium uppercase tracking-wide">{column.name}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label={`Column actions for ${column.name}`}
          >
            <HugeiconsIcon icon={MoreVerticalIcon} className="size-4 text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => onConfigure(column.id)}>Configure column…</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onInsertLeft(column.id)}>Insert column left</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onInsertRight(column.id)}>Insert column right</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!canRemove}
            className="text-destructive focus:text-destructive"
            onSelect={() => onRemove(column.id)}
          >
            Remove column
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function RichNumberFormatsDemo() {
  const [locale, setLocale] = useState<LocaleChoice>("en-US");
  const [columns, setColumns] = useState<LabColumn[]>(() => INITIAL_LAB_COLUMNS.map((c) => ({ ...c })));
  const [rows, setRows] = useState<LabRow[]>(createInitialRows);
  const [configureId, setConfigureId] = useState<string | null>(null);
  const [pendingInsert, setPendingInsert] = useState<PendingInsert | null>(null);
  const tableBodyClassName = usePlaygroundTableBodyClass();

  const configureColumn = useMemo(
    () => (configureId ? columns.find((c) => c.id === configureId) ?? null : null),
    [columns, configureId],
  );

  const anchorForInsert = useMemo(
    () => (pendingInsert ? columns.find((c) => c.id === pendingInsert.anchorId) ?? null : null),
    [columns, pendingInsert],
  );

  const handleSaveColumn = useCallback((updated: LabColumn) => {
    setColumns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }, []);

  const insertColumn = useCallback((anchorId: string, side: "left" | "right", preset: LabAddColumnPreset) => {
    const col = createLabColumnFromPreset(preset);
    const numberStyle = col.kind === "number" ? labNumberStyle(col) : undefined;
    setColumns((prev) => {
      const i = prev.findIndex((c) => c.id === anchorId);
      if (i < 0) return [...prev, col];
      const at = side === "left" ? i : i + 1;
      const next = [...prev];
      next.splice(at, 0, col);
      return next;
    });
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        [col.fieldKey]: defaultValueForKind(col.kind, numberStyle),
      })),
    );
    setPendingInsert(null);
  }, []);

  const removeColumn = useCallback(
    (columnId: string) => {
      const target = columns.find((c) => c.id === columnId);
      if (!target || columns.length <= 1) return;
      const fieldKey = target.fieldKey;
      setColumns((prev) => prev.filter((c) => c.id !== columnId));
      setRows((prev) =>
        prev.map((row) => {
          const next = { ...row };
          delete next[fieldKey];
          return next;
        }),
      );
    },
    [columns],
  );

  const addRow = useCallback(() => {
    const id = newLabId("row");
    const row: LabRow = { id, label: "New row" };
    for (const col of columns) {
      (row as Record<string, unknown>)[col.fieldKey] = defaultValueForKind(
        col.kind,
        col.kind === "number" ? labNumberStyle(col) : undefined,
      );
    }
    setRows((prev) => [...prev, row]);
  }, [columns]);

  const removeRow = useCallback((rowId: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== rowId)));
  }, []);

  const onConfigure = useCallback((id: string) => setConfigureId(id), []);
  const onInsertLeft = useCallback((id: string) => setPendingInsert({ anchorId: id, side: "left" }), []);
  const onInsertRight = useCallback((id: string) => setPendingInsert({ anchorId: id, side: "right" }), []);

  const tanstackColumns = useMemo((): ColumnDef<LabRow, unknown>[] => {
    const tableRichConfig = {
      locale,
      defaultLocale: locale,
      renderPeoplePicker: PlaygroundPeopleComboboxCell,
    } as const;

    const dataCols: ColumnDef<LabRow, unknown>[] = columns.map((col) => {
      let richDef: RichSchemaColumnDef<LabRow> = labColumnToRichDef(col, locale);
      if (col.kind === "status" && col.statusEditable !== false) {
        const statusDef: StatusRichColumn<LabRow> = {
          ...(richDef as StatusRichColumn<LabRow>),
          editable: true,
          onValueChange: ({ row, value }) => {
            setRows((prev) =>
              prev.map((r) => (r.id === row.id ? { ...r, [col.fieldKey]: value } : r)),
            );
          },
        };
        richDef = statusDef;
      }
      if (col.kind === "people" && col.peopleEditable === true && (col.peopleOptions?.length ?? 0) > 0) {
        const roster = col.peopleOptions ?? [...DEFAULT_LAB_PEOPLE_ROSTER];
        const pe: PeopleRichColumn<LabRow> = {
          ...(richDef as PeopleRichColumn<LabRow>),
          editable: true,
          pickerOptions: roster,
          max: col.peopleMax ?? 6,
          onValueChange: ({ row, value }) => {
            setRows((prev) =>
              prev.map((r) => (r.id === row.id ? { ...r, [col.fieldKey]: value } : r)),
            );
          },
        };
        richDef = pe;
      }
      const built = buildRichColumnFromDef(richDef, tableRichConfig);
      const numeric = col.kind === "number";
      return {
        ...built,
        header: () => (
          <ColumnHeaderMenu
            column={col}
            canRemove={columns.length > 1}
            onConfigure={onConfigure}
            onInsertLeft={onInsertLeft}
            onInsertRight={onInsertRight}
            onRemove={removeColumn}
          />
        ),
        meta: { ...(built.meta ?? {}), numericAlign: numeric },
      } as ColumnDef<LabRow, unknown>;
    });

    const rowActions: ColumnDef<LabRow, unknown> = {
      id: "__rowActions",
      size: 48,
      enableSorting: false,
      header: () => <span className="sr-only">Row</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Row actions">
              <HugeiconsIcon icon={MoreVerticalIcon} className="size-4 text-muted-foreground" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={rows.length <= 1}
              className="text-destructive focus:text-destructive"
              onSelect={() => removeRow(row.original.id)}
            >
              Remove row
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    };

    return [...dataCols, rowActions];
  }, [columns, locale, onConfigure, onInsertLeft, onInsertRight, removeColumn, removeRow, rows.length]);

  const table = useReactTable({
    data: rows,
    columns: tanstackColumns,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        PM-style grid lab: use the <strong>⋮</strong> on each column header to configure or add/remove columns. Row
        actions are on the right. <strong>Assignees</strong> uses a compact avatar-stack trigger (ellipsis overflow) and
        an <span className="font-mono">nqui</span> multi-select list, wired through{" "}
        <span className="font-mono">renderPeoplePicker</span>. Number formatting is edited in the sheet and applied on{" "}
        <strong>Save</strong> (no live toggle rebuild — avoids UI freeze).
      </p>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border/60 bg-muted/15 p-4 dark:bg-muted/10">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">Table locale</Label>
          <Select value={locale} onValueChange={(v) => setLocale(v as LocaleChoice)}>
            <SelectTrigger className="w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en-US">en-US</SelectItem>
              <SelectItem value="de-DE">de-DE</SelectItem>
              <SelectItem value="fr-FR">fr-FR</SelectItem>
              <SelectItem value="ja-JP">ja-JP</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm" onClick={addRow}>
          Add row
        </Button>
      </div>

      <div className={tableShellClass}>
        <ScrollArea
          orientation="both"
          fadeMask={false}
          className={tableScrollAreaRootClass}
          viewportStyle={tableScrollViewportStyle}
        >
          <div className={tableScrollAreaContentClass}>
            <table className={cn(tableDenseTypography, "min-w-[720px]")}>
              <TableHeader className={tableHeaderClass}>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className={tableRowClass}>
                    {hg.headers.map((header) => {
                      const numeric = (header.column.columnDef.meta as { numericAlign?: boolean } | undefined)?.numericAlign;
                      return (
                        <TableHead
                          key={header.id}
                          className={cn(tableHeadClass, numeric && "text-right")}
                          style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                        >
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className={tableBodyClassName}>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className={tableRowClass}>
                    {row.getVisibleCells().map((cell) => {
                      const numeric = (cell.column.columnDef.meta as { numericAlign?: boolean } | undefined)?.numericAlign;
                      return (
                        <TableCell key={cell.id} className={cn(tableCellClass, numeric && "text-right")}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
        </ScrollArea>
        <div className={tableFooterClass}>
          <p className="text-xs text-muted-foreground">
            {columns.length} columns · {rows.length} rows · configure per column via ⋮ menu
          </p>
        </div>
      </div>

      <RichGridLabColumnSheet
        open={configureId != null}
        column={configureColumn}
        onOpenChange={(open) => {
          if (!open) setConfigureId(null);
        }}
        onSave={handleSaveColumn}
      />

      <RichGridLabAddColumnDialog
        open={pendingInsert != null}
        side={pendingInsert?.side ?? null}
        anchorColumnName={anchorForInsert?.name ?? null}
        onOpenChange={(open) => {
          if (!open) setPendingInsert(null);
        }}
        onPick={(preset) => {
          if (pendingInsert) insertColumn(pendingInsert.anchorId, pendingInsert.side, preset);
        }}
      />
    </div>
  );
}
