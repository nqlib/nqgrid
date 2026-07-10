import { useMemo, useState } from "react";
import { Button, cn } from "@nqlib/nqui";
import {
  computePivot,
  getOutlineRowIndentStyle,
  type PivotConfig,
  type PivotResult,
} from "@nqlib/nqgrid";
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

export type SalesRow = {
  region: string;
  category: string;
  quarter: string;
  revenue: number;
  units: number;
};

export const SALES: SalesRow[] = [
  { region: "East", category: "Hardware", quarter: "Q1", revenue: 100, units: 10 },
  { region: "East", category: "Hardware", quarter: "Q2", revenue: 120, units: 12 },
  { region: "East", category: "Software", quarter: "Q1", revenue: 200, units: 4 },
  { region: "East", category: "Software", quarter: "Q2", revenue: 220, units: 5 },
  { region: "East", category: "Services", quarter: "Q1", revenue: 60, units: 2 },
  { region: "East", category: "Services", quarter: "Q2", revenue: 80, units: 3 },
  { region: "West", category: "Hardware", quarter: "Q1", revenue: 90, units: 9 },
  { region: "West", category: "Hardware", quarter: "Q2", revenue: 110, units: 11 },
  { region: "West", category: "Software", quarter: "Q1", revenue: 300, units: 6 },
  { region: "West", category: "Software", quarter: "Q2", revenue: 260, units: 7 },
  { region: "West", category: "Services", quarter: "Q1", revenue: 40, units: 1 },
  { region: "West", category: "Services", quarter: "Q2", revenue: 70, units: 4 },
  { region: "North", category: "Hardware", quarter: "Q1", revenue: 50, units: 5 },
  { region: "North", category: "Software", quarter: "Q2", revenue: 180, units: 8 },
];

const ROW_FIELDS: PivotConfig<SalesRow>["rows"] = [
  { key: "region", get: (r) => r.region, label: "Region" },
  { key: "category", get: (r) => r.category, label: "Category" },
];

const MEASURES: PivotConfig<SalesRow>["measures"] = [
  { key: "revenue", get: (r) => r.revenue, agg: "sum", label: "Revenue" },
  { key: "units", get: (r) => r.units, agg: "sum", label: "Units" },
];

/** Default pivot: region × category rows, quarter columns, revenue + units summed. */
export function buildSalesPivot(): PivotResult {
  return computePivot(SALES, {
    rows: ROW_FIELDS,
    columns: [{ key: "quarter", get: (r) => r.quarter, label: "Quarter" }],
    measures: MEASURES,
  });
}

/** Flat variant: no column dimension — one column group per measure. */
export function buildSalesPivotFlat(): PivotResult {
  return computePivot(SALES, {
    rows: ROW_FIELDS,
    columns: [],
    measures: MEASURES,
  });
}

const numberFormat = new Intl.NumberFormat("en-US");

function formatCell(value: number | null): string {
  return value == null ? "—" : numberFormat.format(value);
}

const ROW_DIMENSION_HEADERS = ["Region", "Category"] as const;

export function PivotDemo() {
  const [pivotColumns, setPivotColumns] = useState(true);

  const result = useMemo(
    () => (pivotColumns ? buildSalesPivot() : buildSalesPivotFlat()),
    [pivotColumns],
  );

  const leadingSpan = ROW_DIMENSION_HEADERS.length;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Headless cross-tab from computePivot: region and category nest down the
        rows, quarter spreads across the columns, with subtotal and grand-total
        rows aggregated from the source rows.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={pivotColumns ? "default" : "outline"}
          onClick={() => setPivotColumns((prev) => !prev)}
        >
          {pivotColumns ? "Quarter columns" : "Flat columns"}
        </Button>
      </div>
      <EngineScrollTableShell className="max-h-[min(50dvh,420px)]">
        <table className={gridTableClass}>
          <thead className={gridHeaderClass}>
            {result.columnHeaderRows.map((headerRow, rowIndex) => (
              <tr key={rowIndex}>
                {rowIndex === 0
                  ? ROW_DIMENSION_HEADERS.map((label) => (
                      <th
                        key={label}
                        className={gridHeadCellClass}
                        rowSpan={result.columnHeaderRows.length}
                      >
                        {label}
                      </th>
                    ))
                  : null}
                {headerRow.map((cell) => (
                  <th
                    key={cell.key}
                    className={cn(gridHeadCellClass, cell.isLeaf && gridNumericClass)}
                    colSpan={cell.span}
                  >
                    {cell.label}
                  </th>
                ))}
              </tr>
            ))}
            {result.columnHeaderRows.length === 0 ? (
              <tr>
                {ROW_DIMENSION_HEADERS.map((label) => (
                  <th key={label} className={gridHeadCellClass}>
                    {label}
                  </th>
                ))}
                {result.columnLeaves.map((leaf) => (
                  <th key={leaf.key} className={cn(gridHeadCellClass, gridNumericClass)}>
                    {leaf.label}
                  </th>
                ))}
              </tr>
            ) : null}
          </thead>
          <tbody className={gridBodyHoverClass}>
            {result.rows.map((row) => {
              const isSubtotal = row.kind === "subtotal";
              const isGrand = row.kind === "grandTotal";
              return (
                <tr
                  key={row.key}
                  className={cn(
                    gridRowClass,
                    isSubtotal && "font-medium",
                    isGrand && "font-semibold border-t",
                  )}
                >
                  {ROW_DIMENSION_HEADERS.map((_, dimIndex) => {
                    const value = row.path[dimIndex];
                    if (isGrand && dimIndex === 0) {
                      return (
                        <td
                          key={dimIndex}
                          className={gridCellClass}
                          colSpan={leadingSpan}
                        >
                          {row.label}
                        </td>
                      );
                    }
                    if (isGrand) return null;
                    return (
                      <td
                        key={dimIndex}
                        className={gridCellClass}
                        style={dimIndex > 0 ? getOutlineRowIndentStyle(dimIndex) : undefined}
                      >
                        {isSubtotal && dimIndex === row.path.length - 1
                          ? row.label
                          : value ?? ""}
                      </td>
                    );
                  })}
                  {result.columnLeaves.map((leaf) => (
                    <td key={leaf.key} className={cn(gridCellClass, gridNumericClass)}>
                      {formatCell(row.cells[leaf.key] ?? null)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </EngineScrollTableShell>
    </div>
  );
}
