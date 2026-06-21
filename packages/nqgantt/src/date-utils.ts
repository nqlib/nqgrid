import type { DateLike } from "@nqlib/nqgrid/advanced";

export const DAY_MS = 86_400_000;

export function toDate(value: DateLike): Date {
  return value instanceof Date ? value : new Date(value);
}

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + n);
  return out;
}

/** Monday-based week start. */
export function startOfWeek(d: Date): Date {
  const out = startOfDay(d);
  const day = (out.getDay() + 6) % 7; // 0 = Monday
  return addDays(out, -day);
}

export function startOfMonth(d: Date): Date {
  const out = startOfDay(d);
  out.setDate(1);
  return out;
}

export function startOfQuarter(d: Date): Date {
  const out = startOfMonth(d);
  out.setMonth(Math.floor(out.getMonth() / 3) * 3);
  return out;
}
