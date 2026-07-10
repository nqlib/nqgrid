import type { ColumnSchema, ColumnType, SelectOption } from "./contract";
import { isTypeError } from "./contract";

/**
 * View modes are not separate engines — they are layouts over ONE row model.
 *  - table : rows × columns of cells (the default; needs no helper here)
 *  - list  : one primary column, the rest collapsed into a card (a render choice)
 *  - board : rows grouped by a column's compareKey, laid out as columns of cards
 *
 * `board` and grouped-`list` both reduce to "group rows by a column, in compareKey
 * order". That single operation lives here so every view shares it.
 */

export interface RowGroup<TRow> {
  /** The group's compareKey — option order for select, the value otherwise. */
  readonly key: number | string;
  /** Human label for the group header / board column title. */
  readonly label: string;
  /** The option backing this group, when the grouping column is a select. */
  readonly option?: SelectOption;
  /** Original color carried by the option, if any. */
  readonly color?: string;
  readonly rows: TRow[];
}

/** Rows whose grouping cell failed to parse, surfaced separately (never dropped). */
export interface GroupingResult<TRow> {
  readonly groups: RowGroup<TRow>[];
  readonly ungrouped: TRow[];
}

/**
 * Group rows by one column, ordered by `compareKey`. For a `select` column the
 * groups come out in option-`order` (Backlog → In Progress → Done) — the same order
 * the table sorts by and a board lays its columns out in. Empty option groups are
 * included so a board shows a column even with zero cards in it.
 */
export function groupRowsByColumn<TRow>(
  rows: readonly TRow[],
  accessor: (row: TRow) => unknown,
  type: ColumnType<unknown, unknown>,
  schema: ColumnSchema,
): GroupingResult<TRow> {
  const byKey = new Map<number | string, RowGroup<TRow>>();
  const ungrouped: TRow[] = [];

  // Seed select columns with every option so empty board columns still appear.
  if (schema.options) {
    for (const opt of schema.options) {
      byKey.set(opt.order, {
        key: opt.order,
        label: opt.label,
        option: opt,
        color: opt.color,
        rows: [],
      });
    }
  }

  for (const row of rows) {
    const parsed = type.parse(accessor(row), schema);
    if (isTypeError(parsed)) {
      ungrouped.push(row);
      continue;
    }
    const key = type.compareKey(parsed, schema);
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: type.format(parsed, schema), rows: [] };
      byKey.set(key, group);
    }
    group.rows.push(row);
  }

  const groups = [...byKey.values()].sort((a, b) => {
    if (typeof a.key === "number" && typeof b.key === "number") return a.key - b.key;
    return String(a.key).localeCompare(String(b.key));
  });

  return { groups, ungrouped };
}

/** Stable sort of rows by one column on its compareKey (asc/desc). */
export function sortRowsByColumn<TRow>(
  rows: readonly TRow[],
  accessor: (row: TRow) => unknown,
  type: ColumnType<unknown, unknown>,
  schema: ColumnSchema,
  direction: "asc" | "desc" = "asc",
): TRow[] {
  const dir = direction === "desc" ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const pa = type.parse(accessor(a.row), schema);
      const pb = type.parse(accessor(b.row), schema);
      const ea = isTypeError(pa);
      const eb = isTypeError(pb);
      if (ea && eb) return a.index - b.index;
      if (ea) return 1;
      if (eb) return -1;
      const ka = type.compareKey(pa, schema);
      const kb = type.compareKey(pb, schema);
      let cmp: number;
      if (typeof ka === "number" && typeof kb === "number") cmp = ka - kb;
      else cmp = String(ka).localeCompare(String(kb));
      return cmp !== 0 ? cmp * dir : a.index - b.index; // stable on ties
    })
    .map((x) => x.row);
}
