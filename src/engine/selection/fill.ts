/**
 * Headless value-fill (Excel "fill handle"). Given the values of a source
 * selection, extend them to `length` values: numeric arithmetic series,
 * month / weekday cycles, "Item 3" trailing-number increment, or a plain
 * copy-cycle. Pure data in → data out; the consumer decides which cells to
 * write the result into.
 */

export type FillValue = string | number;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Continue a known cyclic sequence (months/days) from the last source value. */
function cyclicSequenceFill(
  source: readonly FillValue[],
  length: number,
  seq: readonly string[],
): string[] | null {
  const indices = source.map((s) => seq.findIndex((x) => x.toLowerCase() === String(s).toLowerCase()));
  if (indices.some((i) => i < 0)) return null;
  const out: string[] = [];
  let cur = indices[indices.length - 1]!;
  for (let i = 0; i < length; i++) {
    cur = (cur + 1) % seq.length;
    out.push(seq[cur]!);
  }
  return out;
}

/**
 * Extend `source` to `length` filled values.
 * - all-numeric with a constant step (or a single number) → arithmetic series
 *   (a single number is copied, matching Excel's default drag);
 * - month / weekday names → continue the cycle;
 * - a single `"text<n>"` → increment the trailing number;
 * - otherwise → repeat the source pattern.
 */
export function computeFill(source: readonly FillValue[], length: number): FillValue[] {
  if (length <= 0 || source.length === 0) return [];

  // 1. Numeric arithmetic series.
  const nums = source.map((v) => (typeof v === "number" ? v : Number(v)));
  const allNumeric = source.every((v, i) => v !== "" && v != null && Number.isFinite(nums[i]!));
  if (allNumeric) {
    const step = source.length >= 2 ? nums[1]! - nums[0]! : 0;
    // Compare deltas with an epsilon: exact `===` rejects decimal series like
    // 0.1, 0.2, 0.3 (0.3 - 0.2 !== 0.1 in IEEE-754), which would otherwise fall
    // through to a plain copy-cycle instead of continuing the arithmetic series.
    const stepEps = Math.max(1e-9, Math.abs(step) * 1e-9);
    const constantStep =
      source.length >= 2 &&
      nums.every((n, i) => i === 0 || Math.abs(n - nums[i - 1]! - step) <= stepEps);
    if (source.length === 1 || constantStep) {
      const delta = source.length === 1 ? 0 : step;
      const out: number[] = [];
      let last = nums[nums.length - 1]!;
      for (let i = 0; i < length; i++) {
        last = source.length === 1 ? nums[0]! : last + delta;
        out.push(round6(last));
      }
      return out;
    }
    // non-constant step → fall through to copy-cycle
  }

  // 2. Month / weekday cycles.
  const seqFill =
    cyclicSequenceFill(source, length, MONTHS) ??
    cyclicSequenceFill(source, length, MONTHS_SHORT) ??
    cyclicSequenceFill(source, length, DAYS) ??
    cyclicSequenceFill(source, length, DAYS_SHORT);
  if (seqFill) return seqFill;

  // 3. Single "text<number>" → increment the trailing number (keep zero-pad width).
  if (source.length === 1 && typeof source[0] !== "number") {
    const match = String(source[0]).match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1]!;
      const pad = match[2]!.length;
      let n = parseInt(match[2]!, 10);
      const out: string[] = [];
      for (let i = 0; i < length; i++) {
        n += 1;
        out.push(prefix + String(n).padStart(pad, "0"));
      }
      return out;
    }
  }

  // 4. Default: repeat the source pattern.
  const out: FillValue[] = [];
  for (let i = 0; i < length; i++) out.push(source[i % source.length]!);
  return out;
}
