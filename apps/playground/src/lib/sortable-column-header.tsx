import { flexRender, type Header } from "@tanstack/react-table";
import { Button, cn } from "@nqlib/nqui";
import { sortableNestedControlProps, stopSortableChain } from "./playground-sortable-utils";

type SortableColumnHeaderProps<TData> = {
  header: Header<TData, unknown>;
  className?: string;
};

/** Sortable thead label using nqui Button (replaces raw `<button>` in table headers). */
export function SortableColumnHeader<TData>({ header, className }: SortableColumnHeaderProps<TData>) {
  if (header.isPlaceholder) return null;

  if (!header.column.getCanSort()) {
    return flexRender(header.column.columnDef.header, header.getContext());
  }

  const sorted = header.column.getIsSorted();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("-ml-2 h-7 max-w-full justify-start gap-0.5 px-2 font-medium", className)}
      onClick={(e) => {
        stopSortableChain(e);
        header.column.getToggleSortingHandler()?.(e);
      }}
      onPointerDown={stopSortableChain}
      onMouseDown={stopSortableChain}
      onTouchStart={stopSortableChain}
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
      {sorted === "asc" ? <span aria-hidden>↑</span> : null}
      {sorted === "desc" ? <span aria-hidden>↓</span> : null}
    </Button>
  );
}
