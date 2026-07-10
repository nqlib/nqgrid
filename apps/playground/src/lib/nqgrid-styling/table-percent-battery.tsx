import type { ReactNode } from "react";

import {
  tablePercentBatteryFillClass,
  tablePercentBatteryLabelStrongClass,
  tablePercentBatteryLabelMutedClass,
  tablePercentBatteryShellClass,
  tablePercentBatteryTrackClass,
} from "./styles";

export type TablePercentBatteryTone = "muted" | "strong";

export interface TablePercentBatteryProps {
  /** Raw percent; values outside 0–100 are clamped. Non-finite values render as 0. */
  value: number;
  /** Text emphasis; `muted` aligns with `tableNumericMutedClass` tables. */
  tone?: TablePercentBatteryTone;
  /** When false, the numeric label is visually hidden but still available to screen readers. */
  showLabel?: boolean;
  /** Suffix after the rounded integer (default "%"). */
  suffix?: string;
  /** Optional node instead of built-in `${n}${suffix}` (still uses clamped value for the bar). */
  children?: ReactNode;
  className?: string;
  /** Override bar fill (Tailwind classes). */
  fillClassName?: string;
  /** Override track behind the bar. */
  trackClassName?: string;
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function joinClasses(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * “Battery” percent readout: filled track behind a right-aligned tabular label.
 * Use inside TanStack `cell` renderers; omit entirely when product does not want the chrome.
 */
export function TablePercentBattery({
  value,
  tone = "muted",
  showLabel = true,
  suffix = "%",
  children,
  className,
  fillClassName,
  trackClassName,
}: TablePercentBatteryProps) {
  const pct = clampPercent(value);
  const labelClass = tone === "strong" ? tablePercentBatteryLabelStrongClass : tablePercentBatteryLabelMutedClass;
  const label =
    children ??
    `${Math.round(pct)}${suffix}`;

  return (
    <div
      className={joinClasses(tablePercentBatteryShellClass, className)}
      aria-label={`Progress ${Math.round(pct)} percent`}
    >
      <span className={joinClasses(tablePercentBatteryTrackClass, trackClassName)} aria-hidden />
      <span
        className={joinClasses(tablePercentBatteryFillClass, fillClassName)}
        style={{ width: `${pct}%` }}
        aria-hidden
      />
      <span className={joinClasses(labelClass, !showLabel ? "sr-only" : undefined)}>{label}</span>
    </div>
  );
}
