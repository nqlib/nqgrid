import type { UniqueIdentifier } from "@dnd-kit/core";
import { cn } from "@nqlib/nqui";

type SortableDragOverlayProps = {
  label: string;
  axis: "column" | "row";
  className?: string;
};

/** Cursor-following drag preview — no grip icon; shape hints column vs row. */
export function SortableDragOverlay({ label, axis, className }: SortableDragOverlayProps) {
  return (
    <div
      className={cn(
        "flex items-center border border-primary/40 bg-popover/95 text-xs font-medium text-foreground shadow-md backdrop-blur-sm",
        axis === "column"
          ? "h-8 min-w-[5rem] justify-center rounded-sm px-3"
          : "min-w-[12rem] justify-start rounded-md px-3 py-2",
        className,
      )}
    >
      <span className="truncate">{label}</span>
    </div>
  );
}

type SortableColumnDragOverlayProps = {
  label: string;
  widthPx: number;
  heightPx?: number;
  className?: string;
};

/** Full-width column header ghost that follows the cursor during column reorder. */
export function SortableColumnDragOverlay({
  label,
  widthPx,
  heightPx = 32,
  className,
}: SortableColumnDragOverlayProps) {
  return (
    <div
      className={cn(
        "flex cursor-grabbing items-center overflow-hidden border border-primary/50 bg-popover/95 px-2 text-xs font-medium text-foreground shadow-lg ring-2 ring-primary/20 backdrop-blur-sm",
        className,
      )}
      style={{ width: widthPx, minWidth: widthPx, height: heightPx, minHeight: heightPx }}
    >
      <span className="truncate">{label}</span>
    </div>
  );
}

export function sortableColumnOverlayLabel(
  value: UniqueIdentifier,
  labels?: Record<string, string>,
): string {
  const key = String(value);
  return labels?.[key] ?? key;
}
