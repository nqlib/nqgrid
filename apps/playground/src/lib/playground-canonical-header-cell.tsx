import type { CSSProperties } from "react";
import { flexRender, type Header } from "@tanstack/react-table";
import { cn } from "@nqlib/nqui";
import type { TableClassBundle } from "./nqgrid-styling";
import { SortableColumnHeader } from "./sortable-column-header";
import { stopSortableChain } from "./playground-sortable-utils";
import { getSelectColumnMode, selectColumnThClass } from "./playground-canonical-select-column";

export type CanonicalHeaderCellProps<TData> = {
  header: Header<TData, unknown>;
  bundle: TableClassBundle;
  className?: string;
  style?: CSSProperties;
  headClassName?: string;
  numeric?: boolean;
  sortable?: boolean;
};

/** Draggable + sortable + resizable header cell — drag anywhere on the header (not a grip icon). */
export function CanonicalHeaderCell<TData>({
  header,
  bundle,
  className,
  style,
  headClassName,
  numeric,
  sortable = true,
}: CanonicalHeaderCellProps<TData>) {
  const id = header.column.id;

  return (
    <th
      className={cn(headClassName, "group/col relative bg-card", className)}
      style={{ width: header.getSize(), ...style }}
    >
      {header.isPlaceholder ? null : (
        <>
          <div
            className={cn(
              "flex min-w-0 items-center pr-3",
              numeric ? "justify-end" : undefined,
            )}
          >
            {sortable && header.column.getCanSort() ? (
              <SortableColumnHeader
                header={header}
                className={cn("min-w-0 flex-1", numeric ? "ml-auto justify-end" : undefined)}
              />
            ) : (
              <span className={cn("min-w-0 flex-1 truncate px-2 text-xs font-medium", numeric && "text-right")}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </span>
            )}
          </div>
          {header.column.getCanResize() ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={`Resize ${id} column`}
              onMouseDown={(e) => {
                stopSortableChain(e);
                header.getResizeHandler()(e);
              }}
              onTouchStart={(e) => {
                stopSortableChain(e);
                header.getResizeHandler()(e);
              }}
              className={cn(
                "absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none select-none border-r border-transparent",
                bundle.chromeResizeHover,
                header.column.getIsResizing() && bundle.chromeResizeActive,
              )}
            />
          ) : null}
        </>
      )}
    </th>
  );
}

/** Static select column header (not in horizontal Sortable). */
export function CanonicalSelectHeaderCell<TData>({
  header,
  headClassName,
  style,
  className,
  "data-pinned": dataPinned,
}: {
  header: Header<TData, unknown>;
  headClassName?: string;
  style?: CSSProperties;
  className?: string;
  "data-pinned"?: true;
}) {
  const mode = getSelectColumnMode(header.column);
  return (
    <th
      className={cn(selectColumnThClass(mode, headClassName ?? "bg-card"), className)}
      style={{ width: header.getSize(), ...style }}
      {...(dataPinned ? { "data-pinned": true as const } : {})}
    >
      {header.isPlaceholder
        ? null
        : typeof header.column.columnDef.header === "function"
          ? header.column.columnDef.header(header.getContext())
          : header.column.columnDef.header}
    </th>
  );
}
