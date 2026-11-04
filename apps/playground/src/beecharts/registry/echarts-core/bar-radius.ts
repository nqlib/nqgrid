/** Default top-rounded bar corners (matches legacy Recharts `DEFAULT_BAR_RADIUS`). */
export const DEFAULT_BAR_RADIUS = 8;

export type StackCornerRole = "only" | "bottom" | "middle" | "top";

export function barBorderRadius(
  radius: number,
  horizontal: boolean,
): [number, number, number, number] {
  if (radius <= 0) return [0, 0, 0, 0];
  return horizontal ? [0, radius, radius, 0] : [radius, radius, 0, 0];
}

export function stackedBarBorderRadius(
  role: StackCornerRole,
  radius: number,
  horizontal: boolean,
): [number, number, number, number] {
  if (radius <= 0) return [0, 0, 0, 0];

  if (horizontal) {
    switch (role) {
      case "only":
        return [radius, radius, radius, radius];
      case "bottom":
        return [radius, 0, 0, radius];
      case "middle":
        return [0, 0, 0, 0];
      case "top":
        return [0, radius, radius, 0];
    }
  }

  switch (role) {
    case "only":
      return [radius, radius, radius, radius];
    case "bottom":
      return [0, 0, radius, radius];
    case "middle":
      return [0, 0, 0, 0];
    case "top":
      return [radius, radius, 0, 0];
  }
}

export function stackSegmentGapStyle(
  role: StackCornerRole,
  horizontal: boolean,
): {
  borderWidth?: number | [number, number, number, number];
  borderColor?: string;
} {
  // ECharts BarView.getLineWidth() does Math.min(borderWidth, w, h) — array borderWidth
  // becomes NaN and the entire segment is skipped (invisible bottom stack layer).
  // Per-side borders are not supported until we use a custom renderItem gap.
  void role;
  void horizontal;
  return {};
}

/** Stripped caps need a square top edge; rounded tops clip the gradient cap. */
export function barItemBorderRadius(
  variant: string | undefined,
  role: StackCornerRole | undefined,
  radius: number,
  horizontal: boolean,
): [number, number, number, number] {
  if (variant === "stripped") return [0, 0, 0, 0];
  if (role != null) return stackedBarBorderRadius(role, radius, horizontal);
  return barBorderRadius(radius, horizontal);
}

export function resolveBarRadius(
  partRadius: number | undefined,
  chartRadius: number | undefined,
): number {
  if (partRadius != null) return partRadius;
  if (chartRadius != null) return chartRadius;
  return DEFAULT_BAR_RADIUS;
}

/** Per-series corner roles for each category column in a stack group. */
export function buildStackCornerRoles(
  stackBars: Array<{ dataKey: string }>,
  rows: Record<string, unknown>[],
): Map<string, StackCornerRole[]> {
  const roles = new Map<string, StackCornerRole[]>();

  for (let dataIndex = 0; dataIndex < rows.length; dataIndex++) {
    const row = rows[dataIndex] ?? {};
    const active = stackBars.filter((bar) => Number(row[bar.dataKey] ?? 0) > 0);

    for (const bar of stackBars) {
      if (!roles.has(bar.dataKey)) roles.set(bar.dataKey, []);
    }

    if (active.length === 0) continue;

    if (active.length === 1) {
      roles.get(active[0]!.dataKey)![dataIndex] = "only";
      continue;
    }

    for (let i = 0; i < active.length; i++) {
      const bar = active[i]!;
      const role: StackCornerRole =
        i === 0 ? "bottom" : i === active.length - 1 ? "top" : "middle";
      roles.get(bar.dataKey)![dataIndex] = role;
    }
  }

  return roles;
}
