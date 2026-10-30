import type { ReactNode } from "react";

import type { PivotKpiValue } from "../core/pivot/types";
import {
  pivotDeltaClass,
  pivotDeltaNegativeClass,
  pivotDeltaNeutralClass,
  pivotDeltaPositiveClass,
  pivotKpiAvatarClass,
  pivotKpiCaptionClass,
  pivotKpiHeadlineLabelClass,
  pivotKpiHeadlineValueClass,
  pivotKpiListClass,
  pivotKpiPanelClass,
  pivotKpiTermClass,
  pivotKpiTitleClass,
  pivotKpiValueClass,
  pivotLabelTextClass,
} from "../styles";
import { cx } from "./heat";
import { pivotInitials, pivotKpiPanelParts, pivotSign } from "./layout";

/** Text color for a signed value (green up, red down, muted at zero). */
export function pivotDeltaToneClass(value: number | null | undefined): string {
  const sign = pivotSign(value);
  return sign > 0 ? pivotDeltaPositiveClass : sign < 0 ? pivotDeltaNegativeClass : pivotDeltaNeutralClass;
}

export interface PivotKpiPanelProps {
  readonly kpis: readonly PivotKpiValue[];
  /** Heading (e.g. the department name). */
  readonly title?: ReactNode;
  /** Next to the title, e.g. a collapse toggle. */
  readonly titleAddon?: ReactNode;
  /** Footer line, e.g. the owner; strings get an initials avatar. */
  readonly caption?: ReactNode;
  /** KPI id shown large (default: the first KPI). */
  readonly headlineId?: string;
  readonly className?: string;
}

/**
 * Group KPI side panel: a signed headline (e.g. growth), label/value rows, then
 * "vs <compare>" deltas and a caption. No hooks or handlers — safe for static markup.
 */
export function PivotKpiPanel({ kpis, title, titleAddon, caption, headlineId, className }: PivotKpiPanelProps) {
  const { headline, values, deltas } = pivotKpiPanelParts(kpis, headlineId);
  return (
    <div className={cx(pivotKpiPanelClass, className)} data-nqg-kpi-panel="">
      {title !== undefined || titleAddon !== undefined ? (
        <div className={pivotKpiTitleClass}>
          <span className={pivotLabelTextClass}>{title}</span>
          {titleAddon}
        </div>
      ) : null}
      {headline ? (
        <div>
          <div className={pivotKpiHeadlineLabelClass}>{headline.label}</div>
          <div className={cx(pivotKpiHeadlineValueClass, pivotDeltaToneClass(headline.value))}>{headline.text}</div>
        </div>
      ) : null}
      {values.length || deltas.length ? (
        <dl className={pivotKpiListClass}>
          {values.map((k) => (
            <PivotKpiRow key={k.id} label={k.label} text={k.text} />
          ))}
          {deltas.map((d) => (
            <PivotKpiRow key={`${d.id}:delta`} label={d.label} text={d.text} valueClassName={pivotDeltaToneClass(d.delta)} />
          ))}
        </dl>
      ) : null}
      {caption !== undefined && caption !== null ? (
        <div className={pivotKpiCaptionClass}>
          {typeof caption === "string" ? (
            <>
              <span className={pivotKpiAvatarClass} aria-hidden>
                {pivotInitials(caption)}
              </span>
              <span className={pivotLabelTextClass}>{caption}</span>
            </>
          ) : (
            caption
          )}
        </div>
      ) : null}
    </div>
  );
}

function PivotKpiRow({ label, text, valueClassName }: { label: string; text: string; valueClassName?: string }) {
  return (
    <>
      <dt className={pivotKpiTermClass}>{label}</dt>
      <dd className={cx(pivotKpiValueClass, valueClassName)}>{text}</dd>
    </>
  );
}

/** Compact signed KPI (e.g. under a collapsed group label). */
export function PivotKpiDelta({ kpi, className }: { readonly kpi: PivotKpiValue; readonly className?: string }) {
  const value = kpi.deltaText !== undefined ? kpi.delta : kpi.value;
  const text = kpi.deltaText ?? kpi.text;
  return (
    <span className={cx(pivotDeltaClass, pivotDeltaToneClass(value), className)} title={kpi.label}>
      {text}
    </span>
  );
}
