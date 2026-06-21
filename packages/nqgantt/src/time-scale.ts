import type { DateLike } from "@nqlib/nqgrid/advanced";

import {
  addDays,
  addMonths,
  DAY_MS,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  toDate,
} from "./date-utils";

export type ZoomUnit = "day" | "week" | "month" | "quarter";

export interface TimeTick {
  readonly date: Date;
  readonly x: number;
  readonly label: string;
}

/**
 * A pure, invertible mapping from dates to x-pixels over a fixed `[start, end]` window.
 * This is the gantt's analog of the table's column widths — geometry is always derived
 * from this scale at render time, never stored.
 */
export interface TimeScale {
  readonly start: Date;
  readonly end: Date;
  readonly width: number;
  readonly unit: ZoomUnit;
  /** date → x (pixels from the left edge of the time area). */
  toX(date: DateLike): number;
  /** x → date (the inverse of `toX`, used to convert a drag back into dates). */
  toDate(x: number): Date;
  /** pixels → milliseconds duration (drag delta → time delta). */
  toDuration(px: number): number;
  /** milliseconds → pixels. */
  toPixels(ms: number): number;
  /** Boundary ticks for the current unit, with positioned x and a localized label. */
  ticks(locale?: string): TimeTick[];
}

/** Target pixels-per-day at each zoom unit — sets the natural content width. */
export function pxPerDayForUnit(unit: ZoomUnit): number {
  switch (unit) {
    case "day":
      return 40;
    case "week":
      return 16;
    case "month":
      return 5;
    case "quarter":
      return 2.4;
  }
}

function domainDays(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
}

/** Content width (px) that gives one screenful of detail at the given zoom. */
export function recommendedWidth(start: DateLike, end: DateLike, unit: ZoomUnit, minWidth = 480): number {
  const days = domainDays(toDate(start), toDate(end));
  return Math.max(minWidth, Math.round(days * pxPerDayForUnit(unit)));
}

function stepBoundaries(start: Date, end: Date, unit: ZoomUnit): Date[] {
  const out: Date[] = [];
  let cursor: Date;
  switch (unit) {
    case "day":
      cursor = startOfDay(start);
      break;
    case "week":
      cursor = startOfWeek(start);
      break;
    case "month":
      cursor = startOfMonth(start);
      break;
    case "quarter":
      cursor = startOfQuarter(start);
      break;
  }
  const guard = 2000;
  for (let i = 0; cursor.getTime() <= end.getTime() && i < guard; i++) {
    if (cursor.getTime() >= start.getTime()) out.push(cursor);
    switch (unit) {
      case "day":
        cursor = addDays(cursor, 1);
        break;
      case "week":
        cursor = addDays(cursor, 7);
        break;
      case "month":
        cursor = addMonths(cursor, 1);
        break;
      case "quarter":
        cursor = addMonths(cursor, 3);
        break;
    }
  }
  return out;
}

function tickLabel(date: Date, unit: ZoomUnit, locale?: string): string {
  switch (unit) {
    case "day":
    case "week":
      return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
    case "month":
      return new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }).format(date);
    case "quarter":
      return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  }
}

export interface CreateTimeScaleArgs {
  readonly start: DateLike;
  readonly end: DateLike;
  readonly width: number;
  readonly unit: ZoomUnit;
}

export function createTimeScale({ start, end, width, unit }: CreateTimeScaleArgs): TimeScale {
  const startDate = toDate(start);
  const endDate = toDate(end);
  const startMs = startDate.getTime();
  const span = Math.max(1, endDate.getTime() - startMs);

  const toX = (date: DateLike): number => ((toDate(date).getTime() - startMs) / span) * width;

  return {
    start: startDate,
    end: endDate,
    width,
    unit,
    toX,
    toDate: (x) => new Date(startMs + (x / width) * span),
    toDuration: (px) => (px / width) * span,
    toPixels: (ms) => (ms / span) * width,
    ticks: (locale) =>
      stepBoundaries(startDate, endDate, unit).map((date) => ({
        date,
        x: toX(date),
        label: tickLabel(date, unit, locale),
      })),
  };
}
