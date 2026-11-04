import { useMemo } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { cn } from "@nqlib/nqui";
import type { TableClassBundle, TableColorTokens } from "../lib/nqgrid-styling";
import { buildRowFillClass } from "../lib/nqgrid-styling";
import { createSelectColumn, getSelectColumnMode, selectColumnRowHeaderProps, selectColumnTdClass } from "../lib/playground-canonical-select-column";
import { CanonicalSelectHeaderCell } from "../lib/playground-canonical-header-cell";
import {
  gridBodyHoverClass,
  gridCellClass,
  gridHeadCellClass,
  gridHeaderClass,
  gridNumericClass,
  gridRowClass,
  gridTableClass,
} from "../lib/grid-styles";
import {
  pinPlaygroundCell,
  ROW_INDEX_GUTTER_ID,
  usePlaygroundPinnedLayout,
} from "../lib/playground-row-index-gutter";
import { playgroundTanStackRowStripeData } from "../lib/playground-neutral-table";
import { resolvePlaygroundVirtualDataRowFillTokens } from "../lib/playground-table-tokens";
import { usePlaygroundTableSettings } from "../playground-table-settings";
import { EngineScrollTableShell, useEngineScrollViewport } from "../parity/engine-scroll-table-shell";
import { highlightRing, type TokenSpec } from "./token-legend";
import { RegionLabel } from "./region-label";

const SELECT_MODE = "index" as const;

type SpecimenRow = { id: string; index: number; name: string; dept: string; status: string; score: number };

const ROWS: SpecimenRow[] = [
  { id: "0", index: 0, name: "User 1", dept: "Engineering", status: "Active", score: 87 },
  { id: "1", index: 1, name: "User 2", dept: "Design", status: "Idle", score: 62 },
  { id: "2", index: 2, name: "User 3", dept: "Product", status: "Away", score: 91 },
  { id: "3", index: 3, name: "User 4", dept: "Sales", status: "Active", score: 74 },
  { id: "4", index: 4, name: "User 5", dept: "Support", status: "Offline", score: 55 },
];

const columnHelper = createColumnHelper<SpecimenRow>();

export function virtualDataTokenSpecs(
  gridTokens: TableColorTokens,
  rowFillTokens: TableColorTokens,
  bundle: TableClassBundle,
): TokenSpec[] {
  return [
    {
      id: "shell",
      path: "shell.bg",
      label: "Scroll shell",
      classes: [gridTokens.shell.bg, gridTokens.shell.border].filter(Boolean).join(" · "),
      hint: "EngineScrollTableShell — same Card + ScrollArea as virtual-data-demo",
    },
    {
      id: "header",
      path: "header.row",
      label: "Sticky header",
      classes: bundle.header,
    },
    {
      id: "headCell",
      path: "header.cell → gridHeadCell",
      label: "Data header cell",
      classes: bundle.gridHeadCell,
    },
    {
      id: "rowHeaderHead",
      path: "rowHeader.headFill",
      label: "Row-index gutter header (#)",
      classes: bundle.gridRowHeaderHeadCell,
      hint: "Excel-style corner — unpinned translucent fill",
    },
    {
      id: "rowHeaderPinnedHead",
      path: "rowHeader.pinnedHeadFill",
      label: "Pinned gutter header",
      classes: bundle.gridRowHeaderPinnedHeadFill,
      hint: "Opaque when sticky — scroll horizontally to verify",
    },
    {
      id: "rowHeaderCell",
      path: "rowHeader.bodyFill",
      label: "Row-index gutter body",
      classes: bundle.gridRowHeaderCell,
    },
    {
      id: "rowHeaderPinnedBody",
      path: "body.rowStripeEvenPinnedTr (striped) · rowHeader.pinnedBodyFill (none)",
      label: "Pinned gutter body",
      classes: [rowFillTokens.body.rowStripeEvenPinnedTr, gridTokens.rowHeader.pinnedBodyFill]
        .filter(Boolean)
        .join(" · "),
      hint: "Per-row via buildPinnedBodyCellFill — matches stripe/solid rows when pinned",
    },
    {
      id: "bodyFill",
      path: `body.fillMode = ${rowFillTokens.body.fillMode} (card preset)`,
      label: "Row stripe / solid",
      classes:
        rowFillTokens.body.fillMode === "striped"
          ? [rowFillTokens.body.rowStripeOddTr, rowFillTokens.body.rowStripeEvenTr].join(" · ")
          : rowFillTokens.body.rowSolidTr,
      hint: "neutralTanStackRowFillClass — toggled via playground row fill",
    },
    {
      id: "bodyHover",
      path: "body.rowHover",
      label: "Row hover (data cells)",
      classes: gridTokens.body.rowHover,
      hint: "Skips [data-row-header] gutter cells",
    },
    {
      id: "rowSelected",
      path: "body.rowSelected",
      label: "Row selected",
      classes: gridTokens.body.rowSelected,
      hint: "Row 3 uses data-state=selected",
    },
    {
      id: "gridCell",
      path: "cell.default → gridCell",
      label: "Data body cell",
      classes: bundle.gridCell,
    },
    {
      id: "cellRange",
      path: "cell.rangeFill / rangeActive",
      label: "Range selection",
      classes: [gridTokens.cell.rangeFill, gridTokens.cell.rangeActive].join(" · "),
      hint: "grid-keyboard-demo spreadsheet select",
    },
  ];
}

export function VirtualDataTokenSpecimen({
  activeId,
  onHover,
}: {
  activeId: string | null;
  onHover: (id: string | null) => void;
}) {
  const { libraryConfig } = usePlaygroundTableSettings();
  const rowFillTokens = useMemo(
    () => resolvePlaygroundVirtualDataRowFillTokens(libraryConfig),
    [libraryConfig],
  );
  const { viewportRef, scrolledX } = useEngineScrollViewport(true);

  const columns = useMemo(
    () => [
      createSelectColumn(columnHelper, { mode: SELECT_MODE }),
      columnHelper.accessor("name", { header: "Name", size: 140 }),
      columnHelper.accessor("dept", { header: "Department", size: 120 }),
      columnHelper.accessor("status", { header: "Status", size: 80 }),
      columnHelper.accessor("score", {
        header: () => <span className="w-full text-right">Score</span>,
        cell: (info) => <span className={gridNumericClass}>{info.getValue()}</span>,
        size: 64,
      }),
      columnHelper.display({ id: "region", header: "Region", size: 72, cell: () => "NA" }),
      columnHelper.display({ id: "role", header: "Role", size: 96, cell: () => "IC" }),
      columnHelper.display({ id: "email", header: "Email", size: 180, cell: ({ row }) => `user${row.original.index + 1}@example.com` }),
    ],
    [],
  );

  const table = useReactTable({
    data: ROWS,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  const tableTotalWidth = table.getTotalSize();
  const pinnedLayout = usePlaygroundPinnedLayout({ table, selectColumnMode: SELECT_MODE });

  return (
    <div
      className={cn("relative max-w-3xl", highlightRing(activeId === "shell"))}
      onMouseEnter={() => onHover("shell")}
      onMouseLeave={() => onHover(null)}
    >
      <RegionLabel className="left-3 top-3">virtual-data SSOT</RegionLabel>
      <EngineScrollTableShell viewportRef={viewportRef} className="max-h-[min(40dvh,320px)]">
        <table className={gridTableClass} style={{ width: tableTotalWidth }}>
          <colgroup>
            {table.getVisibleLeafColumns().map((col) => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>
          <thead
            className={cn("relative", gridHeaderClass, highlightRing(activeId === "header"))}
            onMouseEnter={() => onHover("header")}
            onMouseLeave={() => onHover(null)}
          >
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  if (h.column.id === ROW_INDEX_GUTTER_ID) {
                    const pin = pinPlaygroundCell({
                      pinnedLayout,
                      columnId: h.column.id,
                      variant: "head",
                      scrolledX,
                      rowIndexGutter: true,
                    });
                    return (
                      <CanonicalSelectHeaderCell
                        key={h.id}
                        header={h}
                        headClassName={gridHeadCellClass}
                        style={pin.style}
                        className={cn(
                          pin.className,
                          highlightRing(activeId === "rowHeaderHead" || activeId === "rowHeaderPinnedHead"),
                        )}
                      />
                    );
                  }
                  return (
                    <th
                      key={h.id}
                      className={cn(gridHeadCellClass, highlightRing(activeId === "headCell"))}
                      onMouseEnter={() => onHover("headCell")}
                      onMouseLeave={() => onHover(null)}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody
            className={cn(
              gridBodyHoverClass,
              highlightRing(activeId === "bodyHover" || activeId === "rowSelected" || activeId === "bodyFill"),
            )}
            onMouseEnter={() => onHover("bodyHover")}
            onMouseLeave={() => onHover(null)}
          >
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                data-state={row.original.index === 2 ? "selected" : undefined}
                className={cn(gridRowClass, buildRowFillClass(rowFillTokens, row.original.index))}
                {...playgroundTanStackRowStripeData(rowFillTokens, row.original.index)}
              >
                {row.getVisibleCells().map((cell) => {
                  const isGutter = cell.column.id === ROW_INDEX_GUTTER_ID;
                  const mode = isGutter ? getSelectColumnMode(cell.column) : undefined;
                  const pin = pinPlaygroundCell({
                    pinnedLayout,
                    columnId: cell.column.id,
                    variant: "body",
                    scrolledX,
                    rowIndexGutter: isGutter,
                    rowFillTokens: rowFillTokens,
                    rowIndex: row.original.index,
                  });
                  return (
                    <td
                      key={cell.id}
                      {...(isGutter ? selectColumnRowHeaderProps(mode) : {})}
                      className={cn(
                        isGutter
                          ? selectColumnTdClass(mode, gridCellClass, { pinned: !!pin.style })
                          : cn(gridCellClass, highlightRing(activeId === "gridCell")),
                        pin.className,
                        isGutter &&
                          highlightRing(activeId === "rowHeaderCell" || activeId === "rowHeaderPinnedBody"),
                      )}
                      style={pin.style}
                      onMouseEnter={() =>
                        isGutter
                          ? onHover(scrolledX ? "rowHeaderPinnedBody" : "rowHeaderCell")
                          : onHover("gridCell")
                      }
                      onMouseLeave={() => onHover(null)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </EngineScrollTableShell>
    </div>
  );
}
