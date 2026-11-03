import type { CSSProperties, ReactNode } from "react";

import type { PivotDrillThroughResult, PivotDrillThroughTarget } from "../core/pivot/cube";
import { formatPivotNumber } from "../core/pivot/format";
import type { PivotDataRow, PivotFieldSpec, PivotModel, PivotNumberFormat, PivotSpec } from "../core/pivot/types";
import {
  pivotDrillCellClass,
  pivotDrillHeadCellClass,
  pivotDrillNumericClass,
  pivotDrillPanelClass,
  pivotDrillScrollClass,
  pivotDrillTableClass,
  pivotDrillTitleClass,
  pivotFilterMenuLabelClass,
  pivotSlicerActionClass,
} from "../styles";
import { cx } from "./heat";

export interface PivotDrillThroughLabels {
  readonly title: string;
  readonly close: string;
  readonly empty: string;
  /** "Showing 50 of 120 records". */
  readonly count: (shown: number, total: number) => string;
}

export const PIVOT_DRILL_THROUGH_LABELS: PivotDrillThroughLabels = {
  title: "Details",
  close: "Close",
  empty: "No records",
  count: (shown, total) => (shown === total ? `${total} record${total === 1 ? "" : "s"}` : `Showing ${shown} of ${total} records`),
};

export interface PivotDrillThroughClassNames {
  readonly root?: string;
  readonly title?: string;
  readonly scroll?: string;
  readonly table?: string;
  readonly headCell?: string;
  readonly cell?: string;
}

export interface PivotDrillThroughPanelProps {
  /** `grid.drillThrough(target)` / `pivotDrillThrough(spec, rows, target)`. */
  readonly result: PivotDrillThroughResult;
  /** Columns to show (default `result.fields`). */
  readonly fields?: readonly string[];
  /** Column header text per field (default: the field). */
  readonly fieldLabels?: Readonly<Record<string, string>>;
  /** Number formats per field (e.g. the measures' formats); other numbers print with up to 2 decimals. */
  readonly formats?: Readonly<Record<string, PivotNumberFormat>>;
  /** Heading (default `labels.title`), e.g. `Camp › Tents · Nov · Actual`. */
  readonly title?: ReactNode;
  /** Replace a cell's content. */
  readonly renderCell?: (record: PivotDataRow, field: string) => ReactNode;
  readonly onClose?: () => void;
  /** Height of the scrolling records table (default 320px). */
  readonly maxHeight?: number | string;
  readonly className?: string;
  readonly classNames?: PivotDrillThroughClassNames;
  readonly style?: CSSProperties;
  readonly labels?: Partial<PivotDrillThroughLabels>;
}

const isNumeric = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Default cell text: formatted numbers, ISO-ish dates, plain strings; `null` / `undefined` blank. */
export function pivotDrillThroughCellText(value: unknown, format?: PivotNumberFormat): string {
  if (value === null || value === undefined) return "";
  if (isNumeric(value)) return formatPivotNumber(value, format ?? {});
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  return String(value);
}

/**
 * Records behind a pivot cell (Excel's "Show details") as a plain scrollable `<table>` with a sticky
 * header: one column per field, numbers right-aligned in the measures' formats, a record count
 * ("Showing 1,000 of 4,210 records" when `limit` cut the list) and an optional close button. No
 * effects or portals; put it in a dialog, a side sheet or under the grid.
 */
export function PivotDrillThroughPanel({
  result,
  fields,
  fieldLabels,
  formats,
  title,
  renderCell,
  onClose,
  maxHeight = 320,
  className,
  classNames = {},
  style,
  labels: overrides,
}: PivotDrillThroughPanelProps) {
  const labels = { ...PIVOT_DRILL_THROUGH_LABELS, ...overrides };
  const columns = fields ?? result.fields;
  const numericColumns = new Set(columns.filter((f) => result.records.some((r) => isNumeric(r[f])) && result.records.every((r) => r[f] === null || r[f] === undefined || isNumeric(r[f]))));
  return (
    <section className={cx(pivotDrillPanelClass, className, classNames.root)} style={style} aria-label={typeof title === "string" ? title : labels.title} data-nqg-drill-through="">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className={cx(pivotDrillTitleClass, classNames.title)}>{title ?? labels.title}</div>
          <div className={pivotFilterMenuLabelClass} role="status" data-nqg-drill-count="">
            {labels.count(result.records.length, result.total)}
          </div>
        </div>
        {onClose ? (
          <button type="button" className={pivotSlicerActionClass} aria-label={labels.close} title={labels.close} onClick={onClose}>
            ×
          </button>
        ) : null}
      </div>
      <div className={cx(pivotDrillScrollClass, classNames.scroll)} style={{ maxHeight }} tabIndex={0} role="region" aria-label={labels.title}>
        <table className={cx(pivotDrillTableClass, classNames.table)}>
          <thead>
            <tr>
              {columns.map((f) => (
                <th key={f} scope="col" className={cx(pivotDrillHeadCellClass, numericColumns.has(f) && pivotDrillNumericClass, classNames.headCell)}>
                  {fieldLabels?.[f] ?? f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.records.length === 0 ? (
              <tr>
                <td className={cx(pivotDrillCellClass, classNames.cell)} colSpan={Math.max(1, columns.length)}>
                  {labels.empty}
                </td>
              </tr>
            ) : (
              result.records.map((record, i) => (
                <tr key={result.indices[i] ?? i}>
                  {columns.map((f) => (
                    <td key={f} className={cx(pivotDrillCellClass, numericColumns.has(f) && pivotDrillNumericClass, classNames.cell)}>
                      {renderCell ? renderCell(record, f) : pivotDrillThroughCellText(record[f], formats?.[f])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Header text for a drill-through target: the row's labels and the column's header, e.g.
 * `Camp › Tents · 2026 · Actual` (`Grand Total` for the grand total row).
 */
export function pivotDrillThroughTitle(model: PivotModel, target: PivotDrillThroughTarget): string {
  const row = model.rows.find((r) => r.kind !== "subtotal" && r.path.length === target.path.length && r.path.every((k, i) => k === target.path[i]));
  const rowText = target.path.length === 0 ? model.grandTotal.label : row ? labelsAlong(model, row.path) : target.path.join(" › ");
  const column =
    model.columns.find((c) => c.measureId === target.measureId && sameColumn(c.columnPath ?? (c.columnKey !== null ? [c.columnKey] : []), target.columnPath ?? [])) ?? null;
  const parts = [rowText, ...(column ? column.headerPath : [])];
  return parts.join(" · ");
}

const sameColumn = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((k, i) => k === b[i]);

function labelsAlong(model: PivotModel, path: readonly string[]): string {
  const out: string[] = [];
  for (let d = 1; d <= path.length; d++) {
    const row = model.rows.find((r) => r.kind !== "subtotal" && r.path.length === d && r.path.every((k, i) => k === path[i]));
    out.push(row?.label ?? path[d - 1]!);
  }
  return out.join(" › ");
}

/**
 * `PivotDrillThroughPanel` field labels and number formats from a spec: labels from `fieldLabels`,
 * the catalogue (`fields`, e.g. `grid.fields`), dimension labels and `sum` measure labels; formats
 * from the measures on each field.
 */
export function pivotDrillThroughFieldInfo(
  spec: PivotSpec,
  fields: readonly PivotFieldSpec[] = spec.fields ?? [],
): { readonly fieldLabels: Record<string, string>; readonly formats: Record<string, PivotNumberFormat> } {
  const fieldLabels: Record<string, string> = {};
  const formats: Record<string, PivotNumberFormat> = {};
  for (const f of fields) {
    if (f.label) fieldLabels[f.field] = f.label;
    if (f.format) formats[f.field] = f.format;
  }
  for (const d of spec.rows) if (d.label && !d.field.includes(":")) fieldLabels[d.field] ??= d.label;
  for (const m of spec.measures) {
    if (!m.field || (m.aggregate ?? "sum") !== "sum") continue;
    if (m.label) fieldLabels[m.field] ??= m.label;
    if (m.format) formats[m.field] ??= m.format;
  }
  Object.assign(fieldLabels, spec.fieldLabels ?? {});
  return { fieldLabels, formats };
}
