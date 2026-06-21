import { describe, expect, it } from "vitest";

import { createTimeScale, recommendedWidth } from "./time-scale";

const start = new Date("2026-05-01T00:00:00Z");
const end = new Date("2026-06-01T00:00:00Z");

describe("createTimeScale", () => {
  it("maps endpoints to 0 and width", () => {
    const s = createTimeScale({ start, end, width: 1000, unit: "week" });
    expect(s.toX(start)).toBe(0);
    expect(s.toX(end)).toBe(1000);
  });

  it("is invertible (toX ∘ toDate)", () => {
    const s = createTimeScale({ start, end, width: 800, unit: "week" });
    const mid = new Date("2026-05-16T12:00:00Z");
    const x = s.toX(mid);
    expect(s.toDate(x).getTime()).toBeCloseTo(mid.getTime(), -2);
  });

  it("converts pixels to duration and back", () => {
    const s = createTimeScale({ start, end, width: 620, unit: "day" });
    const px = 200;
    expect(s.toPixels(s.toDuration(px))).toBeCloseTo(px, 6);
  });

  it("emits ticks within the window, ascending by x", () => {
    const s = createTimeScale({ start, end, width: 620, unit: "week" });
    const ticks = s.ticks("en-US");
    expect(ticks.length).toBeGreaterThan(0);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]!.x).toBeGreaterThan(ticks[i - 1]!.x);
    }
    expect(ticks[0]!.x).toBeGreaterThanOrEqual(0);
    expect(ticks.at(-1)!.x).toBeLessThanOrEqual(620);
  });
});

describe("recommendedWidth", () => {
  it("grows with zoom granularity (day wider than quarter)", () => {
    const day = recommendedWidth(start, end, "day");
    const quarter = recommendedWidth(start, end, "quarter");
    expect(day).toBeGreaterThan(quarter);
  });
});
