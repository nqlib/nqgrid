import { describe, expect, it } from "vitest";

import { DAY_MS } from "./date-utils";
import { rescheduleInterval, snapDate } from "./reschedule";

const start = new Date("2026-05-04T00:00:00"); // a Monday
const end = new Date("2026-05-08T00:00:00");

describe("snapDate", () => {
  it("snaps to the nearest day boundary", () => {
    const nearStart = snapDate(new Date("2026-05-04T05:00:00"), "day");
    expect(nearStart.getTime()).toBe(new Date("2026-05-04T00:00:00").getTime());
    const nearNext = snapDate(new Date("2026-05-04T20:00:00"), "day");
    expect(nearNext.getTime()).toBe(new Date("2026-05-05T00:00:00").getTime());
  });
});

describe("rescheduleInterval", () => {
  it("move preserves duration and snaps", () => {
    const next = rescheduleInterval({ start, end, deltaMs: 2 * DAY_MS, mode: "move", snapUnit: "day" });
    expect(next.end.getTime() - next.start.getTime()).toBe(end.getTime() - start.getTime());
    expect(next.start.getTime()).toBe(new Date("2026-05-06T00:00:00").getTime());
  });

  it("resize-end extends only the end", () => {
    const next = rescheduleInterval({ start, end, deltaMs: 3 * DAY_MS, mode: "resize-end", snapUnit: "day" });
    expect(next.start.getTime()).toBe(start.getTime());
    expect(next.end.getTime()).toBe(new Date("2026-05-11T00:00:00").getTime());
  });

  it("resize-start clamps so width never goes negative", () => {
    const next = rescheduleInterval({ start, end, deltaMs: 30 * DAY_MS, mode: "resize-start", snapUnit: "day" });
    expect(next.start.getTime()).toBeLessThanOrEqual(next.end.getTime());
  });
});
