import type { CSSProperties } from "react";

import type { PivotCell } from "../core/pivot/types";
import { pivotHeatCellClass, pivotHeatColorVar } from "../styles";
import { pivotHeatStep } from "./layout";

/** How a grid renders: `interactive` (buttons, sticky pinning) or `static` (plain markup for HTML/PDF). */
export type PivotRenderMode = "interactive" | "static";

export function cx(...parts: readonly (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export interface PivotHeatCellProps {
  readonly className: string;
  readonly style?: CSSProperties;
  readonly "data-heat"?: number;
}

/**
 * Props for a heat cell (TanStack `cell` / `<td>`): palette step class `nqg-heat-N`,
 * `data-heat`, and an inline `var(--nqg-heat-N, …)` background. Cells without heat get none.
 */
export function pivotHeatCellProps(cell: PivotCell | undefined, levels: number): PivotHeatCellProps {
  if (cell?.heat === undefined) return { className: "" };
  const step = pivotHeatStep(cell.heat, levels);
  return {
    className: cx(pivotHeatCellClass, `nqg-heat-${step}`),
    style: { backgroundColor: pivotHeatColorVar(step) },
    "data-heat": step,
  };
}
