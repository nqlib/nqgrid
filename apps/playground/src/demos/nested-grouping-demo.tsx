import { useMemo, useState } from "react";
import { Button, cn } from "@nqlib/nqui";
import {
  buildGroupedFlatRows,
  getOutlineRowIndentStyle,
  type GroupRow,
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

export type DealRow = {
  id: string;
  region: string;
  stage: string;
  owner: string;
  amount: number;
};

export const DEALS: DealRow[] = [
  { id: "d1", region: "East", stage: "Won", owner: "Ana", amount: 12000 },
  { id: "d2", region: "East", stage: "Won", owner: "Ben", amount: 8000 },
  { id: "d3", region: "East", stage: "Open", owner: "Ana", amount: 5000 },
  { id: "d4", region: "East", stage: "Open", owner: "Cara", amount: 9000 },
  { id: "d5", region: "West", stage: "Won", owner: "Dan", amount: 15000 },
  { id: "d6", region: "West", stage: "Open", owner: "Dan", amount: 4000 },
  { id: "d7", region: "West", stage: "Open", owner: "Eli", amount: 6000 },
  { id: "d8", region: "West", stage: "Lost", owner: "Eli", amount: 3000 },
  { id: "d9", region: "North", stage: "Won", owner: "Fay", amount: 11000 },
  { id: "d10", region: "North", stage: "Open", owner: "Fay", amount: 7000 },
];

const GROUP_BY = ["region", "stage"] as const;

function rowGrouper(
  rows: readonly DealRow[],
  columnKey: string,
): Record<string, readonly DealRow[]> {
  const buckets: Record<string, DealRow[]> = {};
  for (const row of rows) {
    const key = String(row[columnKey as keyof DealRow]);
    (buckets[key] ??= []).push(row);
  }
  return buckets;
}

/** Pure: build the flat (group + leaf) list for the given expanded-group set. */
export function buildDealsFlat(
  expanded: Set<string>,
): ReadonlyArray<DealRow | GroupRow<DealRow>> {
  return buildGroupedFlatRows<DealRow>({
    rows: DEALS,
    groupBy: [...GROUP_BY],
    rowGrouper,
    expandedGroupIds: expanded,
    rowKeyGetter: (row) => row.id,
  }).flat;
}

/** Collect every group id by walking the tree fully expanded. */
function collectAllGroupIds(): Set<string> {
  const ids = new Set<string>();
  const walk = (rows: readonly DealRow[], keys: readonly string[], parentId?: string) => {
    if (keys.length === 0) return;
    const [key, ...rest] = keys;
    const groups = rowGrouper(rows, key);
    for (const [gk, childRows] of Object.entries(groups)) {
      const gid = parentId ? `${parentId}::${gk}` : gk;
      ids.add(gid);
      walk(childRows, rest, gid);
    }
  };
  walk(DEALS, GROUP_BY);
  return ids;
}

const isGroup = (row: DealRow | GroupRow<DealRow>): row is GroupRow<DealRow> =>
  typeof row === "object" && row !== null && "type" in row && row.type === "group";

const numberFormat = new Intl.NumberFormat("en-US");

export function NestedGroupingDemo() {
  const [expanded, setExpanded] = useState<Set<string>>(() => collectAllGroupIds());

  const flat = useMemo(() => buildDealsFlat(expanded), [expanded]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Multi-level grouping from buildGroupedFlatRows: region then stage,
        flattened to render-ready rows. Expansion is a plain set of group ids you
        own in state.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setExpanded(collectAllGroupIds())}>
          Expand all
        </Button>
        <Button size="sm" variant="outline" onClick={() => setExpanded(new Set())}>
          Collapse all
        </Button>
      </div>
      <EngineScrollTableShell className="max-h-[min(50dvh,420px)]">
        <table className={gridTableClass}>
          <thead className={gridHeaderClass}>
            <tr>
              <th className={gridHeadCellClass}>Region / stage / owner</th>
              <th className={cn(gridHeadCellClass, gridNumericClass)}>Amount</th>
            </tr>
          </thead>
          <tbody className={gridBodyHoverClass}>
            {flat.map((row) => {
              if (isGroup(row)) {
                const open = expanded.has(row.id);
                const total = row.childRows.reduce((sum, r) => sum + r.amount, 0);
                return (
                  <tr key={row.id} className={cn(gridRowClass, "font-medium")}>
                    <td className={gridCellClass} style={getOutlineRowIndentStyle(row.depth)}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => toggle(row.id)}
                      >
                        {open ? "▾" : "▸"} {String(row.groupKey)} ({row.childRows.length})
                      </Button>
                    </td>
                    <td className={cn(gridCellClass, gridNumericClass)}>
                      {numberFormat.format(total)}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={row.id} className={gridRowClass}>
                  <td className={gridCellClass} style={getOutlineRowIndentStyle(GROUP_BY.length)}>
                    {row.owner}
                  </td>
                  <td className={cn(gridCellClass, gridNumericClass)}>
                    {numberFormat.format(row.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </EngineScrollTableShell>
    </div>
  );
}
