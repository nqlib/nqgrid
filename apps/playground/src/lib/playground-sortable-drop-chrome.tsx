import type { CSSProperties } from "react";
import { cn } from "@nqlib/nqui";

/** Playground-only: suppress dnd-kit item shuffle while the engine drop line is active. */
export const sortableTableDragSuppressClass =
  "[&_[data-slot=sortable-item]]:!transform-none [&_[data-slot=sortable-item]]:!transition-none";

export function sortableDropContainerClassName(isDragging: boolean): string {
  return cn("relative min-w-0", isDragging && sortableTableDragSuppressClass);
}

/** Render engine `indicatorStyle` with playground tokens. */
export function SortableDropIndicatorLine({
  style,
  orientation,
}: {
  style: CSSProperties | null;
  orientation: "vertical" | "horizontal";
}) {
  if (!style) return null;

  return (
    <div
      aria-hidden
      className={cn(
        "bg-primary shadow-[0_0_0_1px] shadow-primary/40",
        orientation === "vertical" ? "h-0.5" : "w-0.5",
      )}
      style={style}
    />
  );
}
