import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildPivotModel } from "../core/pivot/build-model";
import type { PivotSpec } from "../core/pivot/types";
import { pivotBodyGroups, pivotPageBodySegments } from "./layout";
import { PivotTable } from "./pivot-table";

/** Two sections × `lines` lines (+ section subtotal rows) and a grand total. */
function longModel(lines: number, layout: "compact" | "tabular" = "tabular", sections = 2) {
  const rows = [];
  for (let s = 0; s < sections; s++) for (let l = 0; l < lines; l++) rows.push({ SECTION: `Section ${s}`, LINE: `Account ${s}-${String(l).padStart(2, "0")}`, ACT: 1000 + l });
  const spec: PivotSpec = { version: 1, layout, rows: [{ field: "SECTION", subtotal: "end" }, { field: "LINE" }], measures: [{ id: "a", field: "ACT" }] };
  return buildPivotModel(spec, rows);
}

const opts = { pageHeight: 700, headHeight: 40, rowHeight: 30 } as const; // 22 rows on a fresh page

describe("pivotPageBodySegments (print pagination)", () => {
  it("keeps groups that fit whole and moves a group that fits a fresh page to the next page", () => {
    const model = longModel(12); // 2 × (group row + 12 lines + subtotal) = 2 × 14 rows, + grand total
    const segments = pivotPageBodySegments(model, opts);
    expect(segments.map((s) => [s.start, s.end, s.breakBefore ?? false, s.continued ?? false])).toEqual([
      [0, 14, false, false],
      [14, 28, true, false],
      [28, 29, false, false],
    ]);
    expect(pivotPageBodySegments(model, { ...opts, pageHeight: 10_000 })).toEqual(pivotBodyGroups(model));
  });

  it("splits a group taller than a page, starting on the first page (no blank first page)", () => {
    const model = longModel(45); // 47 rows per section
    const segments = pivotPageBodySegments(model, { ...opts, firstPageOffset: 60 });
    // First page: 700 - 60 - 40 = 600 px → 20 rows; continuation pages: 22 rows.
    expect(segments[0]).toMatchObject({ start: 0, end: 20 });
    expect(segments[0]!.breakBefore).toBeUndefined();
    expect(segments[1]).toMatchObject({ start: 20, end: 42, breakBefore: true, continued: true });
    // The last two rows of the section (last line + subtotal) never leave the subtotal alone.
    const ends = segments.filter((s) => s.end === 47);
    expect(ends).toHaveLength(1);
    expect(ends[0]!.end - ends[0]!.start).toBeGreaterThanOrEqual(2);
    // Every row is printed exactly once, in order.
    expect(segments.flatMap((s) => Array.from({ length: s.end - s.start }, (_, i) => s.start + i))).toEqual(model.rows.map((_, i) => i));
    for (const s of segments) expect(s.end - s.start).toBeLessThanOrEqual(22);
  });

  it("counts repeated label rows on continuation pages", () => {
    const model = longModel(45, "compact");
    const segments = pivotPageBodySegments(model, { ...opts, continuationHeight: () => 30 });
    expect(segments[1]).toMatchObject({ continued: true });
    expect(segments[1]!.end - segments[1]!.start).toBe(21); // 22 rows minus the "(cont.)" row
  });
});

describe("PivotTable static pagination", () => {
  const html = (model: ReturnType<typeof longModel>) =>
    renderToStaticMarkup(createElement(PivotTable, { model, mode: "static", rowHeight: 30, pagination: { pageHeight: 700, firstPageOffset: 60 } }));

  it("compact: repeats the section label on continuation pages and marks explicit page breaks", () => {
    const out = html(longModel(45, "compact"));
    expect(out).toContain("Section 0 (cont.)");
    expect(out).toContain("Section 1 (cont.)");
    expect(out.indexOf('data-nqg-page-break=""')).toBeGreaterThan(out.indexOf("Account 0-00"));
    expect((out.match(/data-kind="continued"/g) ?? []).length).toBe((out.match(/data-nqg-continued=""/g) ?? []).length);
  });

  it("tabular: redraws the section span cell at the top of each continuation page", () => {
    const out = html(longModel(45));
    const continued = out.split("<tbody").filter((t) => t.includes('data-nqg-continued=""'));
    expect(continued.length).toBeGreaterThan(1);
    for (const t of continued) expect(t).toMatch(/<th scope="rowgroup" rowSpan="\d+"[^>]*>.*Section \d \(cont\.\)/);
  });

  it("without pagination prints one tbody per top-level group, without badges or header icons", () => {
    const model = longModel(3, "compact");
    const out = renderToStaticMarkup(createElement(PivotTable, { model, mode: "static" }));
    expect((out.match(/<tbody/g) ?? []).length).toBe(pivotBodyGroups(model).length);
    expect(out).not.toContain("data-nqg-page-break");
    expect(out).not.toContain("nqg-pivot-count");
    expect(renderToStaticMarkup(createElement(PivotTable, { model, mode: "static", countBadges: true }))).toContain("nqg-pivot-count");
  });
});
