import type { PivotModel, PivotModelDimension } from "../core/pivot/types";
import { pivotHeaderIndicatorClass } from "../styles";
import { cx } from "./heat";

/** Sort / filter state of one row dimension, for header indicators and `aria-sort`. */
export interface PivotDimensionStatus {
  readonly dimension: PivotModelDimension;
  /** Effective direction (`sortBy` first, then label `sort`), or `null`. */
  readonly sort: "asc" | "desc" | null;
  /** Sorted by a measure rather than by key. */
  readonly sortedByValue: boolean;
  /** A report / label filter or Top N applies to this field. */
  readonly filtered: boolean;
  /** Human-readable summary ("Sorted by Actual, descending · Line: Top 3 by Actual"), `""` when inactive. */
  readonly description: string;
}

const measureLabelOf = (model: PivotModel, id: string) => model.columns.find((c) => c.measureId === id)?.measureLabel ?? id;

/** Pure: sort / filter status of `model.rowDimensions[level]`. */
export function pivotDimensionStatus(model: PivotModel, level: number): PivotDimensionStatus {
  const dimension = model.rowDimensions[level]!;
  const sort = dimension.sortBy ? (dimension.sortBy.direction ?? "desc") : (dimension.sort ?? null);
  const filtered = dimension.filtered === true || dimension.topN !== undefined;
  const parts: string[] = [];
  if (dimension.sortBy) {
    const column = dimension.sortBy.columnKey !== undefined ? ` (${dimension.sortBy.columnKey})` : "";
    parts.push(`Sorted by ${measureLabelOf(model, dimension.sortBy.measure)}${column}, ${sort === "asc" ? "ascending" : "descending"}`);
  } else if (sort) {
    parts.push(`Sorted ${sort === "asc" ? "A to Z" : "Z to A"}`);
  }
  for (const f of model.filters ?? []) if (f.field === dimension.field) parts.push(f.text);
  return { dimension, sort, sortedByValue: dimension.sortBy !== undefined, filtered, description: parts.join(" · ") };
}

/** `aria-sort` value for a dimension header. */
export function pivotAriaSort(status: PivotDimensionStatus): "ascending" | "descending" | undefined {
  return status.sort === "asc" ? "ascending" : status.sort === "desc" ? "descending" : undefined;
}

export function PivotSortIcon({ direction, size = 12 }: { readonly direction: "asc" | "desc"; readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden style={{ display: "block" }}>
      <path
        d={direction === "asc" ? "M8 13V3M4 7l4-4 4 4" : "M8 3v10M4 9l4 4 4-4"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PivotFilterIcon({ size = 12, filled = true }: { readonly size?: number; readonly filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden style={{ display: "block" }}>
      <path
        d="M2.5 3h11l-4.25 5.2V13l-2.5-1.25V8.2z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Inline so static HTML (no Tailwind) lays the icons out the same way. */
const INDICATOR_STYLE = { display: "inline-flex", alignItems: "center", gap: 2, verticalAlign: "middle" } as const;

export interface PivotHeaderIndicatorProps {
  readonly status: PivotDimensionStatus;
  readonly className?: string;
  /** Icon size in px (default 12). */
  readonly size?: number;
}

/**
 * Small sort arrow and / or funnel for an active sort or filter, with the status as its accessible
 * name. Renders nothing when the dimension is neither sorted nor filtered. Pure (static-safe).
 */
export function PivotHeaderIndicator({ status, className, size }: PivotHeaderIndicatorProps) {
  if (!status.sort && !status.filtered) return null;
  return (
    <span className={cx(pivotHeaderIndicatorClass, className)} role="img" aria-label={status.description} title={status.description} data-nqg-indicator="" style={INDICATOR_STYLE}>
      {status.sort ? <PivotSortIcon direction={status.sort} size={size} /> : null}
      {status.filtered ? <PivotFilterIcon size={size} /> : null}
    </span>
  );
}
