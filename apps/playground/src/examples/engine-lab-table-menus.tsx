import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@nqlib/nqui";
import type { Column, Header, Table } from "@tanstack/react-table";
import { sortableNestedControlProps } from "../lib/playground-sortable-utils";

const kebabTriggerClass =
  "h-6 w-6 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity " +
  "focus-visible:opacity-100 data-[state=open]:opacity-100";

/** Friendly label for a column whose header may be a render function. */
function columnLabel<TData>(column: Column<TData, unknown>): string {
  const header = column.columnDef.header;
  if (typeof header === "string" && header.length > 0) return header;
  // Humanize the id (budgetUsd → "Budget usd").
  const id = column.id.replace(/([a-z])([A-Z])/g, "$1 $2");
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/** Per-column ⋯ menu in the header: sort + hide. Revealed on header hover (`group/col`). */
export function ColumnHeaderMenu<TData>({ header }: { header: Header<TData, unknown> }) {
  const column = header.column;
  const canSort = column.getCanSort();
  const canHide = column.getCanHide();
  if (!canSort && !canHide) return null;
  const sorted = column.getIsSorted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`${columnLabel(column)} column options`}
          className={cn(kebabTriggerClass, "group-hover/col:opacity-100")}
          {...sortableNestedControlProps}
        >
          <span aria-hidden className="text-base leading-none">⋯</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {canSort ? (
          <>
            <DropdownMenuItem onClick={() => column.toggleSorting(false)} disabled={sorted === "asc"}>
              Sort ascending
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => column.toggleSorting(true)} disabled={sorted === "desc"}>
              Sort descending
            </DropdownMenuItem>
            {sorted ? <DropdownMenuItem onClick={() => column.clearSorting()}>Clear sort</DropdownMenuItem> : null}
          </>
        ) : null}
        {canSort && canHide ? <DropdownMenuSeparator /> : null}
        {canHide ? (
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>Hide column</DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Optional row-move actions for the ⋯ menu (Excel-style, virtualization-safe). */
export interface RowMoveActions {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToTop: () => void;
  /** When false, move items are disabled (e.g. an active sort owns the order). */
  canMove: boolean;
  /** Reason shown when moves are disabled. */
  disabledHint?: string;
}

/** Per-row ⋯ menu: row-level config. Revealed on row hover (`group/row`). */
export function RowActionsMenu({
  label,
  onDuplicate,
  onDelete,
  move,
}: {
  label: string;
  onDuplicate?: () => void;
  onDelete?: () => void;
  /** Optional Move up / down / to top block. */
  move?: RowMoveActions;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`${label} row options`}
          className={cn(kebabTriggerClass, "group-hover/row:opacity-100")}
        >
          <span aria-hidden className="text-base leading-none">⋯</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {move ? (
          <>
            {!move.canMove && move.disabledHint ? (
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {move.disabledHint}
              </DropdownMenuLabel>
            ) : null}
            <DropdownMenuItem onClick={move.onMoveUp} disabled={!move.canMove}>
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem onClick={move.onMoveDown} disabled={!move.canMove}>
              Move down
            </DropdownMenuItem>
            <DropdownMenuItem onClick={move.onMoveToTop} disabled={!move.canMove}>
              Move to top
            </DropdownMenuItem>
            {onDuplicate || onDelete ? <DropdownMenuSeparator /> : null}
          </>
        ) : null}
        {onDuplicate ? (
          <DropdownMenuItem onClick={onDuplicate}>Duplicate row</DropdownMenuItem>
        ) : null}
        {onDuplicate && onDelete ? <DropdownMenuSeparator /> : null}
        {onDelete ? (
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            Delete row
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Toolbar column-visibility menu — show/hide data columns, like a spreadsheet "Columns" control. */
export function SpreadsheetColumnsMenu<TData>({
  table,
  excludeIds = [],
}: {
  table: Table<TData>;
  excludeIds?: readonly string[];
}) {
  const columns = table
    .getAllLeafColumns()
    .filter((c) => c.getCanHide() && !excludeIds.includes(c.id));
  const hiddenCount = columns.filter((c) => !c.getIsVisible()).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
          Columns
          {hiddenCount > 0 ? (
            <span className="rounded bg-muted px-1 text-[10px] font-medium tabular-nums text-muted-foreground">
              {hiddenCount} hidden
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(value) => column.toggleVisibility(!!value)}
            onSelect={(e) => e.preventDefault()}
          >
            {columnLabel(column)}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={hiddenCount === 0}
          onClick={() => table.toggleAllColumnsVisible(true)}
        >
          Show all columns
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
