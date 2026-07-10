import type { ReactNode } from "react";

import { tableHitAreaCellClass } from "./styles";

export type HitAreaScope = "row" | "header";

export interface HitAreaSwapProps {
  /**
   * Force the action layer visible (e.g. row is selected). When false, the
   * action layer is hidden by default and revealed on hover / focus-within of
   * the `group/row` (or `group/header`) ancestor.
   */
  active: boolean;
  /** What to render when not hovered and not active — typically a row number or `#`. */
  default: ReactNode;
  /** What to swap in on hover / when active — typically a checkbox. */
  action: ReactNode;
  /**
   * Which group selector to bind hover/focus-within to. `row` (default) pairs
   * with `tableRowClass`'s `group/row` token; `header` pairs with a
   * `group/header` wrapper you control.
   */
  scope?: HitAreaScope;
  /** Override the wrapper className (default: `tableHitAreaCellClass`). */
  className?: string;
}

function joinClasses(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Two-layer hit-area swap.
 *
 * Renders `default` and `action` in the same cell slot, switching between
 * them via opacity + pointer-events. When `active` is true the action layer
 * is always on top; otherwise the swap is triggered by hover / focus-within
 * of the `group/{scope}` ancestor.
 *
 * Use cases:
 * - Row-number ↔ row-selection checkbox
 * - Header `#` ↔ select-all checkbox
 * - Row-number ↔ drag handle (stack multiple swaps if needed)
 *
 * This component is headless: pass any nodes for `default` / `action`. For
 * row selection, pair with your design system's Checkbox (e.g. `@nqlib/nqui`).
 */
export function HitAreaSwap({
  active,
  default: defaultNode,
  action,
  scope = "row",
  className,
}: HitAreaSwapProps) {
  // Tailwind needs literal class strings to extract; branch instead of interpolate.
  const defaultClass =
    scope === "row"
      ? active
        ? "opacity-0"
        : "group-hover/row:opacity-0 group-focus-within/row:opacity-0"
      : active
        ? "opacity-0"
        : "group-hover/header:opacity-0 group-focus-within/header:opacity-0";

  const actionClass =
    scope === "row"
      ? active
        ? "pointer-events-auto opacity-100"
        : "pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100"
      : active
        ? "pointer-events-auto opacity-100"
        : "pointer-events-none opacity-0 group-hover/header:pointer-events-auto group-hover/header:opacity-100 group-focus-within/header:pointer-events-auto group-focus-within/header:opacity-100";

  return (
    <div className={joinClasses(className ?? tableHitAreaCellClass)}>
      <span className={joinClasses("transition-opacity", defaultClass)} aria-hidden>
        {defaultNode}
      </span>
      <div className={joinClasses("absolute inset-0 flex items-center justify-center transition-opacity", actionClass)}>
        {action}
      </div>
    </div>
  );
}
