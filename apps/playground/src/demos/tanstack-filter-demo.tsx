import { useState } from "react";
import {
  createColumnHelper,
  flexRender,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { Badge, cn, Input } from "@nqlib/nqui";
import { createGlobalFilterFn, withCoreSortingFaceted } from "@nqlib/nqgrid";
import {
  neutralTanStackRowFillClass,
  playgroundTanStackRowStripeData,
  useNeutralPlaygroundTable,
} from "../lib/playground-neutral-table";
import { SortableColumnHeader } from "../lib/sortable-column-header";
import {
  gridBodyHoverClass,
  gridCellClass,
  gridHeadCellClass,
  gridHeaderClass,
  gridNumericClass,
  gridRowClass,
  gridTableClass,
} from "../lib/grid-styles";
import { EngineScrollTableShell } from "../parity/engine-scroll-table-shell";
import { WIDE_OPS_ROWS, type WideOpsRow } from "../parity/parity-wide-mock-data";

const columnHelper = createColumnHelper<WideOpsRow>();
const columns = [
  columnHelper.accessor("country", { header: "Country", size: 72, filterFn: "includesString" }),
  columnHelper.accessor("city", { header: "City", size: 88 }),
  columnHelper.accessor("units", { header: "Units", size: 72, cell: (i) => <span className={gridNumericClass}>{i.getValue()}</span> }),
  columnHelper.accessor("channel", { header: "Channel", size: 88 }),
  columnHelper.accessor("segment", { header: "Segment", size: 104 }),
  columnHelper.accessor("quota", { header: "Quota", size: 72 }),
  columnHelper.accessor("variance", { header: "Var", size: 64 }),
  columnHelper.accessor("owner", { header: "Owner", size: 80 }),
  columnHelper.accessor("quarter", { header: "Qtr", size: 56 }),
  columnHelper.accessor("status", { header: "Status", size: 96 }),
  columnHelper.accessor("notes", { header: "Notes", size: 160 }),
];

export function TanstackFilterDemo() {
  const { tokens } = useNeutralPlaygroundTable();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<{ id: string; value: unknown }[]>([]);

  const table = useReactTable(
    withCoreSortingFaceted({
      data: WIDE_OPS_ROWS,
      columns,
      state: { sorting, globalFilter, columnFilters },
      onSortingChange: setSorting,
      onGlobalFilterChange: setGlobalFilter,
      onColumnFiltersChange: setColumnFilters,
      globalFilterFn: createGlobalFilterFn<WideOpsRow>([
        "country",
        "city",
        "id",
        "channel",
        "segment",
        "owner",
        "notes",
      ]),
      getRowId: (r) => r.id,
    }),
  );

  const countryFacets = table.getColumn("country")?.getFacetedUniqueValues();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Input
        type="search"
        placeholder="Global filter (country, city, channel, notes…)…"
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="max-w-md shrink-0"
        aria-label="Global filter"
      />
      <div className="flex flex-wrap gap-2 shrink-0">
        {countryFacets &&
          [...countryFacets.keys()].map((country) => (
            <Badge
              key={country}
              variant={
                columnFilters.some((f) => f.id === "country" && f.value === country) ? "default" : "outline"
              }
              className="cursor-pointer"
              onClick={() =>
                setColumnFilters((prev) => {
                  const active = prev.find((f) => f.id === "country" && f.value === country);
                  if (active) return prev.filter((f) => f.id !== "country");
                  return [{ id: "country", value: country }];
                })
              }
            >
              {country} ({countryFacets.get(country)})
            </Badge>
          ))}
      </div>
      <EngineScrollTableShell className="max-h-[min(50dvh,420px)]">
        <table className={gridTableClass} style={{ width: table.getTotalSize() }}>
          <colgroup>
            {table.getVisibleLeafColumns().map((col) => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>
          <thead className={gridHeaderClass}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className={gridHeadCellClass} style={{ width: h.getSize() }}>
                    {h.column.getCanSort() ? (
                      <SortableColumnHeader header={h} />
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className={gridBodyHoverClass}>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(gridRowClass, neutralTanStackRowFillClass(tokens, row.index))}
                {...playgroundTanStackRowStripeData(tokens, row.index)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={gridCellClass}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </EngineScrollTableShell>
    </div>
  );
}
