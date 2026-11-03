import { useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { formatPivotCalcError, type PivotCalcError } from "../core/pivot/calc";
import { pivotColumnFields } from "../core/pivot/columns";
import { checkPivotCalculatedMeasure, planPivotCalculatedMeasure, setPivotMeasureShowAs } from "../core/pivot/measures";
import type { PivotFacet, PivotNumberFormat, PivotShowAs, PivotShowAsBase, PivotSpec } from "../core/pivot/types";
import { PIVOT_SHOW_AS_WITH_BASE } from "../core/pivot/validate";
import {
  pivotCalcErrorClass,
  pivotCalcInputClass,
  pivotFilterMenuButtonClass,
  pivotFilterMenuClass,
  pivotFilterMenuInputClass,
  pivotFilterMenuLabelClass,
  pivotFilterMenuPrimaryButtonClass,
} from "../styles";
import { cx } from "./heat";

// ---------------------------------------------------------------------------
// Calculated measure form
// ---------------------------------------------------------------------------

export interface PivotCalculatedMeasureLabels {
  readonly titleNew: string;
  readonly titleEdit: string;
  readonly name: string;
  readonly formula: string;
  readonly placeholder: string;
  readonly insert: string;
  readonly format: string;
  readonly formats: Readonly<Record<"keep" | "number" | "percent" | "integer", string>>;
  readonly hint: string;
  readonly add: string;
  readonly save: string;
  readonly cancel: string;
  readonly remove: string;
}

export const PIVOT_CALCULATED_MEASURE_LABELS: PivotCalculatedMeasureLabels = {
  titleNew: "New calculated measure",
  titleEdit: "Edit calculated measure",
  name: "Name",
  formula: "Formula",
  placeholder: "e.g. actual / plan - 1",
  insert: "Insert measure…",
  format: "Format",
  formats: { keep: "Keep", number: "Number", percent: "Percent", integer: "Integer" },
  hint: "Measures by id ([name with spaces] in brackets), + - * / % ^, comparisons, and / or / not, abs, round, min, max, if, coalesce, sqrt. Totals use the totals of each measure.",
  add: "Add",
  save: "Save",
  cancel: "Cancel",
  remove: "Delete",
};

const FORMATS: Readonly<Record<"number" | "percent" | "integer", PivotNumberFormat>> = {
  number: {},
  percent: { style: "percent", decimals: 1 },
  integer: { decimals: 0 },
};

/** Reference text for a measure id in a formula: the id, or `[id]` when it is not a plain name or is a keyword. */
export function pivotCalcReference(id: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(id) && !/^(and|or|not|null)$/i.test(id) ? id : `[${id}]`;
}

export interface PivotCalculatedMeasureFormProps {
  readonly spec: PivotSpec;
  /** Edit this calculated measure (default: create a new one). */
  readonly measureId?: string;
  /** Called with the new spec (and the measure id) when the formula is valid and submitted. */
  readonly onSubmit: (next: PivotSpec, measureId: string) => void;
  readonly onCancel?: () => void;
  /** Shows a Delete button (editing only). */
  readonly onRemove?: () => void;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly labels?: Partial<PivotCalculatedMeasureLabels>;
}

/**
 * Excel's "Insert calculated field": name, formula (validated as you type with
 * `checkPivotCalculatedMeasure`: grammar, unknown measures, cycles — the message and position show
 * inline), an "insert measure" picker and a format. Submits through `planPivotCalculatedMeasure`.
 */
export function PivotCalculatedMeasureForm({ spec, measureId, onSubmit, onCancel, onRemove, className, style, labels: overrides }: PivotCalculatedMeasureFormProps) {
  const labels = { ...PIVOT_CALCULATED_MEASURE_LABELS, ...overrides };
  const id = useId();
  const existing = measureId !== undefined ? spec.measures.find((m) => m.id === measureId) : undefined;
  const [name, setName] = useState(existing?.label ?? "");
  const [formula, setFormula] = useState(existing?.calculate ?? "");
  const [format, setFormat] = useState<"keep" | "number" | "percent" | "integer">(existing ? "keep" : "number");
  const [touched, setTouched] = useState(false);
  const error = useMemo(() => (formula.trim() ? checkPivotCalculatedMeasure(spec, formula, existing?.id) : null), [spec, formula, existing?.id]);
  const references = spec.measures.filter((m) => m.id !== existing?.id);
  const valid = formula.trim() !== "" && error === null;
  const errorText = error ? (error.code === "cycle" || error.code === "idTaken" ? error.message : formatPivotCalcError(error as PivotCalcError)) : null;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const plan = planPivotCalculatedMeasure(spec, {
      ...(existing ? { id: existing.id } : {}),
      label: name.trim() || formula.trim(),
      calculate: formula,
      ...(format !== "keep" ? { format: FORMATS[format] } : {}),
    });
    if (plan.measureId && (plan.changed || existing)) onSubmit(plan.spec, plan.measureId);
  };

  return (
    <form
      className={cx(pivotFilterMenuClass, className)}
      style={style}
      aria-label={existing ? labels.titleEdit : labels.titleNew}
      data-nqg-calc-form=""
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <span className={pivotFilterMenuLabelClass}>{existing ? labels.titleEdit : labels.titleNew}</span>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className={pivotFilterMenuLabelClass}>{labels.name}</span>
        <input className={pivotFilterMenuInputClass} value={name} onChange={(e) => setName(e.target.value)} data-nqg-calc-name="" />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className={pivotFilterMenuLabelClass}>{labels.formula}</span>
        <textarea
          className={pivotCalcInputClass}
          value={formula}
          placeholder={labels.placeholder}
          spellCheck={false}
          aria-invalid={Boolean(errorText && (touched || formula.length > 0))}
          aria-describedby={`${id}-error ${id}-hint`}
          onChange={(e) => setFormula(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          data-nqg-calc-formula=""
        />
      </label>
      <span id={`${id}-error`} className={pivotCalcErrorClass} aria-live="polite" data-nqg-calc-error="">
        {errorText && (touched || formula.length > 0) ? errorText : ""}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <select
          className={pivotFilterMenuInputClass}
          aria-label={labels.insert}
          value=""
          onChange={(e) => {
            const ref = e.target.value;
            if (ref) setFormula((f) => (f && !/\s$/.test(f) ? `${f} ${ref}` : `${f}${ref}`));
          }}
        >
          <option value="">{labels.insert}</option>
          {references.map((m) => (
            <option key={m.id} value={pivotCalcReference(m.id)}>
              {m.label ?? m.id}
            </option>
          ))}
        </select>
        <select className={pivotFilterMenuInputClass} aria-label={labels.format} value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
          {(existing ? (["keep", "number", "percent", "integer"] as const) : (["number", "percent", "integer"] as const)).map((f) => (
            <option key={f} value={f}>
              {labels.format}: {labels.formats[f]}
            </option>
          ))}
        </select>
      </div>
      <span id={`${id}-hint`} className={pivotCalcErrorClass} style={{ color: "var(--muted-foreground, inherit)" }}>
        {labels.hint}
      </span>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
        {existing && onRemove ? (
          <button type="button" className={pivotFilterMenuButtonClass} onClick={onRemove} style={{ marginRight: "auto" }}>
            {labels.remove}
          </button>
        ) : null}
        {onCancel ? (
          <button type="button" className={pivotFilterMenuButtonClass} onClick={onCancel}>
            {labels.cancel}
          </button>
        ) : null}
        <button type="submit" className={pivotFilterMenuPrimaryButtonClass} disabled={!valid} data-nqg-calc-submit="">
          {existing ? labels.save : labels.add}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Show values as
// ---------------------------------------------------------------------------

export interface PivotShowAsLabels {
  readonly title: string;
  readonly kinds: Readonly<Record<PivotShowAs, string>>;
  readonly baseField: string;
  readonly baseItem: string;
  readonly previous: string;
  readonly next: string;
}

export const PIVOT_SHOW_AS_LABELS: PivotShowAsLabels = {
  title: "Show values as",
  kinds: {
    value: "No calculation",
    percentOfGrandTotal: "% of grand total",
    percentOfColumnTotal: "% of column total",
    percentOfRowTotal: "% of row total",
    percentOfParentRow: "% of parent row total",
    percentOfParentColumn: "% of parent column total",
    differenceFrom: "Difference from",
    percentDifferenceFrom: "% difference from",
    runningTotal: "Running total in",
    percentRunningTotal: "% running total in",
    rankAscending: "Rank smallest to largest",
    rankDescending: "Rank largest to smallest",
  },
  baseField: "Base field",
  baseItem: "Base item",
  previous: "(previous)",
  next: "(next)",
};

/** Every "show values as" kind, in Excel's menu order. */
export const PIVOT_SHOW_AS_KINDS: readonly PivotShowAs[] = [
  "value",
  "percentOfGrandTotal",
  "percentOfColumnTotal",
  "percentOfRowTotal",
  "percentOfParentRow",
  "percentOfParentColumn",
  "differenceFrom",
  "percentDifferenceFrom",
  "runningTotal",
  "percentRunningTotal",
  "rankAscending",
  "rankDescending",
];

export interface PivotShowAsMenuProps {
  readonly spec: PivotSpec;
  readonly measureId: string;
  /** Called with the new spec (`setPivotMeasureShowAs`). */
  readonly onChange: (next: PivotSpec) => void;
  /** Keys of the base field for "Base item" (e.g. `grid.facet`); without it only (previous) / (next). */
  readonly getFacet?: (field: string) => PivotFacet | undefined;
  /** Field labels (default: the dimension label, else the field). */
  readonly fieldLabel?: (field: string) => string;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly labels?: Partial<PivotShowAsLabels>;
  /** Rendered after the controls (e.g. a close button). */
  readonly children?: ReactNode;
}

const ITEM_PREVIOUS = "\u0000previous";
const ITEM_NEXT = "\u0000next";

/**
 * Excel's "Show values as" for one measure: the kind, and for differences / running totals / ranks
 * the base field (a row or column field) and base item ((previous), (next) or a key). Applies on
 * change; a base kind without a base field available is disabled.
 */
export function PivotShowAsMenu({ spec, measureId, onChange, getFacet, fieldLabel, className, style, labels: overrides, children }: PivotShowAsMenuProps) {
  const labels = { ...PIVOT_SHOW_AS_LABELS, ...overrides, kinds: { ...PIVOT_SHOW_AS_LABELS.kinds, ...overrides?.kinds } };
  const id = useId();
  const measure = spec.measures.find((m) => m.id === measureId);
  const dims = [...spec.rows, ...pivotColumnFields(spec)];
  const labelOf = (field: string) => fieldLabel?.(field) ?? dims.find((d) => d.field === field)?.label ?? field;
  const showAs = measure?.showAs ?? "value";
  const base = measure?.showAsBase;
  const needsBase = PIVOT_SHOW_AS_WITH_BASE.has(showAs);
  const isDifference = showAs === "differenceFrom" || showAs === "percentDifferenceFrom";
  if (!measure) return null;
  const apply = (kind: PivotShowAs, nextBase: PivotShowAsBase | null) => onChange(setPivotMeasureShowAs(spec, measureId, kind, nextBase));
  const defaultBase = (): PivotShowAsBase | null => (base && dims.some((d) => d.field === base.field) ? base : dims.length ? { field: dims[dims.length > 1 ? 1 : 0]!.field } : null);
  const facet = needsBase && isDifference && base ? getFacet?.(base.field) : undefined;
  const itemValue = base?.item !== undefined ? base.item : base?.position === "next" ? ITEM_NEXT : ITEM_PREVIOUS;

  return (
    <div className={cx(pivotFilterMenuClass, className)} style={style} role="group" aria-labelledby={`${id}-title`} data-nqg-show-as="">
      <span id={`${id}-title`} className={pivotFilterMenuLabelClass}>
        {labels.title}
      </span>
      <select
        className={pivotFilterMenuInputClass}
        aria-label={labels.title}
        value={showAs}
        onChange={(e) => {
          const kind = e.target.value as PivotShowAs;
          apply(kind, PIVOT_SHOW_AS_WITH_BASE.has(kind) ? defaultBase() : null);
        }}
        data-nqg-show-as-kind=""
      >
        {PIVOT_SHOW_AS_KINDS.map((k) => (
          <option key={k} value={k} disabled={PIVOT_SHOW_AS_WITH_BASE.has(k) && dims.length === 0}>
            {labels.kinds[k]}
          </option>
        ))}
      </select>
      {needsBase ? (
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className={pivotFilterMenuLabelClass}>{labels.baseField}</span>
          <select
            className={pivotFilterMenuInputClass}
            value={base?.field ?? ""}
            onChange={(e) => apply(showAs, { field: e.target.value })}
            data-nqg-show-as-field=""
          >
            {dims.map((d) => (
              <option key={d.field} value={d.field}>
                {labelOf(d.field)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {needsBase && isDifference && base ? (
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className={pivotFilterMenuLabelClass}>{labels.baseItem}</span>
          <select
            className={pivotFilterMenuInputClass}
            value={itemValue}
            onChange={(e) => {
              const v = e.target.value;
              apply(showAs, v === ITEM_PREVIOUS ? { field: base.field } : v === ITEM_NEXT ? { field: base.field, position: "next" } : { field: base.field, item: v });
            }}
            data-nqg-show-as-item=""
          >
            <option value={ITEM_PREVIOUS}>{labels.previous}</option>
            <option value={ITEM_NEXT}>{labels.next}</option>
            {(facet?.values ?? (base.item !== undefined ? [{ key: base.item, label: base.item }] : [])).map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {children}
    </div>
  );
}
