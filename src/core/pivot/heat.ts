/**
 * Discrete heat level for `value` within `[min, max]`: `0 … levels-1`.
 * Returns `undefined` for null values. A flat domain (`min === max`) maps to `0`.
 * Levels (not colors) cross the wire so each renderer maps them to its own palette.
 */
export function pivotHeatLevel(
  value: number | null,
  min: number,
  max: number,
  levels: number,
): number | undefined {
  if (value === null || !Number.isFinite(value)) return undefined;
  if (!(max > min)) return 0;
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return Math.min(levels - 1, Math.floor(t * levels));
}

export interface PivotHeatDomain {
  readonly min: number;
  readonly max: number;
}

/** Min/max over finite values; `null` if there are none. */
export function pivotHeatDomain(values: Iterable<number | null>): PivotHeatDomain | null {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v === null || !Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min === Infinity ? null : { min, max };
}

/**
 * Diverging heat level for `value` around `midpoint`: the middle level `floor(levels / 2)` at the
 * midpoint, lower levels below it (down to `0` at `min`), higher levels above it (up to `levels-1`
 * at `max`). Any value off the midpoint gets at least one step away from the middle.
 * Returns `undefined` for null values.
 */
export function pivotDivergingHeatLevel(
  value: number | null,
  min: number,
  max: number,
  midpoint: number,
  levels: number,
): number | undefined {
  if (value === null || !Number.isFinite(value)) return undefined;
  const middle = Math.floor(levels / 2);
  if (value === midpoint) return middle;
  if (value < midpoint) {
    const below = middle;
    if (below === 0) return 0;
    const t = midpoint > min ? Math.min(1, (midpoint - value) / (midpoint - min)) : 1;
    return middle - Math.max(1, Math.min(below, Math.ceil(t * below)));
  }
  const above = levels - 1 - middle;
  if (above === 0) return middle;
  const t = max > midpoint ? Math.min(1, (value - midpoint) / (max - midpoint)) : 1;
  return middle + Math.max(1, Math.min(above, Math.ceil(t * above)));
}

/**
 * Level of `value` for a heat spec: `pivotHeatLevel` (sequential) or `pivotDivergingHeatLevel`.
 * For a diverging ramp over a data range (`symmetric`), both sides use the larger distance from the
 * midpoint.
 */
export function pivotScaledHeatLevel(
  value: number | null,
  domain: PivotHeatDomain,
  levels: number,
  scale: "sequential" | "diverging" = "sequential",
  midpoint = 0,
  symmetric = false,
): number | undefined {
  if (scale !== "diverging") return pivotHeatLevel(value, domain.min, domain.max, levels);
  if (!symmetric) return pivotDivergingHeatLevel(value, domain.min, domain.max, midpoint, levels);
  const reach = Math.max(midpoint - domain.min, domain.max - midpoint, 0);
  return pivotDivergingHeatLevel(value, midpoint - reach, midpoint + reach, midpoint, levels);
}
