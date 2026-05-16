import type { Key } from "react";

export interface GroupRow<TRow> {
  readonly id: string;
  readonly type: "group";
  readonly groupKey: unknown;
  readonly depth: number;
  readonly childRows: readonly TRow[];
}

export interface BuildGroupedFlatRowsOptions<TRow, K extends Key = Key> {
  rows: readonly TRow[];
  groupBy: readonly string[];
  rowGrouper: (rows: readonly TRow[], columnKey: string) => Record<string, readonly TRow[]>;
  expandedGroupIds: ReadonlySet<K>;
  rowKeyGetter: (row: TRow) => K;
  /** Build stable group row id from keys (default: join with `::`). */
  groupIdGetter?: (groupKey: string, parentId?: string) => string;
}

/**
 * Flattens hierarchical groups into a row list suitable for TanStack `getExpandedRowModel`
 * when you model each group as a synthetic row with `subRows`.
 *
 * This is a structural helper only — wire `meta.isGroup` / `getRowCanExpand` in your table.
 */
export function buildGroupedFlatRows<TRow, K extends Key = Key>(
  options: BuildGroupedFlatRowsOptions<TRow, K>,
): { flat: ReadonlyArray<TRow | GroupRow<TRow>>; isGroupRow: (row: TRow | GroupRow<TRow>) => row is GroupRow<TRow> } {
  const {
    rows,
    groupBy,
    rowGrouper,
    expandedGroupIds,
    rowKeyGetter: _rowKeyGetter,
    groupIdGetter = defaultGroupIdGetter,
  } = options;
  void _rowKeyGetter;

  function isGroupRow(row: TRow | GroupRow<TRow>): row is GroupRow<TRow> {
    return typeof row === "object" && row !== null && "type" in row && (row as GroupRow<TRow>).type === "group";
  }

  if (groupBy.length === 0) {
    return { flat: rows, isGroupRow };
  }

  const flat: Array<TRow | GroupRow<TRow>> = [];

  const walk = (
    slice: readonly TRow[],
    keys: readonly string[],
    parentId: string | undefined,
    depth: number,
  ): void => {
    if (keys.length === 0) {
      for (const r of slice) flat.push(r);
      return;
    }
    const [key, ...rest] = keys;
    const groups = rowGrouper(slice, key!);
    for (const [gk, childRows] of Object.entries(groups)) {
      const gid = groupIdGetter(gk, parentId);
      const groupRow: GroupRow<TRow> = {
        id: gid,
        type: "group",
        groupKey: gk,
        depth,
        childRows,
      };
      flat.push(groupRow);
      if (expandedGroupIds.has(gid as K)) {
        if (rest.length === 0) {
          for (const r of childRows) flat.push(r);
        } else {
          walk(childRows, rest, gid, depth + 1);
        }
      }
    }
  };

  walk(rows, groupBy, undefined, 0);
  return { flat, isGroupRow };
}

function defaultGroupIdGetter(groupKey: string, parentId?: string): string {
  return parentId ? `${parentId}::${groupKey}` : groupKey;
}
