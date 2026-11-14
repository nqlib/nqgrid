import { useState } from "react";
import { Badge, Button } from "@nqlib/nqui";
import { clearPivotFilters, setPivotTopN } from "@nqlib/nqgrid/core";
import { PivotSlicer, pivotSlicerProps, type PivotGridState } from "@nqlib/nqgrid/pivot";
import { useMediaQuery } from "./use-media-query";

/** Two slicers (outer, inner) plus the active-filter summary and record count. */
export function SlicerBar({ grid, fields }: { grid: PivotGridState; fields: readonly [string, string] }) {
  const [multi, setMulti] = useState<Record<string, boolean>>({});
  const wide = useMediaQuery("(min-width: 768px)");
  const filters = grid.model.filters ?? [];
  const counts = grid.model.recordCount;
  const slicer = (field: string, columns: number, className: string, listClassName?: string) => (
    <PivotSlicer
      {...pivotSlicerProps(grid, field)}
      columns={columns}
      multiSelect={multi[field] ?? false}
      onMultiSelectChange={(v) => setMulti((m) => ({ ...m, [field]: v }))}
      className={className}
      classNames={listClassName ? { list: listClassName } : undefined}
    />
  );
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border/70 px-4 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        {slicer(fields[0], 2, "w-full shadow-none md:w-64 md:shrink-0")}
        {slicer(fields[1], wide ? 5 : 2, "min-w-0 flex-1 shadow-none", "max-h-[4.5rem] overflow-y-auto pr-1")}
      </div>
      <div className="flex min-h-7 flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {filters.length ? (
          <>
            <span>Filters</span>
            {filters.map((f, i) => (
              <Badge key={`${f.field}:${i}`} variant="secondary" className="font-normal">
                {f.text}
              </Badge>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => grid.setSpec((s) => clearPivotFilters(s.rows.reduce((acc, d) => setPivotTopN(acc, d.field, null), s)))}
            >
              Clear all
            </Button>
          </>
        ) : (
          <span>Click a slicer value to filter; ⌘/Ctrl-click or the multi-select button picks several.</span>
        )}
        {counts ? (
          <span className="ml-auto tabular-nums">
            {counts.matched.toLocaleString()} of {counts.total.toLocaleString()} records
          </span>
        ) : null}
      </div>
    </div>
  );
}
