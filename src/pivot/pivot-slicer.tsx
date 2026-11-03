import { useId, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

import type { PivotFacet, PivotFacetValue, PivotModel } from "../core/pivot/types";
import {
  pivotSlicerActionClass,
  pivotSlicerClass,
  pivotSlicerCountClass,
  pivotSlicerHeaderClass,
  pivotSlicerItemClass,
  pivotSlicerItemNoDataClass,
  pivotSlicerItemSelectedClass,
  pivotSlicerListClass,
  pivotSlicerTitleClass,
} from "../styles";
import { cx } from "./heat";

/** How a slicer click changes the selection (see `togglePivotFilterValue`). */
export type PivotSlicerSelectMode = "only" | "toggle";

export interface PivotSlicerItemState {
  readonly selected: boolean;
  readonly hasData: boolean;
  /** The field is filtered (otherwise every value is selected). */
  readonly filtered: boolean;
}

export interface PivotSlicerClassNames {
  readonly root?: string;
  readonly header?: string;
  readonly title?: string;
  readonly action?: string;
  readonly list?: string;
  readonly item?: string;
  readonly itemSelected?: string;
  readonly itemNoData?: string;
  readonly count?: string;
}

export interface PivotSlicerLabels {
  /** Clear button (default `Clear {label} filter`). */
  readonly clear: (label: string) => string;
  /** Multi-select toggle (default `Multi-select`). */
  readonly multiSelect: string;
  /** Appended to the accessible name of items without data (default `no data`). */
  readonly noData: string;
}

export const PIVOT_SLICER_LABELS: PivotSlicerLabels = {
  clear: (label) => `Clear ${label} filter`,
  multiSelect: "Multi-select",
  noData: "no data",
};

export interface PivotSlicerProps {
  /** One entry of `model.facets` (list the field in `spec.facets`). */
  readonly facet: PivotFacet;
  /**
   * Item activated. `only` for a plain click / Enter, `toggle` for Ctrl / Cmd / Shift-click, Space,
   * or any click in multi-select mode. Wire to `grid.toggleFilterValue(field, key, mode)`.
   */
  readonly onToggleValue?: (key: string, mode: PivotSlicerSelectMode) => void;
  /** Clear button / Delete / Alt+C. Wire to `grid.clearFilter(field)`. */
  readonly onClear?: () => void;
  /** Plain clicks toggle instead of selecting one value (Excel's multi-select button). */
  readonly multiSelect?: boolean;
  /** When set, a multi-select toggle button appears in the header. */
  readonly onMultiSelectChange?: (next: boolean) => void;
  /** Grid columns (default 2). */
  readonly columns?: number;
  /** Show cross-filtered record counts on items (default false). */
  readonly showCounts?: boolean;
  /** Hide items with no data under the other filters (default false: they are greyed out). */
  readonly hideItemsWithNoData?: boolean;
  /** Move items with no data to the end (default true, like Excel). */
  readonly noDataLast?: boolean;
  /** Header title (default `facet.label`); `null` hides the header. */
  readonly title?: ReactNode | null;
  readonly className?: string;
  readonly classNames?: PivotSlicerClassNames;
  readonly style?: CSSProperties;
  /** Replace an item's content (label + optional count). */
  readonly renderItem?: (value: PivotFacetValue, state: PivotSlicerItemState) => ReactNode;
  readonly labels?: Partial<PivotSlicerLabels>;
}

/** Items in display order (pure; `noDataLast` / `hideItemsWithNoData` as in `PivotSlicer`). */
export function pivotSlicerItems(
  facet: PivotFacet,
  { noDataLast = true, hideItemsWithNoData = false }: { readonly noDataLast?: boolean; readonly hideItemsWithNoData?: boolean } = {},
): PivotFacetValue[] {
  const values = hideItemsWithNoData ? facet.values.filter((v) => v.hasData) : [...facet.values];
  return noDataLast ? [...values.filter((v) => v.hasData), ...values.filter((v) => !v.hasData)] : values;
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ display: "block" }}>
      <path d="M2.5 3h11l-4.25 5.2V13l-2.5-1.25V8.2z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M10.5 10.5l4 4m0-4l-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function MultiSelectIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ display: "block" }}>
      <path d="M2 4.5l1.5 1.5L6 3.5M2 10.5L3.5 12 6 9.5M8.5 5h5.5M8.5 11h5.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Excel-style slicer: a grid of value buttons for one facet. Selected values are highlighted
 * (all of them while the field is unfiltered), values with no data under the other filters are
 * greyed out (and listed last), and the header has a clear button (plus an optional multi-select
 * toggle).
 *
 * Accessible as a multi-select `listbox` of `option` buttons: arrow keys / Home / End move focus,
 * Enter selects only the focused value, Space toggles it, Delete or Alt+C clears the filter.
 * Stateless — selection lives in the spec — so it renders statically as well.
 */
export function PivotSlicer({
  facet,
  onToggleValue,
  onClear,
  multiSelect = false,
  onMultiSelectChange,
  columns = 2,
  showCounts = false,
  hideItemsWithNoData = false,
  noDataLast = true,
  title,
  className,
  classNames = {},
  style,
  renderItem,
  labels: labelOverrides,
}: PivotSlicerProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const labels = { ...PIVOT_SLICER_LABELS, ...labelOverrides };
  const items = pivotSlicerItems(facet, { noDataLast, hideItemsWithNoData });
  // Roving tab stop without state: the first selected value with data (else the first item).
  const anchor = Math.max(0, facet.filtered ? items.findIndex((v) => v.selected && v.hasData) : 0);
  const cols = Math.max(1, Math.floor(columns));

  const activate = (key: string, mode: PivotSlicerSelectMode) => onToggleValue?.(key, multiSelect ? "toggle" : mode);
  const onItemClick = (key: string) => (event: MouseEvent<HTMLButtonElement>) =>
    activate(key, event.ctrlKey || event.metaKey || event.shiftKey ? "toggle" : "only");

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const index = Number(target.getAttribute("data-index"));
    if ((event.key === "Delete" || event.key === "Backspace" || (event.altKey && event.key.toLowerCase() === "c")) && facet.filtered) {
      event.preventDefault();
      onClear?.();
      return;
    }
    if (Number.isNaN(index) || target.getAttribute("role") !== "option") return;
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index + cols,
      ArrowUp: index - cols,
      Home: 0,
      End: items.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      const next = Math.min(items.length - 1, Math.max(0, moves[event.key]!));
      (event.currentTarget.querySelector(`[data-index="${next}"]`) as HTMLElement | null)?.focus();
      return;
    }
    const value = items[index];
    if (!value) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      activate(value.key, event.key === " " || event.ctrlKey || event.metaKey ? "toggle" : "only");
    }
  };

  const showHeader = title !== null;
  return (
    <div
      className={cx(pivotSlicerClass, className, classNames.root)}
      style={style}
      role="group"
      aria-labelledby={showHeader ? titleId : undefined}
      aria-label={showHeader ? undefined : facet.label}
      data-nqg-slicer={facet.field}
      data-filtered={facet.filtered ? "" : undefined}
    >
      {showHeader ? (
        <div className={cx(pivotSlicerHeaderClass, classNames.header)}>
          <span id={titleId} className={cx(pivotSlicerTitleClass, classNames.title)}>
            {title ?? facet.label}
          </span>
          <span style={{ display: "inline-flex", gap: 2 }}>
            {onMultiSelectChange ? (
              <button
                type="button"
                className={cx(pivotSlicerActionClass, classNames.action)}
                aria-pressed={multiSelect}
                aria-label={labels.multiSelect}
                title={labels.multiSelect}
                onClick={() => onMultiSelectChange(!multiSelect)}
              >
                <MultiSelectIcon />
              </button>
            ) : null}
            {onClear ? (
              <button
                type="button"
                className={cx(pivotSlicerActionClass, classNames.action)}
                aria-label={labels.clear(facet.label)}
                title={labels.clear(facet.label)}
                disabled={!facet.filtered}
                onClick={onClear}
              >
                <ClearIcon />
              </button>
            ) : null}
          </span>
        </div>
      ) : null}
      <div
        className={cx(pivotSlicerListClass, classNames.list)}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        role="listbox"
        aria-multiselectable="true"
        aria-labelledby={showHeader ? titleId : undefined}
        aria-label={showHeader ? undefined : facet.label}
        onKeyDown={onKeyDown}
        // Space activates buttons on keyup; it is handled on keydown above.
        onKeyUp={(event) => event.key === " " && event.preventDefault()}
      >
        {items.map((value, index) => {
          const state: PivotSlicerItemState = { selected: value.selected, hasData: value.hasData, filtered: facet.filtered };
          const name = [value.label, showCounts ? String(value.count) : null, value.hasData ? null : labels.noData].filter(Boolean).join(", ");
          return (
            <button
              key={value.key}
              type="button"
              role="option"
              aria-selected={value.selected}
              aria-label={name}
              title={value.label}
              tabIndex={index === anchor ? 0 : -1}
              data-index={index}
              data-selected={value.selected ? "" : undefined}
              data-no-data={value.hasData ? undefined : ""}
              className={cx(
                pivotSlicerItemClass,
                classNames.item,
                value.selected && pivotSlicerItemSelectedClass,
                value.selected && classNames.itemSelected,
                !value.hasData && pivotSlicerItemNoDataClass,
                !value.hasData && classNames.itemNoData,
              )}
              onClick={onItemClick(value.key)}
            >
              {renderItem ? (
                renderItem(value, state)
              ) : (
                <>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value.label}</span>
                  {showCounts ? <span className={cx(pivotSlicerCountClass, classNames.count)}>{value.count}</span> : null}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Find a facet by field (throws with a hint when it is not in `spec.facets`). */
export function pivotFacetOf(model: PivotModel, field: string): PivotFacet {
  const facet = model.facets?.find((f) => f.field === field);
  if (!facet) throw new Error(`nqgrid pivot: no facet for "${field}" — add it to spec.facets`);
  return facet;
}
