import type { PivotHeatPalette, PivotHeatScale } from "./types";

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

/** A tone key: letters, digits, `-` and `_`, starting with a letter (a CSS custom-property suffix). */
const TONE_KEY = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

/**
 * True for a valid tone key (`PivotHeatSpec.palette`, `PivotTable` `cellTone`). Renderers draw key `k`
 * as `var(--nq-pivot-tone-k)`, so a key can never carry free CSS.
 */
export function isPivotToneKey(key: unknown): key is string {
  return typeof key === "string" && TONE_KEY.test(key);
}

/** True for a valid `PivotHeatSpec.palette`: two or three tone keys. */
export function isPivotHeatPalette(palette: unknown): palette is PivotHeatPalette {
  return Array.isArray(palette) && (palette.length === 2 || palette.length === 3) && palette.every(isPivotToneKey);
}

/** CSS palette steps of a heat ramp (`--nq-pivot-heat-0 … -8`). */
const HEAT_STEPS = 9;

/**
 * Palette step (`0 … 8`) of a heat level. Sequential: a linear map. Diverging: the middle level
 * (`floor(levels / 2)`) is always step 4, lower levels spread over steps 0–3 and higher ones over 5–8,
 * whatever `levels` is.
 */
export function pivotHeatPaletteStep(level: number, levels: number, scale: PivotHeatScale = "sequential"): number {
  if (levels <= 1) return 0;
  const l = Math.min(levels - 1, Math.max(0, Math.round(level)));
  if (scale !== "diverging") return Math.round((l * (HEAT_STEPS - 1)) / (levels - 1));
  const middle = Math.floor(levels / 2);
  if (l === middle) return 4;
  if (l < middle) return middle <= 1 ? 0 : Math.round((l * 3) / (middle - 1));
  const above = levels - 1 - middle;
  return 5 + (above <= 1 ? 3 : Math.round(((l - middle - 1) * 3) / (above - 1)));
}

/**
 * `var(--nq-pivot-tone-<key>)` for a valid tone key (`isPivotToneKey`), else `undefined`. The host
 * defines one `--nq-pivot-tone-<key>` variable per key it uses; the grid never writes a color.
 */
export function pivotToneVar(key: string | undefined): string | undefined {
  return isPivotToneKey(key) ? `var(--nq-pivot-tone-${key})` : undefined;
}

/**
 * Background of heat palette step `step` (`0 … 8`) for a `PivotHeatSpec.palette`: the stop's own
 * `var(--nq-pivot-tone-<key>)` on a stop, an oklab `color-mix` of the two nearest stops between them.
 * Two stops sit on steps 0 and 8; three stops on steps 0, 4 and 8. `undefined` for an invalid palette.
 */
export function pivotHeatPaletteColor(palette: PivotHeatPalette, step: number): string | undefined {
  if (!isPivotHeatPalette(palette)) return undefined;
  const s = Math.min(HEAT_STEPS - 1, Math.max(0, Math.round(step)));
  const span = (HEAT_STEPS - 1) / (palette.length - 1);
  const at = Math.min(palette.length - 2, Math.floor(s / span));
  const t = (s - at * span) / span;
  const from = `var(--nq-pivot-tone-${palette[at]})`;
  const to = `var(--nq-pivot-tone-${palette[at + 1]})`;
  if (t === 0) return from;
  if (t === 1) return to;
  return `color-mix(in oklab, ${from} ${Math.round((1 - t) * 1000) / 10}%, ${to})`;
}
