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
