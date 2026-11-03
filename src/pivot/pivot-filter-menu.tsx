import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { clearPivotFilter, setPivotTopN, type PivotSortRequest } from "../core/pivot/interaction";
import type { PivotFacet, PivotFacetValue, PivotModelDimension, PivotTopNSpec } from "../core/pivot/types";
import {
  pivotFilterMenuButtonClass,
  pivotFilterMenuCheckboxClass,
  pivotFilterMenuClass,
  pivotFilterMenuInputClass,
  pivotFilterMenuLabelClass,
  pivotFilterMenuListClass,
  pivotFilterMenuOptionClass,
  pivotFilterMenuPrimaryButtonClass,
  pivotFilterMenuSectionClass,
  pivotHeaderMenuClass,
  pivotHeaderMenuPanelClass,
  pivotSlicerActionClass,
  pivotSlicerCountClass,
} from "../styles";
import { cx } from "./heat";
import { PivotFilterIcon, PivotSortIcon } from "./pivot-header-indicator";
import { pivotFacetOf, type PivotSlicerProps } from "./pivot-slicer";
import type { PivotGridState } from "./use-pivot-grid";

export interface PivotFilterMenuClassNames {
  readonly root?: string;
  readonly section?: string;
  readonly label?: string;
  readonly button?: string;
  readonly primaryButton?: string;
  readonly input?: string;
  readonly list?: string;
  readonly option?: string;
  readonly checkbox?: string;
  readonly count?: string;
}

export interface PivotFilterMenuLabels {
  readonly sort: string;
  readonly sortAsc: string;
  readonly sortDesc: string;
  readonly sortByValue: string;
  readonly sortValueDesc: string;
  readonly sortValueAsc: string;
  readonly topN: string;
  readonly top: string;
  readonly bottom: string;
  readonly by: string;
  readonly other: string;
  readonly topNDirection: string;
  readonly topNCount: string;
  readonly topNMeasure: string;
  readonly values: string;
  readonly search: string;
  readonly selectAll: string;
  readonly noMatches: string;
  readonly noData: string;
  readonly clear: string;
  readonly cancel: string;
  readonly apply: string;
}

export const PIVOT_FILTER_MENU_LABELS: PivotFilterMenuLabels = {
  sort: "Sort",
  sortAsc: "A → Z",
  sortDesc: "Z → A",
  sortByValue: "Sort by value",
  sortValueDesc: "Largest",
  sortValueAsc: "Smallest",
  topN: "Show only",
  top: "Top",
  bottom: "Bottom",
  by: "by",
  other: "Group the rest as “Other”",
  topNDirection: "Top or bottom",
  topNCount: "Number of items",
  topNMeasure: "Rank by measure",
  values: "Values",
  search: "Search",
  selectAll: "Select all",
  noMatches: "No matches",
  noData: "no data",
  clear: "Clear filter",
  cancel: "Cancel",
  apply: "Apply",
};

export interface PivotFilterMenuProps {
  /** The field's facet (`model.facets`): values, counts and current selection. */
  readonly facet: PivotFacet;
  /** Row-dimension state (sort / Top N). Omit for fields that are not row dimensions. */
  readonly dimension?: PivotModelDimension;
  /** Measures offered for sort-by-value and Top N (default: none → those controls are hidden). */
  readonly measures?: readonly { readonly id: string; readonly label: string }[];
  /** Apply: the checked keys out of every facet key. Wire to `grid.setFilterValues(field, allKeys, selected)`. */
  readonly onApplyValues?: (selected: readonly string[], allKeys: readonly string[]) => void;
  /** Apply: the Top N draft (`null` = off). Wire to `grid.setTopN(field, topN)`. */
  readonly onTopNChange?: (topN: PivotTopNSpec | null) => void;
  /** Sort buttons (applied immediately; pressing the active one clears it). Wire to `grid.setSort(field, sort)`. */
  readonly onSortChange?: (sort: PivotSortRequest | null) => void;
  /** "Clear filter" (values and Top N on this field). */
  readonly onClear?: () => void;
  /** After Apply, Cancel, Clear or Escape. */
  readonly onClose?: () => void;
  /** Search box above the values (default true). */
  readonly search?: boolean;
  /** Record counts next to values (default true). */
  readonly showCounts?: boolean;
  readonly className?: string;
  readonly classNames?: PivotFilterMenuClassNames;
  readonly style?: CSSProperties;
  readonly labels?: Partial<PivotFilterMenuLabels>;
  /** Replace a value's label content. */
  readonly renderValue?: (value: PivotFacetValue) => ReactNode;
}

/** Facet values whose label contains `query` (case-insensitive). Pure. */
export function pivotFilterMenuMatches(values: readonly PivotFacetValue[], query: string): PivotFacetValue[] {
  const q = query.trim().toLowerCase();
  return q ? values.filter((v) => v.label.toLowerCase().includes(q)) : [...values];
}

/** Tri-state of a "select all" checkbox over `visible` given the `checked` keys. Pure. */
export function pivotSelectAllState(visible: readonly PivotFacetValue[], checked: ReadonlySet<string>): boolean | "mixed" {
  const n = visible.filter((v) => checked.has(v.key)).length;
  return n === 0 ? false : n === visible.length ? true : "mixed";
}

/**
 * Excel-style header filter panel for one field: sort (A→Z, Z→A, by a measure), Top / Bottom N
 * (with an optional "Other" row), and a searchable checkbox list with "Select all". The checkbox
 * list and Top N are drafts until Apply; sort applies immediately.
 *
 * Only the panel — place it in any popover (nqui `Popover`, Radix, …) or use `PivotHeaderMenu`
 * (inline, no portal). Native inputs and class slots, no `@nqlib/nqui` dependency.
 */
export function PivotFilterMenu({
  facet,
  dimension,
  measures = [],
  onApplyValues,
  onTopNChange,
  onSortChange,
  onClear,
  onClose,
  search = true,
  showCounts = true,
  className,
  classNames = {},
  style,
  labels: labelOverrides,
  renderValue,
}: PivotFilterMenuProps) {
  const id = useId();
  const labels = { ...PIVOT_FILTER_MENU_LABELS, ...labelOverrides };
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<ReadonlySet<string> | null>(null);
  const [topN, setTopN] = useState<{ enabled: boolean; spec: PivotTopNSpec } | null>(null);
  const [sortMeasure, setSortMeasure] = useState<string | null>(null);

  const checked = draft ?? new Set(facet.values.filter((v) => v.selected).map((v) => v.key));
  const visible = pivotFilterMenuMatches(facet.values, query);
  const allState = pivotSelectAllState(visible, checked);
  const firstMeasure = measures[0]?.id;
  const currentTopN = topN ?? {
    enabled: dimension?.topN !== undefined,
    spec: dimension?.topN ?? { measure: firstMeasure ?? "", count: 10 },
  };
  const valueSortMeasure = sortMeasure ?? dimension?.sortBy?.measure ?? firstMeasure;
  const showSort = Boolean(onSortChange && dimension);
  const showTopN = Boolean(onTopNChange && dimension && measures.length);
  const dirty = draft !== null || topN !== null;

  const toggle = (key: string) => {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDraft(next);
  };
  const toggleAll = () => {
    const next = new Set(checked);
    for (const v of visible) {
      if (allState === true) next.delete(v.key);
      else next.add(v.key);
    }
    setDraft(next);
  };
  const updateTopN = (patch: Partial<PivotTopNSpec>, enabled = true) =>
    setTopN({ enabled, spec: { ...currentTopN.spec, ...patch } });

  const apply = () => {
    if (draft !== null) onApplyValues?.(facet.values.filter((v) => draft.has(v.key)).map((v) => v.key), facet.values.map((v) => v.key));
    if (topN !== null) onTopNChange?.(topN.enabled && topN.spec.measure ? topN.spec : null);
    onClose?.();
  };

  const sortState: "asc" | "desc" | "valueAsc" | "valueDesc" | null = dimension?.sortBy
    ? dimension.sortBy.direction === "asc"
      ? "valueAsc"
      : "valueDesc"
    : (dimension?.sort ?? null);
  const sortButton = (state: NonNullable<typeof sortState>, label: string, icon: ReactNode, request: PivotSortRequest, name?: string) => (
    <button
      type="button"
      className={cx(pivotFilterMenuButtonClass, classNames.button)}
      aria-pressed={sortState === state}
      aria-label={name}
      title={name}
      onClick={() => onSortChange?.(sortState === state ? null : request)}
    >
      {icon}
      {label}
    </button>
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose?.();
    }
  };

  const section = cx(pivotFilterMenuSectionClass, classNames.section);
  const heading = cx(pivotFilterMenuLabelClass, classNames.label);
  const input = cx(pivotFilterMenuInputClass, classNames.input);
  const row: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 };

  return (
    <div
      className={cx(pivotFilterMenuClass, className, classNames.root)}
      style={style}
      role="group"
      aria-label={`${facet.label} filter`}
      data-nqg-filter-menu={facet.field}
      onKeyDown={onKeyDown}
    >
      {showSort ? (
        <div className={section} role="group" aria-labelledby={`${id}-sort`}>
          <span id={`${id}-sort`} className={heading}>
            {labels.sort}
          </span>
          <div style={row}>
            {sortButton("asc", labels.sortAsc, <PivotSortIcon direction="asc" />, { by: "label", direction: "asc" })}
            {sortButton("desc", labels.sortDesc, <PivotSortIcon direction="desc" />, { by: "label", direction: "desc" })}
          </div>
          {measures.length && valueSortMeasure ? (
            <div style={row}>
              <select
                className={input}
                aria-label={labels.sortByValue}
                value={valueSortMeasure}
                onChange={(e) => {
                  setSortMeasure(e.target.value);
                  if (dimension?.sortBy) onSortChange?.({ by: "value", measure: e.target.value, direction: dimension.sortBy.direction ?? "desc" });
                }}
              >
                {measures.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              {sortButton("valueDesc", labels.sortValueDesc, <PivotSortIcon direction="desc" />, { by: "value", measure: valueSortMeasure, direction: "desc" }, `${labels.sortByValue}: ${labels.sortValueDesc}`)}
              {sortButton("valueAsc", labels.sortValueAsc, <PivotSortIcon direction="asc" />, { by: "value", measure: valueSortMeasure, direction: "asc" }, `${labels.sortByValue}: ${labels.sortValueAsc}`)}
            </div>
          ) : null}
        </div>
      ) : null}

      {showTopN ? (
        <div className={section} role="group" aria-labelledby={`${id}-topn`}>
          <label id={`${id}-topn`} className={cx(heading)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              className={cx(pivotFilterMenuCheckboxClass, classNames.checkbox)}
              checked={currentTopN.enabled}
              onChange={(e) => updateTopN({}, e.target.checked)}
            />
            {labels.topN}
          </label>
          <div style={row}>
            <select
              className={input}
              aria-label={labels.topNDirection}
              value={currentTopN.spec.direction ?? "top"}
              onChange={(e) => updateTopN({ direction: e.target.value as "top" | "bottom" })}
            >
              <option value="top">{labels.top}</option>
              <option value="bottom">{labels.bottom}</option>
            </select>
            <input
              type="number"
              className={input}
              style={{ width: 56 }}
              min={1}
              step={1}
              aria-label={labels.topNCount}
              value={currentTopN.spec.count}
              onChange={(e) => updateTopN({ count: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
            />
            <span className={heading} style={{ textTransform: "none", letterSpacing: 0 }}>
              {labels.by}
            </span>
            <select
              className={input}
              aria-label={labels.topNMeasure}
              value={currentTopN.spec.measure}
              onChange={(e) => updateTopN({ measure: e.target.value })}
            >
              {measures.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <label className={cx(pivotFilterMenuOptionClass, classNames.option)}>
            <input
              type="checkbox"
              className={cx(pivotFilterMenuCheckboxClass, classNames.checkbox)}
              checked={currentTopN.spec.other === true}
              onChange={(e) => updateTopN({ other: e.target.checked || undefined })}
            />
            {labels.other}
          </label>
        </div>
      ) : null}

      <div className={section} role="group" aria-labelledby={`${id}-values`}>
        <span id={`${id}-values`} className={heading}>
          {labels.values}
        </span>
        {search ? (
          <input
            type="search"
            className={input}
            placeholder={labels.search}
            aria-label={`${labels.search} ${facet.label}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        ) : null}
        <label className={cx(pivotFilterMenuOptionClass, classNames.option)} style={{ fontWeight: 500 }}>
          <input
            type="checkbox"
            className={cx(pivotFilterMenuCheckboxClass, classNames.checkbox)}
            checked={allState === true}
            aria-checked={allState === "mixed" ? "mixed" : allState}
            ref={(el) => {
              if (el) el.indeterminate = allState === "mixed";
            }}
            disabled={visible.length === 0}
            onChange={toggleAll}
          />
          {labels.selectAll}
        </label>
        <ul className={cx(pivotFilterMenuListClass, classNames.list)} aria-label={facet.label}>
          {visible.length === 0 ? (
            <li className={cx(pivotFilterMenuOptionClass, classNames.option)} style={{ cursor: "default" }}>
              {labels.noMatches}
            </li>
          ) : (
            visible.map((v) => (
              <li key={v.key}>
                <label className={cx(pivotFilterMenuOptionClass, classNames.option)} style={v.hasData ? undefined : { opacity: 0.55 }}>
                  <input
                    type="checkbox"
                    className={cx(pivotFilterMenuCheckboxClass, classNames.checkbox)}
                    checked={checked.has(v.key)}
                    onChange={() => toggle(v.key)}
                    aria-label={v.hasData ? v.label : `${v.label}, ${labels.noData}`}
                  />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {renderValue ? renderValue(v) : v.label}
                  </span>
                  {showCounts ? <span className={cx(pivotSlicerCountClass, classNames.count)}>{v.count}</span> : null}
                </label>
              </li>
            ))
          )}
        </ul>
      </div>

      <div style={{ ...row, justifyContent: "space-between" }}>
        <button
          type="button"
          className={cx(pivotFilterMenuButtonClass, classNames.button)}
          disabled={!facet.filtered && !dimension?.topN}
          onClick={() => {
            onClear?.();
            onClose?.();
          }}
        >
          <PivotFilterIcon filled={false} />
          {labels.clear}
        </button>
        <span style={row}>
          <button type="button" className={cx(pivotFilterMenuButtonClass, classNames.button)} onClick={() => onClose?.()}>
            {labels.cancel}
          </button>
          <button type="button" className={cx(pivotFilterMenuPrimaryButtonClass, classNames.primaryButton)} disabled={!dirty} onClick={apply}>
            {labels.apply}
          </button>
        </span>
      </div>
    </div>
  );
}

export interface PivotHeaderMenuProps {
  /** Accessible name of the trigger, e.g. `Filter Line`. */
  readonly label: string;
  /** A sort / filter is active (filled funnel, `data-active`). */
  readonly active?: boolean;
  /** Panel content; a function receives `close`. */
  readonly children: ReactNode | ((close: () => void) => ReactNode);
  /** Controlled open state. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** Trigger content (default: a funnel icon). */
  readonly icon?: ReactNode;
  /** Panel alignment under the trigger (default `start`). */
  readonly align?: "start" | "end";
  readonly className?: string;
  readonly buttonClassName?: string;
  readonly panelClassName?: string;
  readonly panelStyle?: CSSProperties;
}

/**
 * Minimal disclosure for header menus: a trigger button and an absolutely positioned panel
 * rendered in place (no portal, no effects). Escape closes and refocuses the trigger; focus leaving
 * the menu closes it. Use your own popover instead when you have one (the playground uses nqui).
 */
export function PivotHeaderMenu({
  label,
  active = false,
  children,
  open: openProp,
  onOpenChange,
  icon,
  align = "start",
  className,
  buttonClassName,
  panelClassName,
  panelStyle,
}: PivotHeaderMenuProps) {
  const id = useId();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const trigger = useRef<HTMLButtonElement>(null);
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <span
      className={cx(pivotHeaderMenuClass, className)}
      data-nqg-header-menu=""
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close();
        }
      }}
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={cx(pivotSlicerActionClass, buttonClassName)}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        data-active={active ? "" : undefined}
        style={active ? { color: "var(--primary, currentColor)" } : undefined}
        onClick={() => setOpen(!open)}
      >
        {icon ?? <PivotFilterIcon filled={active} />}
      </button>
      {open ? (
        <div
          id={`${id}-panel`}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          className={cx(pivotHeaderMenuPanelClass, panelClassName)}
          style={{ ...(align === "end" ? { left: "auto", right: 0 } : null), ...panelStyle }}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      ) : null}
    </span>
  );
}

/** `PivotSlicer` props bound to a `usePivotGrid` state (throws when `field` is not in `spec.facets`). */
export function pivotSlicerProps(grid: PivotGridState, field: string): Pick<PivotSlicerProps, "facet" | "onToggleValue" | "onClear"> {
  return {
    facet: pivotFacetOf(grid.model, field),
    onToggleValue: (key, mode) => grid.toggleFilterValue(field, key, mode),
    onClear: () => grid.clearFilter(field),
  };
}

/**
 * `PivotFilterMenu` props bound to a `usePivotGrid` state: facet, row-dimension state, the spec's
 * measures, and callbacks (Clear removes this field's filters and Top N).
 */
export function pivotFilterMenuProps(
  grid: PivotGridState,
  field: string,
): Pick<PivotFilterMenuProps, "facet" | "dimension" | "measures" | "onApplyValues" | "onTopNChange" | "onSortChange" | "onClear"> {
  const dimension = grid.model.rowDimensions.find((d) => d.field === field);
  return {
    facet: pivotFacetOf(grid.model, field),
    dimension,
    measures: grid.spec.measures.map((m) => ({ id: m.id, label: m.label ?? m.id })),
    onApplyValues: (selected, allKeys) => grid.setFilterValues(field, allKeys, selected),
    onTopNChange: dimension ? (topN) => grid.setTopN(field, topN) : undefined,
    onSortChange: dimension ? (sort) => grid.setSort(field, sort) : undefined,
    onClear: () => grid.setSpec((s) => setPivotTopN(clearPivotFilter(s, field), field, null)),
  };
}
