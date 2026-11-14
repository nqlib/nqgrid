import { useState } from "react";
import { Button, Popover, PopoverContent, PopoverTrigger, ScrollArea, cn } from "@nqlib/nqui";
import { PIVOT_VALUES_FIELD } from "@nqlib/nqgrid/core";
import {
  PivotFilterIcon,
  PivotFilterMenu,
  pivotDropZoneProps,
  pivotFieldDragHandleProps,
  pivotFilterMenuProps,
  type PivotColumnHeaderContext,
  type PivotDimensionHeaderContext,
  type PivotGridState,
  type PivotLayoutDraftState,
} from "@nqlib/nqgrid/pivot";

/**
 * Row-dimension header: a drag handle (drop it on the field list's areas, or on another header to
 * reorder the row levels), the sort / filter indicator and an nqui popover holding `PivotFilterMenu`.
 * Drags go through the shared layout draft, so "Defer layout update" holds them until Update.
 */
export function DimensionHeaderMenu({
  grid,
  layout,
  context,
}: {
  grid: PivotGridState;
  layout: PivotLayoutDraftState;
  context: PivotDimensionHeaderContext;
}) {
  const [open, setOpen] = useState(false);
  const active = context.status.filtered || context.status.sort !== null;
  const field = context.dimension.field;
  const source = { field, from: "rows" as const, label: context.label };
  return (
    <div
      className="flex min-w-0 items-center justify-between gap-1 rounded-sm data-[nqg-drop-active]:bg-primary/10"
      {...pivotDropZoneProps("rows", { axis: "x", offset: context.level })}
      data-nqg-drop-item=""
    >
      <span
        className="flex min-w-0 items-center gap-1"
        title={`Drag ${context.label} to the field list or another header`}
        {...pivotFieldDragHandleProps({
          source,
          canDrop: (target) => layout.canMoveField({ ...source, to: target.to, index: target.index }),
          onDrop: (target) => layout.moveField({ ...source, to: target.to, index: target.index }),
        })}
      >
        <span className="truncate">{context.label}</span>
        {context.indicator}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Filter and sort ${context.label}`}
            className={cn("size-6", active ? "text-primary" : "text-muted-foreground")}
          >
            <PivotFilterIcon filled={active} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <ScrollArea className="max-h-[min(32rem,var(--radix-popover-content-available-height))]" fadeMask={false}>
            <div className="p-3">
              <PivotFilterMenu {...pivotFilterMenuProps(grid, field)} onClose={() => setOpen(false)} />
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Column header: the column group toggle, and for column-field cells a drag handle (drop on the field
 * list, or on another column level to reorder) plus a drop zone at the level's Columns-area position.
 * Measure cells drag Σ Values.
 */
export function ColumnHeader({ layout, context }: { layout: PivotLayoutDraftState; context: PivotColumnHeaderContext }) {
  const draggable = context.kind === "dimension" || context.kind === "measure";
  if (!draggable || context.mode !== "interactive") {
    return context.toggle ? (
      <span className="flex min-w-0 items-center gap-1">
        {context.toggle}
        <span className="truncate">{context.label}</span>
      </span>
    ) : (
      context.label
    );
  }
  const source =
    context.kind === "measure"
      ? { field: PIVOT_VALUES_FIELD, from: "columns" as const, label: "Σ Values" }
      : { field: context.dimension!.field, from: "columns" as const, label: context.dimension!.label };
  return (
    <div
      className="flex min-w-0 items-center gap-1 rounded-sm data-[nqg-drop-active]:bg-primary/10"
      {...pivotDropZoneProps("columns", { axis: "x", offset: context.areaIndex })}
      data-nqg-drop-item=""
    >
      {context.toggle}
      <span
        className="min-w-0 truncate"
        title={`Drag ${source.label} to the field list or another column level`}
        {...pivotFieldDragHandleProps({
          source,
          canDrop: (target) => layout.canMoveField({ ...source, to: target.to, index: target.index }),
          onDrop: (target) => layout.moveField({ ...source, to: target.to, index: target.index }),
        })}
      >
        {context.label}
      </span>
    </div>
  );
}
