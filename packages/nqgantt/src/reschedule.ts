import {
  addDays,
  addMonths,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
} from "./date-utils";
import type { ZoomUnit } from "./time-scale";

export type DragMode = "move" | "resize-start" | "resize-end";

function unitStart(d: Date, unit: ZoomUnit): Date {
  switch (unit) {
    case "day":
      return startOfDay(d);
    case "week":
      return startOfWeek(d);
    case "month":
      return startOfMonth(d);
    case "quarter":
      return startOfQuarter(d);
  }
}

function nextUnit(d: Date, unit: ZoomUnit): Date {
  switch (unit) {
    case "day":
      return addDays(d, 1);
    case "week":
      return addDays(d, 7);
    case "month":
      return addMonths(d, 1);
    case "quarter":
      return addMonths(d, 3);
  }
}

/** Snap a date to the nearest boundary of `unit` (round half up to the next boundary). */
export function snapDate(date: Date, unit: ZoomUnit): Date {
  const floor = unitStart(date, unit);
  const ceil = nextUnit(floor, unit);
  const mid = floor.getTime() + (ceil.getTime() - floor.getTime()) / 2;
  return date.getTime() >= mid ? ceil : floor;
}

export interface RescheduleArgs {
  readonly start: Date;
  readonly end: Date;
  /** Time delta (ms) from the drag, typically `scale.toDuration(deltaX)`. */
  readonly deltaMs: number;
  readonly mode: DragMode;
  /** Granularity to snap moved endpoints to (default `"day"`). */
  readonly snapUnit?: ZoomUnit;
}

/**
 * Convert a drag into new **dates (raw)** — the single source of truth both the gantt and
 * the table re-derive from. Never returns pixel positions. `move` shifts both endpoints by
 * the same amount (preserving duration); resizes move a single edge and clamp so the bar
 * keeps a non-negative width.
 */
export function rescheduleInterval({
  start,
  end,
  deltaMs,
  mode,
  snapUnit = "day",
}: RescheduleArgs): { start: Date; end: Date } {
  if (mode === "move") {
    const duration = end.getTime() - start.getTime();
    const nextStart = snapDate(new Date(start.getTime() + deltaMs), snapUnit);
    return { start: nextStart, end: new Date(nextStart.getTime() + duration) };
  }

  if (mode === "resize-start") {
    let nextStart = snapDate(new Date(start.getTime() + deltaMs), snapUnit);
    if (nextStart.getTime() > end.getTime()) nextStart = new Date(end.getTime());
    return { start: nextStart, end };
  }

  // resize-end
  let nextEnd = snapDate(new Date(end.getTime() + deltaMs), snapUnit);
  if (nextEnd.getTime() < start.getTime()) nextEnd = new Date(start.getTime());
  return { start, end: nextEnd };
}
