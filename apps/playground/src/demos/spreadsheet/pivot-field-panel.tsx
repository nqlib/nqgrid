import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@nqlib/nqui";
import {
  ORDER_DIMENSIONS,
  ORDER_MEASURES,
  SALES_ORDERS,
  type OrderRow,
} from "./mock-data";

export type FieldKey = string;

export type ZoneId = "pool" | "filters" | "rows" | "columns" | "values";

/** Which zone holds which fields. `pool` is implicit (everything not assigned). */
export interface PivotZones {
  filters: FieldKey[];
  rows: FieldKey[];
  columns: FieldKey[];
  values: FieldKey[];
}

/** Selected filter values per filter field; missing/`"All"` = no filter. */
export type FilterSelections = Record<FieldKey, string>;

const DIMENSION_KEYS = new Set(ORDER_DIMENSIONS.map((d) => d.key as string));
const MEASURE_KEYS = new Set(ORDER_MEASURES.map((m) => m.key as string));

export function isDimension(key: FieldKey): boolean {
  return DIMENSION_KEYS.has(key);
}
export function isMeasure(key: FieldKey): boolean {
  return MEASURE_KEYS.has(key);
}

export function fieldLabel(key: FieldKey): string {
  return (
    ORDER_DIMENSIONS.find((d) => d.key === key)?.label ??
    ORDER_MEASURES.find((m) => m.key === key)?.label ??
    key
  );
}

/** Distinct values of a dimension across the raw data, stably ordered. */
export function distinctValues(key: FieldKey): string[] {
  const seen = new Set<string>();
  for (const row of SALES_ORDERS) {
    seen.add(String(row[key as keyof OrderRow]));
  }
  return Array.from(seen).sort();
}

const ZONE_META: Array<{ id: Exclude<ZoneId, "pool">; label: string }> = [
  { id: "filters", label: "Filters" },
  { id: "rows", label: "Rows" },
  { id: "columns", label: "Columns" },
  { id: "values", label: "Values" },
];

function Chip({
  fieldKey,
  onRemove,
  filterValue,
  onFilterChange,
}: {
  fieldKey: FieldKey;
  onRemove?: () => void;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: fieldKey,
  });
  const label = fieldLabel(fieldKey);
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs",
        "shadow-sm",
        isDragging && "opacity-50",
      )}
    >
      <button
        ref={setNodeRef}
        type="button"
        aria-label={`Drag ${label}`}
        className="flex cursor-grab items-center gap-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        {...listeners}
        {...attributes}
      >
        <span aria-hidden className="text-muted-foreground">
          ⠿
        </span>
        <span className="font-medium">{label}</span>
      </button>
      {onFilterChange ? (
        <Select value={filterValue ?? "All"} onValueChange={onFilterChange}>
          <SelectTrigger
            size="sm"
            className="h-5 w-20 rounded-full border-0 bg-muted px-2 text-[11px]"
            aria-label={`Filter ${label}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            {distinctValues(fieldKey).map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

/** A faded placeholder shown in the destination zone (and the cursor overlay). */
function GhostChip({
  label,
  floating,
  rejected,
}: {
  label: string;
  floating?: boolean;
  rejected?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
        rejected
          ? floating
            ? "border border-destructive bg-background text-destructive shadow-md"
            : "border border-dashed border-destructive bg-destructive/10 text-destructive"
          : floating
            ? "border border-primary bg-background shadow-md"
            : "border border-dashed border-primary bg-primary/10 text-primary",
      )}
    >
      {rejected ? (
        <span
          aria-hidden
          className="flex size-4 shrink-0 items-center justify-center rounded-full bg-destructive text-[10px] font-bold leading-none text-destructive-foreground"
        >
          ✕
        </span>
      ) : (
        <span aria-hidden className="opacity-70">
          ⠿
        </span>
      )}
      <span className={cn("font-medium", rejected && "opacity-80")}>{label}</span>
    </div>
  );
}

function Zone({
  id,
  label,
  children,
  isEmpty,
  activeKey,
  accepts,
  containsActive,
}: {
  id: ZoneId;
  label: string;
  children: React.ReactNode;
  isEmpty: boolean;
  /** Field currently being dragged (null when idle). */
  activeKey: FieldKey | null;
  accepts: (zone: ZoneId, key: FieldKey) => boolean;
  /** Whether the dragged field already lives in this zone. */
  containsActive: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const wouldAccept = activeKey != null && accepts(id, activeKey);
  const showGhost = isOver && activeKey != null && !containsActive && wouldAccept;
  const showRejectGhost = isOver && activeKey != null && !containsActive && !wouldAccept;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1 rounded-md bg-muted/40 p-1.5 transition-colors",
          showGhost && "bg-primary/5 ring-2 ring-primary",
          showRejectGhost && "bg-destructive/5 ring-2 ring-destructive/60",
        )}
      >
        {isEmpty && !showGhost && !showRejectGhost ? (
          <span className="px-1 text-xs text-muted-foreground">Drag fields here</span>
        ) : (
          children
        )}
        {showGhost ? <GhostChip label={fieldLabel(activeKey)} /> : null}
        {showRejectGhost ? (
          <GhostChip label={fieldLabel(activeKey)} rejected />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Excel-style field list. Top: unassigned field pool. Below: four drop zones.
 * Drag-drop moves fields between pool and zones; onChange reports the new layout.
 */
export function PivotFieldPanel({
  zones,
  onChange,
  filterSelections,
  onFilterSelectionsChange,
}: {
  zones: PivotZones;
  onChange: (next: PivotZones) => void;
  filterSelections: FilterSelections;
  onFilterSelectionsChange: (next: FilterSelections) => void;
}) {
  const assigned = useMemo(() => {
    const set = new Set<FieldKey>([
      ...zones.filters,
      ...zones.rows,
      ...zones.columns,
      ...zones.values,
    ]);
    return set;
  }, [zones]);

  const poolFields = useMemo(() => {
    const all = [
      ...ORDER_DIMENSIONS.map((d) => d.key as string),
      ...ORDER_MEASURES.map((m) => m.key as string),
    ];
    return all.filter((k) => !assigned.has(k));
  }, [assigned]);

  const [activeKey, setActiveKey] = useState<FieldKey | null>(null);
  const [overZoneId, setOverZoneId] = useState<ZoneId | null>(null);

  function zoneOf(key: FieldKey): ZoneId {
    if (zones.filters.includes(key)) return "filters";
    if (zones.rows.includes(key)) return "rows";
    if (zones.columns.includes(key)) return "columns";
    if (zones.values.includes(key)) return "values";
    return "pool";
  }

  function accepts(target: ZoneId, key: FieldKey): boolean {
    if (target === "pool") return true;
    if (target === "values") return isMeasure(key);
    // filters / rows / columns accept dimensions only
    return isDimension(key);
  }

  function moveField(key: FieldKey, target: ZoneId) {
    if (zoneOf(key) === target) return;
    if (!accepts(target, key)) return;
    const next: PivotZones = {
      filters: zones.filters.filter((k) => k !== key),
      rows: zones.rows.filter((k) => k !== key),
      columns: zones.columns.filter((k) => k !== key),
      values: zones.values.filter((k) => k !== key),
    };
    if (target !== "pool") next[target] = [...next[target], key];
    onChange(next);
    if (target !== "filters" && filterSelections[key] != null) {
      const { [key]: _drop, ...rest } = filterSelections;
      onFilterSelectionsChange(rest);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveKey(null);
    setOverZoneId(null);
    const key = String(event.active.id) as FieldKey;
    const over = event.over?.id;
    if (over == null) return;
    moveField(key, over as ZoneId);
  }

  const overlayRejected =
    activeKey != null &&
    overZoneId != null &&
    overZoneId !== "pool" &&
    zoneOf(activeKey) !== overZoneId &&
    !accepts(overZoneId, activeKey);

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={(event: DragStartEvent) =>
        setActiveKey(String(event.active.id) as FieldKey)
      }
      onDragOver={(event) => {
        setOverZoneId(
          event.over?.id != null ? (String(event.over.id) as ZoneId) : null,
        );
      }}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveKey(null);
        setOverZoneId(null);
      }}
    >
      <div className="flex w-full flex-col gap-3 overflow-y-auto">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Fields
          </span>
          <ZonePool
            id="pool"
            activeKey={activeKey}
            containsActive={activeKey != null && zoneOf(activeKey) === "pool"}
          >
            {poolFields.length === 0 ? (
              <span className="px-1 text-xs text-muted-foreground">
                All fields placed
              </span>
            ) : (
              poolFields.map((key) => <Chip key={key} fieldKey={key} />)
            )}
          </ZonePool>
        </div>

        {ZONE_META.map((z) => {
          const fields = zones[z.id];
          return (
            <Zone
              key={z.id}
              id={z.id}
              label={z.label}
              isEmpty={fields.length === 0}
              activeKey={activeKey}
              accepts={accepts}
              containsActive={activeKey != null && zoneOf(activeKey) === z.id}
            >
              {fields.map((key) => (
                <Chip
                  key={key}
                  fieldKey={key}
                  onRemove={() => moveField(key, "pool")}
                  {...(z.id === "filters"
                    ? {
                        filterValue: filterSelections[key] ?? "All",
                        onFilterChange: (value: string) =>
                          onFilterSelectionsChange({
                            ...filterSelections,
                            [key]: value,
                          }),
                      }
                    : {})}
                />
              ))}
            </Zone>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeKey ? (
          <GhostChip
            label={fieldLabel(activeKey)}
            floating
            rejected={overlayRejected}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function ZonePool({
  id,
  children,
  activeKey,
  containsActive,
}: {
  id: ZoneId;
  children: React.ReactNode;
  activeKey: FieldKey | null;
  /** Whether the dragged field is already in the pool (no remove-ghost then). */
  containsActive: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  // Dropping an assigned field on the pool removes it — preview that here.
  const showGhost = isOver && activeKey != null && !containsActive;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-9 flex-wrap items-center gap-1 rounded-md bg-muted/40 p-1.5 transition-colors",
        showGhost && "bg-primary/5 ring-2 ring-primary",
      )}
    >
      {children}
      {showGhost ? <GhostChip label={fieldLabel(activeKey)} /> : null}
    </div>
  );
}

export const DEFAULT_PIVOT_ZONES: PivotZones = {
  filters: [],
  rows: ["region", "category"],
  columns: ["quarter"],
  values: ["revenue", "margin"],
};
