import type { CSSProperties } from "react";

export interface TreeIndentProps {
  /** Depth in the tree. `0` renders nothing. */
  depth: number;
  /** Per-rung width (px). Default 12 — matches w-3. */
  rungWidth?: number;
  /** Row height (px). Default 28 — matches h-7. */
  rowHeight?: number;
  /** Optional override for the connector color. CSS variable token (e.g. `var(--border)`) or any color. */
  color?: string;
  /** Stroke width (px). Default 1. */
  strokeWidth?: number;
  /** Optional className appended to the wrapper. */
  className?: string;
}

function joinClasses(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Tree-style indent gutter for hierarchical table rows.
 *
 * Renders `depth` vertical rungs; the last rung adds a short horizontal elbow
 * so the eye traces from the parent down to this row's name/chevron slot.
 *
 * Pure CSS — no DOM measurement, no React state. Drop into a name cell:
 *
 * ```tsx
 * <div className="flex min-w-0 items-center gap-0.5">
 *   <TreeIndent depth={row.depth} />
 *   <Chevron … />
 *   <NameEditor … />
 * </div>
 * ```
 *
 * Color resolves to `--border` so it tracks the theme. Override via `color`
 * (any CSS color) or by wrapping in a section that re-defines `--border`.
 */
export function TreeIndent({
  depth,
  rungWidth = 12,
  rowHeight = 28,
  color,
  strokeWidth = 1,
  className,
}: TreeIndentProps) {
  if (depth <= 0) return null;

  const stroke = color ?? "color-mix(in oklab, var(--border) 50%, transparent)";
  const rungStyle: CSSProperties = {
    width: rungWidth,
    height: rowHeight,
    borderLeftWidth: strokeWidth,
    borderLeftStyle: "solid",
    borderLeftColor: stroke,
  };
  // The elbow: a horizontal hairline from the rung centerline reaching toward
  // the next slot. Implemented via inline ::before-equivalent (span).
  const elbowStyle: CSSProperties = {
    position: "absolute",
    left: -strokeWidth,
    top: "50%",
    height: strokeWidth,
    width: Math.max(rungWidth - 2, 6),
    backgroundColor: stroke,
  };

  return (
    <span
      className={joinClasses("inline-flex shrink-0 items-center", className)}
      aria-hidden
    >
      {Array.from({ length: depth }).map((_, i) => {
        const isLast = i === depth - 1;
        return (
          <span
            key={i}
            style={{ ...rungStyle, position: isLast ? "relative" : "static" }}
            className="inline-block"
          >
            {isLast ? <span style={elbowStyle} /> : null}
          </span>
        );
      })}
    </span>
  );
}
