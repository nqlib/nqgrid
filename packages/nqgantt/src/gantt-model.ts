import type { RichPillVariant, RichSchemaColumnDef, RichStatusMapEntry } from "@nqlib/nqgrid/advanced";
import {
  findTimelineColumn,
  normalizePeopleList,
  readRichAccessor,
  resolveStatusEntry,
  richCompareKey,
  richToInterval,
} from "@nqlib/nqgrid/advanced";

/** Which columns drive the gantt projection. All are looked up in the shared schema. */
export interface GanttRoles {
  /** Column whose `toInterval` positions the bar. Defaults to the schema's timeline/date column. */
  readonly timelineColumnId?: string;
  /** Column whose value labels the bar (typically the task `text` column). */
  readonly labelColumnId?: string;
  /** Column whose `style` colors the bar (typically a `status`/`tag` column). */
  readonly colorColumnId?: string;
  /** Column whose `compareKey` groups bars into swimlanes (e.g. assignee or status). */
  readonly laneColumnId?: string;
}

export interface GanttItem<TData extends object> {
  readonly id: string;
  readonly row: TData;
  readonly start: Date;
  readonly end: Date;
  readonly isMilestone: boolean;
  readonly label: string;
  readonly color?: string;
  readonly laneId: string;
  readonly dependsOn: readonly string[];
}

export interface GanttLane {
  readonly id: string;
  readonly label: string;
  readonly sortKey: number | string;
}

export interface GanttModel<TData extends object> {
  readonly items: readonly GanttItem<TData>[];
  readonly lanes: readonly GanttLane[];
  readonly domain: { readonly start: Date; readonly end: Date } | null;
}

const SINGLE_LANE_ID = "__all__";

/** Hex fallbacks for the chip `variant` presets, used when an option sets no explicit color. */
const VARIANT_HEX: Record<RichPillVariant, string> = {
  default: "#6366f1",
  secondary: "#64748b",
  destructive: "#ef4444",
  outline: "#94a3b8",
};

/** Resolve a bar color from a status/tag column's option, mirroring the table's chip color. */
function colorFromStatusEntry(entry: RichStatusMapEntry): string {
  return entry.backgroundColor ?? entry.color ?? VARIANT_HEX[entry.variant ?? "outline"];
}

function statusMapOf<TData extends object>(def: RichSchemaColumnDef<TData>): {
  map: Readonly<Record<string, RichStatusMapEntry>>;
  fallback?: RichStatusMapEntry;
} | null {
  if ((def.kind === "status" || def.kind === "tag") && "map" in def) {
    return { map: def.map, fallback: def.fallback };
  }
  return null;
}

function laneLabelFor<TData extends object>(def: RichSchemaColumnDef<TData>, raw: unknown): string {
  const status = statusMapOf(def);
  if (status) return resolveStatusEntry(raw, status.map, status.fallback).label;
  if (def.kind === "people") {
    const list = normalizePeopleList(raw);
    return list[0]?.name ?? "—";
  }
  return raw == null || raw === "" ? "—" : String(raw);
}

export interface BuildGanttModelArgs<TData extends object> {
  readonly rows: readonly TData[];
  readonly schema: readonly RichSchemaColumnDef<TData>[];
  readonly roles: GanttRoles;
  readonly getRowId: (row: TData) => string;
  /** Optional per-row dependency edges (predecessor ids). Stored as raw data, routed by the view. */
  readonly getDependencies?: (row: TData) => readonly string[];
}

function findColumn<TData extends object>(
  schema: readonly RichSchemaColumnDef<TData>[],
  id: string | undefined,
): RichSchemaColumnDef<TData> | undefined {
  return id == null ? undefined : schema.find((c) => c.id === id);
}

/**
 * Project schema-typed rows onto the time axis. A row becomes a bar positioned by its
 * timeline column (`toInterval`), colored by its status column (`style`), and lane'd by a
 * grouping column (`compareKey`) — the SAME data the table renders, with zero duplication.
 */
export function buildGanttModel<TData extends object>({
  rows,
  schema,
  roles,
  getRowId,
  getDependencies,
}: BuildGanttModelArgs<TData>): GanttModel<TData> {
  const timelineCol = findColumn(schema, roles.timelineColumnId) ?? findTimelineColumn(schema);
  if (!timelineCol) {
    throw new Error(
      "buildGanttModel: no timeline column found — add a `timeline`/`date` column or set roles.timelineColumnId.",
    );
  }
  const labelCol = findColumn(schema, roles.labelColumnId);
  const colorCol = findColumn(schema, roles.colorColumnId);
  const laneCol = findColumn(schema, roles.laneColumnId);

  const items: GanttItem<TData>[] = [];
  const laneById = new Map<string, GanttLane>();
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    const interval = richToInterval(timelineCol, readRichAccessor(timelineCol, row));
    if (!interval) continue; // rows without a time interval are simply omitted from the axis

    const id = getRowId(row);
    const label = labelCol ? String(readRichAccessor(labelCol, row) ?? "") : id;

    let color: string | undefined;
    const colorStatus = colorCol ? statusMapOf(colorCol) : null;
    if (colorCol && colorStatus) {
      color = colorFromStatusEntry(
        resolveStatusEntry(readRichAccessor(colorCol, row), colorStatus.map, colorStatus.fallback),
      );
    }

    let laneId = SINGLE_LANE_ID;
    if (laneCol) {
      const laneRaw = readRichAccessor(laneCol, row);
      laneId = laneRaw == null ? "—" : String(laneRaw);
      if (!laneById.has(laneId)) {
        laneById.set(laneId, {
          id: laneId,
          label: laneLabelFor(laneCol, laneRaw),
          sortKey: richCompareKey(laneCol, laneRaw),
        });
      }
    }

    items.push({
      id,
      row,
      start: interval.start,
      end: interval.end,
      isMilestone: interval.start.getTime() === interval.end.getTime(),
      label,
      color,
      laneId,
      dependsOn: getDependencies?.(row) ?? [],
    });

    min = Math.min(min, interval.start.getTime());
    max = Math.max(max, interval.end.getTime());
  }

  const lanes: GanttLane[] = laneCol
    ? [...laneById.values()].sort((a, b) =>
        a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : a.label.localeCompare(b.label),
      )
    : [{ id: SINGLE_LANE_ID, label: "", sortKey: 0 }];

  return {
    items,
    lanes,
    domain: items.length > 0 ? { start: new Date(min), end: new Date(max) } : null,
  };
}
