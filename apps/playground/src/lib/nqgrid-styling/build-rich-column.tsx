import type { ColumnDef } from "@tanstack/react-table";

import type { RichColumnFactoryConfig } from "@nqlib/nqgrid";
import { normalizeRichSchemaColumnDef } from "@nqlib/nqgrid";
import { RichColumnCell } from "./rich-cells";
import type {
  CustomRichColumn,
  NqgridRichColumnMeta,
  PeopleRichColumn,
  RichColumnKind,
  RichSchemaColumnDef,
  StatusRichColumn,
} from "@nqlib/nqgrid";
import { getByPath, normalizePeopleList, reconcileRichPeopleWithRoster } from "@nqlib/nqgrid";

function metaForKind(kind: RichColumnKind): NqgridRichColumnMeta {
  return { nqgridRich: { kind } };
}

function accessorParts<TData extends object>(def: RichSchemaColumnDef<TData>): {
  accessorKey?: string;
  accessorFn?: (row: TData) => unknown;
} {
  if (def.kind === "formula") {
    return { accessorFn: (row: TData) => def.compute(row) };
  }
  if ("accessorPath" in def && def.accessorPath) {
    const path = def.accessorPath;
    return { accessorFn: (row: TData) => getByPath(row, path) };
  }
  if ("accessorKey" in def && def.accessorKey) {
    return { accessorKey: def.accessorKey as string };
  }
  return {};
}

/**
 * Build a TanStack `ColumnDef` from a discriminated rich schema column (formatting + cell chrome).
 */
export function buildRichColumnFromDef<TData extends object>(
  def: RichSchemaColumnDef<TData>,
  config: RichColumnFactoryConfig = {},
): ColumnDef<TData, unknown> {
  const normalized = normalizeRichSchemaColumnDef(def);
  const defaultLocale = config.defaultLocale ?? config.locale;
  const header = normalized.header ?? normalized.name;
  const sorting = normalized.enableSorting !== false;

  if (normalized.kind === "custom") {
    const d = normalized as CustomRichColumn<TData>;
    const acc = accessorParts(d);
    return {
      id: d.id,
      ...acc,
      header,
      size: d.width,
      enableSorting: sorting,
      meta: metaForKind("custom"),
      cell: d.cell,
    } as ColumnDef<TData, unknown>;
  }

  const acc = accessorParts(normalized);

  return {
    id: normalized.id,
    ...acc,
    header,
    size: normalized.width,
    enableSorting: sorting,
    meta: metaForKind(normalized.kind),
    cell: (info) => {
      const row = info.row.original;

      if (normalized.kind === "people") {
        const pCol = normalized as PeopleRichColumn<TData>;
        const canPick =
          pCol.editable === true &&
          pCol.pickerOptions != null &&
          pCol.pickerOptions.length > 0 &&
          pCol.onValueChange != null &&
          config.renderPeoplePicker != null;
        if (canPick) {
          return config.renderPeoplePicker({
            row,
            value: normalizePeopleList(info.getValue()),
            options: pCol.pickerOptions,
            max: pCol.max ?? 6,
            empty: pCol.empty,
            avatarSizePx: pCol.avatarSizePx ?? 28,
            onChange: (next) => {
              const roster = pCol.pickerOptions ?? [];
              const value =
                roster.length > 0 ? reconcileRichPeopleWithRoster(next, roster) : [...next];
              pCol.onValueChange!({ row, value });
            },
          });
        }
      }

      const statusDef = normalized.kind === "status" ? (normalized as StatusRichColumn<TData>) : null;
      return (
        <RichColumnCell
          def={normalized as RichSchemaColumnDef<object>}
          raw={info.getValue()}
          defaultLocale={defaultLocale}
          row={row}
          onStatusValueChange={
            statusDef?.editable && statusDef.onValueChange
              ? (value) =>
                  statusDef.onValueChange!({
                    row,
                    value,
                    previousValue: String(info.getValue() ?? ""),
                  })
              : undefined
          }
        />
      );
    },
  } as ColumnDef<TData, unknown>;
}

export function buildRichColumnsFromDefs<TData extends object>(
  defs: readonly RichSchemaColumnDef<TData>[],
  config?: RichColumnFactoryConfig,
): ColumnDef<TData, unknown>[] {
  return defs.map((d) => buildRichColumnFromDef(d, config));
}
