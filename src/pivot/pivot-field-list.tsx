import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import {
  canMovePivotField,
  ensurePivotFilterField,
  PIVOT_FIELD_AREAS,
  pivotDateGroupField,
  pivotDateGroupingOf,
  pivotFieldListState,
  planPivotFieldMove,
  resolvePivotFields,
  setPivotDateGrouping,
  setPivotMeasureAggregate,
  swapPivotRowsColumns,
  togglePivotField,
  type PivotFieldListField,
  type PivotFieldListItem,
  type PivotFieldListMeasure,
  type PivotFieldListState,
  type PivotFieldLocation,
  type PivotFieldMove,
  type PivotFieldMovePlan,
  type PivotFieldMoveRefusal,
} from "../core/pivot/fields";
import { clearPivotFilter, setPivotFilterValues, setPivotSort, setPivotTopN } from "../core/pivot/interaction";
import { pivotColumnFields } from "../core/pivot/columns";
import { removePivotMeasure, setPivotSubtotal } from "../core/pivot/measures";
import { PIVOT_DATE_GROUPS } from "../core/pivot/dates";
import type { PivotBuiltInAggregate, PivotDateGroup, PivotFacet, PivotFieldArea, PivotFieldSpec, PivotFieldType, PivotModel, PivotSpec } from "../core/pivot/types";
import {
  pivotFieldChipClass,
  pivotFieldChipLabelClass,
  pivotFieldChipValuesClass,
  pivotFieldListAreaClass,
  pivotFieldListAreasClass,
  pivotFieldListAreaTitleClass,
  pivotFieldListCatalogClass,
  pivotFieldListClass,
  pivotFieldListEmptyClass,
  pivotFieldListFieldClass,
  pivotFieldListFieldTypeClass,
  pivotFieldListFooterClass,
  pivotFieldListHeaderClass,
  pivotFieldListHintClass,
  pivotFieldListKbIndicatorClass,
  pivotFieldListPanelClass,
  pivotFieldListTitleClass,
  pivotFieldListZoneClass,
  pivotFilterMenuButtonClass,
  pivotFilterMenuCheckboxClass,
  pivotFilterMenuInputClass,
  pivotFilterMenuLabelClass,
  pivotFilterMenuPrimaryButtonClass,
  pivotSlicerActionClass,
} from "../styles";
import { pivotDropZoneProps, startPivotFieldDrag, type PivotFieldDragSource, type PivotFieldDropTarget } from "./field-drag";
import { cx } from "./heat";
import { PivotFilterMenu, type PivotFilterMenuProps } from "./pivot-filter-menu";
import { PivotFilterIcon } from "./pivot-header-indicator";
import { PivotCalculatedMeasureForm, PivotShowAsMenu, type PivotCalculatedMeasureLabels, type PivotShowAsLabels } from "./pivot-measure-menus";
import type { PivotGridState } from "./use-pivot-grid";
import type { PivotLayoutDraftState } from "./use-pivot-layout-draft";

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export interface PivotFieldListLabels {
  readonly title: string;
  readonly search: string;
  readonly noFields: string;
  readonly hint: string;
  readonly areas: Readonly<Record<PivotFieldArea, string>>;
  readonly unused: string;
  readonly dropHere: string;
  readonly deferLayout: string;
  readonly update: string;
  readonly swap: string;
  readonly moveUp: string;
  readonly moveDown: string;
  readonly moveTo: (area: string) => string;
  readonly remove: string;
  readonly filter: string;
  readonly summarizeBy: string;
  readonly aggregates: Readonly<Record<PivotBuiltInAggregate, string>>;
  /** Date fields: heading of the grouping toggles. */
  readonly groupBy: string;
  readonly dateGroups: Readonly<Record<PivotDateGroup, string>>;
  /** Date fields: back to the raw date field. */
  readonly ungroup: string;
  /** Rows / Columns chips of group levels: heading of the subtotal position buttons. */
  readonly subtotals: string;
  readonly rowSubtotals: Readonly<Record<"start" | "end" | "none", string>>;
  readonly columnSubtotals: Readonly<Record<"start" | "end" | "none", string>>;
  /** Catalog button opening `PivotCalculatedMeasureForm`. */
  readonly addCalculated: string;
  /** Values chip of a calculated measure: edit its formula. */
  readonly editFormula: string;
  /** Labels of the embedded `PivotCalculatedMeasureForm` / `PivotShowAsMenu`. */
  readonly calculatedForm?: Partial<PivotCalculatedMeasureLabels>;
  readonly showAs?: Partial<PivotShowAsLabels>;
  readonly fieldOptions: (label: string) => string;
  readonly close: string;
  readonly back: string;
  /** Screen-reader instructions for chips. */
  readonly instructions: string;
  readonly types: Readonly<Record<PivotFieldType | "calculated", string>>;
  readonly pickedUp: (label: string, area: string, position: number, count: number) => string;
  readonly over: (label: string, area: string, position: number, count: number) => string;
  readonly dropped: (label: string, area: string, position: number, count: number) => string;
  readonly removed: (label: string) => string;
  readonly displaced: (label: string, area: string) => string;
  readonly cancelled: (label: string) => string;
  readonly refused: (reason: PivotFieldMoveRefusal, label: string, area: string) => string;
}

export const PIVOT_FIELD_LIST_LABELS: PivotFieldListLabels = {
  title: "PivotTable fields",
  search: "Search fields",
  noFields: "No matching fields",
  hint: "Drag fields between areas, or press Space on a chip and use the arrow keys.",
  areas: { filters: "Filters", columns: "Columns", rows: "Rows", values: "Values" },
  unused: "Field list",
  dropHere: "Drag fields here",
  deferLayout: "Defer layout update",
  update: "Update",
  swap: "Switch rows and columns",
  moveUp: "Move up",
  moveDown: "Move down",
  moveTo: (area) => `Move to ${area}`,
  remove: "Remove field",
  filter: "Filter…",
  summarizeBy: "Summarize values by",
  aggregates: { sum: "Sum", count: "Count", avg: "Average", min: "Min", max: "Max", first: "First", last: "Last", distinctCount: "Distinct Count" },
  groupBy: "Group by",
  dateGroups: { year: "Years", yearQuarter: "Year-Quarter", quarter: "Quarters", yearMonth: "Year-Month", month: "Months", week: "Weeks", day: "Days" },
  ungroup: "Ungroup",
  subtotals: "Subtotals",
  rowSubtotals: { start: "At top", end: "At bottom", none: "Off" },
  columnSubtotals: { start: "Before", end: "After", none: "Off" },
  addCalculated: "Calculated measure…",
  editFormula: "Edit formula…",
  fieldOptions: (label) => `${label} options`,
  close: "Close",
  back: "Back",
  instructions: "Press Space or Enter to pick up. Arrow keys move it, Space or Enter drops it, Escape cancels.",
  types: { dimension: "Abc", text: "Txt", date: "Date", number: "#", measure: "Σ", calculated: "fx" },
  pickedUp: (label, area, position, count) => `Picked up ${label} in ${area}, position ${position} of ${count}. Use the arrow keys to move, Space or Enter to drop, Escape to cancel.`,
  over: (label, area, position, count) => `${label}: ${area}, position ${position} of ${count}.`,
  dropped: (label, area, position, count) => `${label} dropped in ${area}, position ${position} of ${count}.`,
  removed: (label) => `${label} removed from the layout.`,
  displaced: (label, area) => `${label} moved to ${area}.`,
  cancelled: (label) => `Moving ${label} cancelled.`,
  refused: (reason, label, area) =>
    reason === "rowsRequired"
      ? "Rows need at least one field."
      : reason === "valuesRequired"
        ? "Values need at least one field."
        : reason === "unchanged"
          ? `${label} stays in ${area}.`
          : `${label} cannot go to ${area}.`,
};

// ---------------------------------------------------------------------------
// Keyboard moves (pure)
// ---------------------------------------------------------------------------

/** A keyboard move in progress: the chip and its pending final position. */
export interface PivotKeyboardDrag {
  readonly field: string;
  readonly from: PivotFieldArea;
  readonly to: PivotFieldArea;
  /** Final position in `to` (0-based, counted without the moving chip). */
  readonly position: number;
}

export interface PivotKeyboardDragContext {
  /** Zone order for Left / Right and for Up / Down past a zone's ends (default Excel's: Filters, Columns, Rows, Values). */
  readonly order?: readonly PivotFieldArea[];
  /** Items per zone, the moving chip excluded. */
  readonly lengths: Readonly<Record<PivotFieldArea, number>>;
  /** Zones that accept the chip (its own zone always does). */
  readonly accepts: (area: PivotFieldArea) => boolean;
}

/**
 * Next keyboard-move state for a key (`ArrowUp` / `ArrowDown` step within a zone and continue into
 * the previous / next zone, `ArrowLeft` / `ArrowRight` jump zones, `Home` / `End`), or `null` when
 * the key does not move. Pure, so any UI can reuse it.
 */
export function pivotKeyboardDragStep(drag: PivotKeyboardDrag, key: string, ctx: PivotKeyboardDragContext): PivotKeyboardDrag | null {
  const order = (ctx.order ?? PIVOT_FIELD_AREAS).filter((a) => a === drag.from || ctx.accepts(a));
  const zi = order.indexOf(drag.to);
  const len = (a: PivotFieldArea) => ctx.lengths[a];
  const at = (to: PivotFieldArea, position: number): PivotKeyboardDrag => ({ ...drag, to, position: Math.max(0, Math.min(len(to), position)) });
  switch (key) {
    case "ArrowDown":
      if (drag.position < len(drag.to)) return at(drag.to, drag.position + 1);
      return zi + 1 < order.length ? at(order[zi + 1]!, 0) : null;
    case "ArrowUp":
      if (drag.position > 0) return at(drag.to, drag.position - 1);
      return zi > 0 ? at(order[zi - 1]!, len(order[zi - 1]!)) : null;
    case "ArrowRight":
      return zi + 1 < order.length ? at(order[zi + 1]!, drag.position) : null;
    case "ArrowLeft":
      return zi > 0 ? at(order[zi - 1]!, drag.position) : null;
    case "Home":
      return at(drag.to, 0);
    case "End":
      return at(drag.to, len(drag.to));
    default:
      return null;
  }
}

/** `PivotFieldMove.index` (insertion point among the displayed chips) for a keyboard move's final position. */
export function pivotKeyboardDropIndex(drag: PivotKeyboardDrag, fromIndex: number): number {
  return drag.to === drag.from && drag.position >= fromIndex ? drag.position + 1 : drag.position;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface PivotFieldListClassNames {
  readonly root?: string;
  readonly header?: string;
  readonly title?: string;
  readonly search?: string;
  readonly catalog?: string;
  readonly field?: string;
  readonly areas?: string;
  readonly area?: string;
  readonly areaTitle?: string;
  readonly zone?: string;
  readonly chip?: string;
  readonly panel?: string;
  readonly button?: string;
  readonly footer?: string;
}

export interface PivotFieldChipContext {
  readonly item: PivotFieldListItem;
  readonly index: number;
  readonly count: number;
  /** Being moved with the keyboard. */
  readonly keyboardDragging: boolean;
}

export interface PivotFieldListProps {
  /** The spec being edited (e.g. `grid.spec`). */
  readonly spec: PivotSpec;
  /** Catalogue (e.g. `grid.fields`; default: `resolvePivotFields(spec)`). */
  readonly fields?: readonly PivotFieldSpec[];
  /** Every layout change (on drop, checkbox, menu action, or "Update" in deferred mode). */
  readonly onSpecChange: (next: PivotSpec) => void;
  /** Facet of a field for the chip's filter menu (e.g. `grid.facet`). Without it there is no "Filter…" entry. */
  readonly getFacet?: (field: string) => PivotFacet | undefined;
  /** Model of `spec` (sort / Top N state in the filter menu). */
  readonly model?: PivotModel;
  /** Controlled "Defer layout update" (Excel): batch changes until Update. */
  readonly deferLayout?: boolean;
  readonly defaultDeferLayout?: boolean;
  readonly onDeferLayoutChange?: (deferred: boolean) => void;
  /**
   * Controlled deferred draft (with `onDraftChange`), so other editors such as grid header drags can
   * share it: `usePivotLayoutDraft` + `pivotFieldListProps(grid, layout)`. Uncontrolled by default.
   */
  readonly draft?: PivotSpec | null;
  readonly onDraftChange?: (draft: PivotSpec | null) => void;
  /** Show the defer checkbox and Update button (default true). */
  readonly showDeferLayout?: boolean;
  /** Search box above the field checklist (default true). */
  readonly search?: boolean;
  /** Header title (default `labels.title`); `null` hides the header row. */
  readonly title?: ReactNode | null;
  /** Called after each applied move (plan includes displaced fields and created measures). */
  readonly onMove?: (plan: PivotFieldMovePlan, move: PivotFieldMove) => void;
  readonly className?: string;
  readonly classNames?: PivotFieldListClassNames;
  readonly style?: CSSProperties;
  readonly labels?: Partial<PivotFieldListLabels>;
  /** Replace a checklist entry's label content. */
  readonly renderField?: (field: PivotFieldListField) => ReactNode;
  /** Replace a chip's label content. */
  readonly renderChip?: (context: PivotFieldChipContext) => ReactNode;
  /** Extra props for the embedded `PivotFilterMenu` (labels, classNames, …). */
  readonly filterMenuProps?: Partial<PivotFilterMenuProps>;
}

const AGGREGATES: readonly PivotBuiltInAggregate[] = ["sum", "count", "distinctCount", "avg", "min", "max"];
const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden style={{ display: "block", flexShrink: 0, opacity: 0.55 }}>
      {[2, 7, 12].map((y) => (
        <g key={y}>
          <circle cx="3" cy={y} r="1.1" fill="currentColor" />
          <circle cx="7" cy={y} r="1.1" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ display: "block" }}>
      <circle cx="3.5" cy="8" r="1.3" fill="currentColor" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1.3" fill="currentColor" />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ display: "block" }}>
      <path d="M4 2.5v9M4 11.5l-2-2M4 11.5l2-2M12 13.5v-9M12 4.5l-2 2M12 4.5l2 2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AreaIcon({ area }: { area: PivotFieldArea }) {
  const d =
    area === "filters"
      ? "M2.5 3h11l-4.25 5.2V13l-2.5-1.25V8.2z"
      : area === "columns"
        ? "M2.5 3h11v10h-11zM6.2 3v10M9.8 3v10"
        : area === "rows"
          ? "M2.5 3h11v10h-11zM2.5 6.3h11M2.5 9.7h11"
          : "M11.5 3h-7l4 5-4 5h7";
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden style={{ display: "block" }}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Excel-style PivotTable field list: a searchable field checklist (checkbox = add to / remove from
 * the layout) and four drop zones (Filters, Columns, Rows, Values) with chips.
 *
 * - **Pointer drag** (mouse, pen, touch; no dependency): `startPivotFieldDrag` — preview, insertion
 *   line, auto-scroll, Escape cancels; nothing re-renders until the drop.
 * - **Keyboard**: Space / Enter picks a chip up, arrows move it (across zones too), Space / Enter
 *   drops, Escape cancels; every step is announced in a live region.
 * - **Chip menu** (⋯): move up / down / to another area, remove, "Summarize values by" for values,
 *   and the field's `PivotFilterMenu`, shown in flow under the areas (no portal).
 * - **Defer layout update**: changes collect in a draft until Update.
 *
 * A pure spec editor: every change goes through the core move helpers and `onSpecChange`. Class
 * slots and render props, no `@nqlib/nqui` dependency. Bind to a grid with `pivotFieldListProps(grid)`.
 */
export function PivotFieldList({
  spec: specProp,
  fields,
  onSpecChange,
  getFacet,
  model,
  deferLayout,
  defaultDeferLayout = false,
  onDeferLayoutChange,
  draft: draftProp,
  onDraftChange,
  showDeferLayout = true,
  search = true,
  title,
  onMove,
  className,
  classNames = {},
  style,
  labels: labelOverrides,
  renderField,
  renderChip,
  filterMenuProps,
}: PivotFieldListProps) {
  const id = useId();
  const labels = { ...PIVOT_FIELD_LIST_LABELS, ...labelOverrides };
  const [deferState, setDeferState] = useState(defaultDeferLayout);
  const deferred = deferLayout ?? deferState;
  const [draftState, setDraftState] = useState<PivotSpec | null>(null);
  const draft = draftProp !== undefined ? draftProp : draftState;
  const setDraft = (next: PivotSpec | null) => {
    if (draftProp === undefined) setDraftState(next);
    onDraftChange?.(next);
  };
  const spec = deferred && draft ? draft : specProp;
  const state = useMemo(() => pivotFieldListState(spec, fields), [spec, fields]);
  const [query, setQuery] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [kb, setKb] = useState<PivotKeyboardDrag | null>(null);
  const [panel, setPanel] = useState<{ readonly key: string; readonly view: PanelView } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const focusKey = useRef<string | null>(null);
  const moveOptions = useMemo(() => ({ fields }), [fields]);

  // Several changes before the next render chain on each other (like `usePivotGrid`).
  const emitted = useRef<{ readonly from: PivotSpec; readonly spec: PivotSpec } | null>(null);
  const latest = () => (emitted.current?.from === spec ? emitted.current.spec : spec);
  const apply = (next: PivotSpec) => {
    const from = latest();
    if (next === from) return;
    emitted.current = { from: spec, spec: next };
    if (deferred) setDraft(next);
    else onSpecChange(next);
  };
  const update = (fn: (s: PivotSpec) => PivotSpec) => apply(fn(latest()));

  const areaLabel = (to: PivotFieldLocation) => (to === "unused" ? labels.unused : labels.areas[to]);
  const itemByKey = (key: string) => PIVOT_FIELD_AREAS.flatMap((a) => state[a]).find((i) => i.key === key);

  const runMove = (move: PivotFieldMove, label: string): PivotFieldMovePlan => {
    const plan = planPivotFieldMove(latest(), move, moveOptions);
    if (!plan.changed) {
      setAnnouncement(labels.refused(plan.reason ?? "unchanged", label, areaLabel(move.to)));
      return plan;
    }
    apply(plan.spec);
    onMove?.(plan, move);
    const after = pivotFieldListState(plan.spec, fields);
    let text: string;
    if (move.to === "unused") {
      text = labels.removed(label);
    } else {
      const items = after[move.to];
      const field = move.to === "values" && move.from !== "values" ? (plan.measureId ?? move.field) : move.field;
      const index = items.findIndex((i) => i.field === field);
      text = labels.dropped(label, areaLabel(move.to), index + 1, items.length);
      focusKey.current = index >= 0 ? items[index]!.key : null;
    }
    if (plan.displaced) {
      const d = state.fields.find((f) => f.field === plan.displaced!.field);
      text += ` ${labels.displaced(d?.label ?? plan.displaced.field, areaLabel(plan.displaced.to))}`;
    }
    setAnnouncement(text);
    return plan;
  };

  // Restore focus to a chip after a keyboard / menu move re-renders the zones.
  useEffect(() => {
    const key = focusKey.current;
    if (!key) return;
    focusKey.current = null;
    root.current?.querySelector<HTMLElement>(`[data-nqg-chip-key="${CSS.escape(key)}"] [data-nqg-chip-label]`)?.focus();
  });

  // ---- Pointer drag ----
  const canDrop = (source: PivotFieldDragSource) => (target: PivotFieldDropTarget) =>
    target.to === source.from && target.to !== "unused" ? true : canMovePivotField(latest(), { field: source.field, from: source.from, to: target.to, index: target.index }, moveOptions);
  const beginDrag = (event: ReactPointerEvent<HTMLElement>, source: PivotFieldDragSource) => {
    if ((event.target as Element).closest("[data-nqg-no-drag]")) return;
    if (kb) return;
    startPivotFieldDrag(event, event.currentTarget, {
      source,
      canDrop: canDrop(source),
      onDrop: (target) => {
        if (target.to === "unused" && source.from === "unused") return;
        runMove({ field: source.field, from: source.from, to: target.to, index: target.index }, source.label);
      },
      onCancel: () => setAnnouncement(labels.cancelled(source.label)),
    });
  };

  // ---- Keyboard drag ----
  const lengthsFor = (drag: { field: string; from: PivotFieldArea }) => {
    const out = {} as Record<PivotFieldArea, number>;
    for (const a of PIVOT_FIELD_AREAS) out[a] = state[a].length - (a === drag.from ? 1 : 0);
    return out;
  };
  const kbAccepts = (drag: { field: string; from: PivotFieldArea }) => (area: PivotFieldArea) =>
    area === drag.from || canMovePivotField(latest(), { field: drag.field, from: drag.from, to: area }, moveOptions);
  const announceKb = (drag: PivotKeyboardDrag, item: PivotFieldListItem, picked: boolean) => {
    const count = lengthsFor(drag)[drag.to] + 1;
    const fn = picked ? labels.pickedUp : labels.over;
    setAnnouncement(fn(item.label, labels.areas[drag.to], drag.position + 1, count));
  };
  const onChipKeyDown = (event: KeyboardEvent<HTMLButtonElement>, item: PivotFieldListItem, index: number) => {
    const key = event.key;
    if (!kb) {
      if (key === " " || key === "Enter") {
        event.preventDefault();
        const drag: PivotKeyboardDrag = { field: item.field, from: item.area, to: item.area, position: index };
        setKb(drag);
        setPanel(null);
        announceKb(drag, item, true);
      } else if (key === "Delete" || key === "Backspace") {
        event.preventDefault();
        runMove({ field: item.field, from: item.area, to: "unused" }, item.label);
      } else if ((key === "F10" && event.shiftKey) || key === "ContextMenu") {
        event.preventDefault();
        setPanel({ key: item.key, view: "menu" });
      }
      return;
    }
    if (kb.field !== item.field || kb.from !== item.area) return;
    if (key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setKb(null);
      setAnnouncement(labels.cancelled(item.label));
      return;
    }
    if (key === " " || key === "Enter") {
      event.preventDefault();
      setKb(null);
      if (kb.to === kb.from && kb.position === index) {
        setAnnouncement(labels.dropped(item.label, labels.areas[kb.to], index + 1, state[kb.to].length));
        return;
      }
      runMove({ field: item.field, from: item.area, to: kb.to, index: pivotKeyboardDropIndex(kb, index) }, item.label);
      return;
    }
    if (key === "Tab") {
      setKb(null);
      setAnnouncement(labels.cancelled(item.label));
      return;
    }
    const next = pivotKeyboardDragStep(kb, key, { lengths: lengthsFor(kb), accepts: kbAccepts(kb) });
    if (key.startsWith("Arrow") || key === "Home" || key === "End") event.preventDefault();
    if (next) {
      setKb(next);
      announceKb(next, item, false);
    }
  };

  // ---- Rendering ----
  const q = query.trim().toLowerCase();
  const visibleFields = q ? state.fields.filter((f) => f.label.toLowerCase().includes(q) || f.field.toLowerCase().includes(q)) : state.fields;
  const visibleCalculated = q ? state.calculated.filter((m) => m.label.toLowerCase().includes(q)) : state.calculated;
  const instructionsId = `${id}-instructions`;
  const button = cx(pivotFilterMenuButtonClass, classNames.button);

  const fieldRow = (f: PivotFieldListField) => (
    <li key={f.field}>
      <label
        className={cx(pivotFieldListFieldClass, classNames.field)}
        title={f.description}
        style={{ touchAction: "manipulation" }}
        data-nqg-field={f.field}
        onPointerDown={(e) => beginDrag(e, { field: f.field, from: "unused", label: f.label })}
      >
        <input
          type="checkbox"
          className={pivotFilterMenuCheckboxClass}
          checked={f.checked}
          onChange={(e) => {
            const next = togglePivotField(latest(), f.field, e.target.checked, moveOptions);
            if (next === latest()) setAnnouncement(labels.refused(state.values.length <= 1 ? "valuesRequired" : "rowsRequired", f.label, labels.unused));
            else apply(next);
          }}
        />
        <span className={pivotFieldListFieldTypeClass} aria-hidden style={f.source ? { marginLeft: 12 } : undefined}>
          {labels.types[f.type]}
        </span>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{renderField ? renderField(f) : f.label}</span>
        {f.usedIn.length ? (
          <span className={pivotFieldListHintClass} aria-label={f.usedIn.map((a) => labels.areas[a]).join(", ")}>
            {f.usedIn.map((a) => labels.areas[a][0]).join(" ")}
          </span>
        ) : null}
      </label>
    </li>
  );
  const calculatedRow = (m: PivotFieldListMeasure) => (
    <li key={`calc:${m.id}`}>
      <label
        className={cx(pivotFieldListFieldClass, classNames.field)}
        style={{ touchAction: "manipulation" }}
        data-nqg-field={m.id}
        onPointerDown={(e) => beginDrag(e, { field: m.id, from: "unused", label: m.label })}
      >
        <input type="checkbox" className={pivotFilterMenuCheckboxClass} checked={m.inValues} onChange={(e) => apply(togglePivotField(latest(), m.id, e.target.checked, moveOptions))} />
        <span className={pivotFieldListFieldTypeClass} aria-hidden>
          {labels.types.calculated}
        </span>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.label}</span>
      </label>
    </li>
  );

  const chip = (item: PivotFieldListItem, index: number, count: number) => {
    const dragging = kb !== null && kb.field === item.field && kb.from === item.area;
    const menuOpen = panel?.key === item.key;
    return (
      <li
        key={item.key}
        className={cx(pivotFieldChipClass, item.isValues && pivotFieldChipValuesClass, classNames.chip)}
        data-nqg-drop-item=""
        data-nqg-chip-key={item.key}
        data-nqg-kb-dragging={dragging ? "" : undefined}
        style={{ touchAction: "manipulation" }}
        onPointerDown={(e) => beginDrag(e, { field: item.field, from: item.area, label: item.label })}
      >
        <GripIcon />
        <button
          type="button"
          className={pivotFieldChipLabelClass}
          data-nqg-chip-label=""
          aria-roledescription="draggable field"
          aria-describedby={instructionsId}
          aria-pressed={dragging}
          title={item.label}
          onKeyDown={(e) => onChipKeyDown(e, item, index)}
          onBlur={() => {
            if (dragging) {
              setKb(null);
              setAnnouncement(labels.cancelled(item.label));
            }
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {renderChip ? renderChip({ item, index, count, keyboardDragging: dragging }) : item.label}
          </span>
        </button>
        {item.filtered ? (
          <span style={{ color: "var(--primary, currentColor)", display: "inline-flex" }} aria-hidden>
            <PivotFilterIcon filled />
          </span>
        ) : null}
        <button
          type="button"
          className={pivotSlicerActionClass}
          data-nqg-no-drag=""
          aria-label={labels.fieldOptions(item.label)}
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? `${id}-panel` : undefined}
          onClick={() => setPanel(menuOpen ? null : { key: item.key, view: "menu" })}
        >
          <DotsIcon />
        </button>
      </li>
    );
  };

  const zone = (area: PivotFieldArea) => {
    const items = state[area];
    const kbHere = kb !== null && kb.to === area;
    const fromIndex = kb ? state[kb.from].findIndex((i) => i.field === kb.field) : -1;
    const kbIndex = kbHere && kb ? pivotKeyboardDropIndex(kb, kb.from === area ? fromIndex : Number.MAX_SAFE_INTEGER) : -1;
    const children: ReactNode[] = [];
    items.forEach((item, i) => {
      if (i === kbIndex) children.push(<li key="kb-indicator" aria-hidden className={pivotFieldListKbIndicatorClass} data-nqg-kb-indicator="" />);
      children.push(chip(item, i, items.length));
    });
    if (kbIndex >= items.length) children.push(<li key="kb-indicator" aria-hidden className={pivotFieldListKbIndicatorClass} data-nqg-kb-indicator="" />);
    return (
      <div key={area} className={cx(pivotFieldListAreaClass, classNames.area)}>
        <span id={`${id}-${area}`} className={cx(pivotFieldListAreaTitleClass, classNames.areaTitle)}>
          <AreaIcon area={area} />
          {labels.areas[area]}
        </span>
        <ul
          className={cx(pivotFieldListZoneClass, classNames.zone)}
          aria-labelledby={`${id}-${area}`}
          data-nqg-kb-target={kbHere ? "" : undefined}
          {...pivotDropZoneProps(area)}
        >
          {children}
          {items.length === 0 && !kbHere ? (
            <li className={pivotFieldListEmptyClass} aria-hidden>
              {labels.dropHere}
            </li>
          ) : null}
        </ul>
      </div>
    );
  };

  const panelItem = panel ? itemByKey(panel.key) : undefined;
  // ---- Date grouping ("Group by…" in the chip menu) ----
  const catalogue = useMemo(() => fields ?? resolvePivotFields(spec), [fields, spec]);
  const dateChoices = (item: PivotFieldListItem): readonly PivotDateGroup[] => {
    if (!item.dateSource || item.area === "values") return [];
    return catalogue.find((f) => f.field === item.dateSource)?.dateGroups ?? (fields ? [] : PIVOT_DATE_GROUPS);
  };
  const currentDateGroups = (item: PivotFieldListItem): readonly PivotDateGroup[] =>
    item.dateSource && item.area !== "values" ? pivotDateGroupingOf(spec, item.dateSource, { fields: catalogue, area: item.area }).groups : [];
  const regroup = (item: PivotFieldListItem, groups: readonly PivotDateGroup[]) => {
    if (!item.dateSource || item.area === "values") return;
    const area = item.area;
    const source = item.dateSource;
    const next = setPivotDateGrouping(latest(), source, groups, { fields: catalogue, area });
    if (next === latest()) return;
    apply(next);
    // Keep the menu open on the source's first chip in the area (its key changes with the grouping).
    const first = PIVOT_DATE_GROUPS.find((g) => groups.includes(g));
    const field = first ? pivotDateGroupField(catalogue, source, first) : source;
    setPanel({ key: `${area}:${field}`, view: "menu" });
    setAnnouncement(`${labels.groupBy}: ${groups.length ? groups.map((g) => labels.dateGroups[g]).join(", ") : labels.ungroup}`);
  };
  const closePanel = (refocus = true) => {
    const key = panel?.key;
    setPanel(null);
    if (refocus && key) root.current?.querySelector<HTMLElement>(`[data-nqg-chip-key="${CSS.escape(key)}"] [aria-expanded]`)?.focus();
  };

  return (
    <div
      ref={root}
      className={cx(pivotFieldListClass, className, classNames.root)}
      style={style}
      role="group"
      aria-label={typeof title === "string" ? title : labels.title}
      data-nqg-field-list=""
      data-nqg-deferred={deferred ? "" : undefined}
    >
      {title === null ? null : (
        <div className={cx(pivotFieldListHeaderClass, classNames.header)}>
          <span className={cx(pivotFieldListTitleClass, classNames.title)}>{title ?? labels.title}</span>
          <button
            type="button"
            className={pivotSlicerActionClass}
            aria-label={labels.swap}
            title={labels.swap}
            onClick={() => {
              const next = swapPivotRowsColumns(latest());
              if (next !== latest()) {
                apply(next);
                setAnnouncement(labels.swap);
              }
            }}
          >
            <SwapIcon />
          </button>
        </div>
      )}
      <span id={instructionsId} style={VISUALLY_HIDDEN}>
        {labels.instructions}
      </span>
      <div role="status" aria-live="assertive" aria-atomic="true" style={VISUALLY_HIDDEN} data-nqg-live="">
        {announcement}
      </div>

      {search ? (
        <input
          type="search"
          className={cx(pivotFilterMenuInputClass, classNames.search)}
          placeholder={labels.search}
          aria-label={labels.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      ) : null}
      <ul className={cx(pivotFieldListCatalogClass, classNames.catalog)} aria-label={labels.unused} {...pivotDropZoneProps("unused")}>
        {visibleFields.map(fieldRow)}
        {visibleCalculated.map(calculatedRow)}
        {visibleFields.length + visibleCalculated.length === 0 ? <li className={pivotFieldListEmptyClass}>{labels.noFields}</li> : null}
      </ul>
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <button
          type="button"
          className={button}
          aria-expanded={panel?.key === NEW_CALC_KEY}
          data-nqg-add-calculated=""
          onClick={() => setPanel(panel?.key === NEW_CALC_KEY ? null : { key: NEW_CALC_KEY, view: "calc" })}
        >
          <span aria-hidden className={pivotFieldListFieldTypeClass}>
            {labels.types.calculated}
          </span>
          {labels.addCalculated}
        </button>
      </div>
      {panel?.key === NEW_CALC_KEY ? (
        <div className={cx(pivotFieldListPanelClass, classNames.panel)} id={`${id}-panel`} data-nqg-field-panel={NEW_CALC_KEY}>
          <PivotCalculatedMeasureForm
            spec={latest()}
            labels={labels.calculatedForm}
            style={{ width: "100%" }}
            onCancel={() => setPanel(null)}
            onSubmit={(next, measureId) => {
              apply(next);
              setPanel(null);
              const label = next.measures.find((m) => m.id === measureId)?.label ?? measureId;
              setAnnouncement(labels.dropped(label, labels.areas.values, pivotFieldListState(next, fields).values.length, pivotFieldListState(next, fields).values.length));
            }}
          />
        </div>
      ) : null}

      <p className={pivotFieldListHintClass} style={{ margin: 0 }}>
        {labels.hint}
      </p>
      <div className={cx(pivotFieldListAreasClass, classNames.areas)}>{PIVOT_FIELD_AREAS.map(zone)}</div>

      {panel && panelItem ? (
        <FieldPanel
          key={panel.key}
          id={`${id}-panel`}
          item={panelItem}
          view={panel.view}
          state={state}
          spec={spec}
          labels={labels}
          className={cx(pivotFieldListPanelClass, classNames.panel)}
          buttonClassName={button}
          facet={panel.view === "filter" && panelItem.sourceField ? getFacet?.(panelItem.sourceField) : undefined}
          canFilter={Boolean(getFacet && panelItem.sourceField && panelItem.area !== "values")}
          model={model}
          filterMenuProps={filterMenuProps}
          canMoveTo={(to) => canMovePivotField(latest(), { field: panelItem.field, from: panelItem.area, to }, moveOptions)}
          onMove={(move) => runMove(move, panelItem.label)}
          onAggregate={(aggregate) => update((s) => setPivotMeasureAggregate(s, panelItem.field, aggregate, moveOptions))}
          dateGroups={dateChoices(panelItem)}
          currentDateGroups={currentDateGroups(panelItem)}
          onDateGrouping={(groups) => regroup(panelItem, groups)}
          getFacet={getFacet}
          onUpdate={update}
          onView={(view) => setPanel({ key: panel.key, view })}
          onClose={closePanel}
        />
      ) : null}

      {showDeferLayout ? (
        <div className={cx(pivotFieldListFooterClass, classNames.footer)}>
          <label className={pivotFieldListHintClass} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              className={pivotFilterMenuCheckboxClass}
              checked={deferred}
              onChange={(e) => {
                const next = e.target.checked;
                if (!next && draft) onSpecChange(draft);
                setDraft(null);
                emitted.current = null;
                if (deferLayout === undefined) setDeferState(next);
                onDeferLayoutChange?.(next);
              }}
            />
            {labels.deferLayout}
          </label>
          {deferred ? (
            <button
              type="button"
              className={pivotFilterMenuPrimaryButtonClass}
              disabled={!draft}
              data-nqg-update=""
              onClick={() => {
                if (!draft) return;
                onSpecChange(draft);
                setDraft(null);
                emitted.current = null;
              }}
            >
              {labels.update}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type PanelView = "menu" | "filter" | "calc";
const NEW_CALC_KEY = "calc:new";

interface FieldPanelProps {
  readonly id: string;
  readonly item: PivotFieldListItem;
  readonly view: PanelView;
  readonly state: PivotFieldListState;
  readonly spec: PivotSpec;
  readonly labels: PivotFieldListLabels;
  readonly className: string;
  readonly buttonClassName: string;
  readonly facet: PivotFacet | undefined;
  readonly canFilter: boolean;
  readonly model: PivotModel | undefined;
  readonly filterMenuProps: Partial<PivotFilterMenuProps> | undefined;
  readonly canMoveTo: (to: PivotFieldLocation) => boolean;
  readonly onMove: (move: PivotFieldMove) => PivotFieldMovePlan;
  readonly onAggregate: (aggregate: PivotBuiltInAggregate) => void;
  /** Date grouping choices of the chip's source date field (`[]` hides the section). */
  readonly dateGroups: readonly PivotDateGroup[];
  readonly currentDateGroups: readonly PivotDateGroup[];
  readonly onDateGrouping: (groups: readonly PivotDateGroup[]) => void;
  readonly getFacet?: (field: string) => PivotFacet | undefined;
  readonly onUpdate: (fn: (s: PivotSpec) => PivotSpec) => void;
  readonly onView: (view: PanelView) => void;
  readonly onClose: (refocus?: boolean) => void;
}

/** Chip menu / filter menu, in flow under the areas. */
function FieldPanel({
  id,
  item,
  view,
  state,
  spec,
  labels,
  className,
  buttonClassName,
  facet,
  canFilter,
  model,
  filterMenuProps,
  canMoveTo,
  onMove,
  onAggregate,
  dateGroups,
  currentDateGroups,
  onDateGrouping,
  getFacet,
  onUpdate,
  onView,
  onClose,
}: FieldPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button:not([disabled]), input, select")?.focus();
  }, [view]);
  const items = state[item.area];
  const index = items.findIndex((i) => i.key === item.key);
  const area = labels.areas[item.area];
  const row: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 };
  const heading = pivotFilterMenuLabelClass;
  const measure = item.area === "values" ? spec.measures.find((m) => m.id === item.field) : undefined;
  const aggregate = typeof measure?.aggregate === "string" || measure?.aggregate === undefined ? (measure?.aggregate ?? "sum") : null;
  const field = item.sourceField;
  const inFilters = item.area === "filters";

  const header = (
    <div style={{ ...row, justifyContent: "space-between", flexWrap: "nowrap" }}>
      <span className={heading} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.label} · {area}
      </span>
      <span style={row}>
        {view !== "menu" ? (
          <button type="button" className={buttonClassName} onClick={() => onView("menu")}>
            {labels.back}
          </button>
        ) : null}
        <button type="button" className={pivotSlicerActionClass} aria-label={labels.close} title={labels.close} onClick={() => onClose()}>
          ×
        </button>
      </span>
    </div>
  );

  // Group levels (every row / column field but the innermost) choose where their subtotals go.
  const columnDims = pivotColumnFields(spec);
  const groupLevel =
    item.area === "rows" ? spec.rows.findIndex((d) => d.field === item.field) < spec.rows.length - 1 : item.area === "columns" && !item.isValues && columnDims.findIndex((d) => d.field === item.field) < columnDims.length - 1;
  const dim = item.area === "rows" ? spec.rows.find((d) => d.field === item.field) : item.area === "columns" ? columnDims.find((d) => d.field === item.field) : undefined;
  const subtotal = dim ? (dim.subtotal ?? (item.area === "rows" ? "start" : "end")) : null;
  const subtotalLabels = item.area === "rows" ? labels.rowSubtotals : labels.columnSubtotals;

  let body: ReactNode;
  if (view === "calc" && measure?.calculate !== undefined) {
    body = (
      <PivotCalculatedMeasureForm
        spec={spec}
        measureId={measure.id}
        labels={labels.calculatedForm}
        style={{ width: "100%" }}
        onCancel={() => onView("menu")}
        onRemove={() => {
          onUpdate((s) => removePivotMeasure(s, measure.id));
          onClose(false);
        }}
        onSubmit={(next) => {
          onUpdate(() => next);
          onView("menu");
        }}
      />
    );
  } else if (view === "filter" && facet && field) {
    const dimension = model?.rowDimensions.find((d) => d.field === field);
    const keep = (s: PivotSpec) => (inFilters ? ensurePivotFilterField(s, field, item.label) : s);
    body = (
      <PivotFilterMenu
        facet={{ ...facet, label: item.label }}
        dimension={item.area === "rows" ? dimension : undefined}
        measures={spec.measures.map((m) => ({ id: m.id, label: m.label ?? m.id }))}
        onApplyValues={(selected, allKeys) => onUpdate((s) => keep(setPivotFilterValues(s, field, allKeys, selected)))}
        onTopNChange={item.area === "rows" ? (topN) => onUpdate((s) => setPivotTopN(s, field, topN)) : undefined}
        onSortChange={item.area === "rows" ? (sort) => onUpdate((s) => setPivotSort(s, field, sort)) : undefined}
        onClear={() => onUpdate((s) => keep(setPivotTopN(clearPivotFilter(s, field), field, null)))}
        onClose={() => onView("menu")}
        {...filterMenuProps}
        className={cx(filterMenuProps?.className)}
        style={{ width: "100%", ...filterMenuProps?.style }}
      />
    );
  } else {
    const move = (to: PivotFieldLocation, at?: number) => {
      onMove({ field: item.field, from: item.area, to, index: at });
    };
    const targets = item.isValues ? [] : PIVOT_FIELD_AREAS.filter((a) => a !== item.area && canMoveTo(a));
    body = (
      <>
        <div style={row} role="group" aria-label={labels.fieldOptions(item.label)}>
          <button type="button" className={buttonClassName} disabled={index <= 0} onClick={() => move(item.area, index - 1)}>
            {labels.moveUp}
          </button>
          <button type="button" className={buttonClassName} disabled={index >= items.length - 1} onClick={() => move(item.area, index + 2)}>
            {labels.moveDown}
          </button>
          {item.isValues ? null : (
            <button type="button" className={buttonClassName} disabled={!canMoveTo("unused")} onClick={() => move("unused")}>
              {labels.remove}
            </button>
          )}
        </div>
        {targets.length ? (
          <div style={row}>
            {targets.map((a) => (
              <button key={a} type="button" className={buttonClassName} onClick={() => move(a)}>
                {labels.moveTo(labels.areas[a])}
              </button>
            ))}
          </div>
        ) : null}
        {measure?.calculate !== undefined ? (
          <div style={row}>
            <button type="button" className={buttonClassName} onClick={() => onView("calc")} data-nqg-edit-formula="">
              {labels.editFormula}
            </button>
            <code style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{measure.calculate}</code>
          </div>
        ) : null}
        {item.area === "values" && measure ? (
          <PivotShowAsMenu
            spec={spec}
            measureId={measure.id}
            getFacet={getFacet}
            labels={labels.showAs}
            onChange={(next) => onUpdate(() => next)}
            style={{ width: "100%" }}
          />
        ) : null}
        {groupLevel && subtotal !== null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }} role="group" aria-label={labels.subtotals} data-nqg-subtotals="">
            <span className={heading}>{labels.subtotals}</span>
            <div style={row}>
              {(["start", "end", "none"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={buttonClassName}
                  aria-pressed={subtotal === p}
                  data-nqg-subtotal={p}
                  onClick={() => onUpdate((s) => setPivotSubtotal(s, item.field, p))}
                >
                  {subtotalLabels[p]}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {item.area === "values" && aggregate !== null && measure?.calculate === undefined ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }} role="group" aria-label={labels.summarizeBy}>
            <span className={heading}>{labels.summarizeBy}</span>
            <div style={row}>
              {AGGREGATES.filter((a) => a === "count" || measure?.field).map((a) => (
                <button key={a} type="button" className={buttonClassName} aria-pressed={aggregate === a} onClick={() => onAggregate(a)}>
                  {labels.aggregates[a]}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {dateGroups.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }} role="group" aria-label={labels.groupBy} data-nqg-date-groups="">
            <span className={heading}>{labels.groupBy}</span>
            <div style={row}>
              {dateGroups.map((g) => {
                const on = currentDateGroups.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    className={buttonClassName}
                    aria-pressed={on}
                    data-nqg-date-group={g}
                    onClick={() => onDateGrouping(on ? currentDateGroups.filter((x) => x !== g) : [...currentDateGroups, g])}
                  >
                    {labels.dateGroups[g]}
                  </button>
                );
              })}
              {currentDateGroups.length ? (
                <button type="button" className={buttonClassName} onClick={() => onDateGrouping([])}>
                  {labels.ungroup}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {canFilter ? (
          <div style={row}>
            <button type="button" className={buttonClassName} onClick={() => onView("filter")}>
              <PivotFilterIcon filled={item.filtered === true} />
              {labels.filter}
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-label={labels.fieldOptions(item.label)}
      className={className}
      data-nqg-field-panel={item.key}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {header}
      {body}
    </div>
  );
}

/**
 * `PivotFieldList` props bound to a `usePivotGrid` state. Pass the grid's `usePivotLayoutDraft` as
 * `layout` to share "Defer layout update" with other editors (e.g. header drags).
 */
export function pivotFieldListProps(
  grid: PivotGridState,
  layout?: PivotLayoutDraftState,
): Pick<PivotFieldListProps, "spec" | "fields" | "onSpecChange" | "getFacet" | "model" | "deferLayout" | "onDeferLayoutChange" | "draft" | "onDraftChange"> {
  const base = { spec: grid.spec, fields: grid.fields, onSpecChange: grid.setSpec, getFacet: grid.facet, model: grid.model };
  if (!layout) return base;
  return { ...base, deferLayout: layout.deferred, onDeferLayoutChange: layout.setDeferred, draft: layout.draft, onDraftChange: layout.setDraft };
}
