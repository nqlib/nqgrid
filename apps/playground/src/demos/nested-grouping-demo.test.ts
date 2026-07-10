import { describe, expect, it } from "vitest";
import { buildDealsFlat, DEALS, type DealRow } from "./nested-grouping-demo";
import type { GroupRow } from "@nqlib/nqgrid";

const isGroup = (row: DealRow | GroupRow<DealRow>): row is GroupRow<DealRow> =>
  typeof row === "object" && row !== null && "type" in row && row.type === "group";

/** Every group id, walking region -> stage with everything expanded. */
function allGroupIds(): Set<string> {
  const ids = new Set<string>();
  const regions = new Map<string, DealRow[]>();
  for (const d of DEALS) (regions.get(d.region) ?? regions.set(d.region, []).get(d.region)!).push(d);
  for (const [region, rows] of regions) {
    ids.add(region);
    const stages = new Set(rows.map((r) => r.stage));
    for (const stage of stages) ids.add(`${region}::${stage}`);
  }
  return ids;
}

describe("buildDealsFlat", () => {
  it("fully expanded: group rows at depth 0 and 1, plus all leaf rows", () => {
    const flat = buildDealsFlat(allGroupIds());

    const depth0Groups = flat.filter((r) => isGroup(r) && r.depth === 0);
    const depth1Groups = flat.filter((r) => isGroup(r) && r.depth === 1);
    const leaves = flat.filter((r) => !isGroup(r));

    // 3 regions
    expect(depth0Groups.length).toBe(3);
    // stage groups: East{Won,Open}=2, West{Won,Open,Lost}=3, North{Won,Open}=2 = 7
    expect(depth1Groups.length).toBe(7);
    // all source rows appear as leaves
    expect(leaves.length).toBe(DEALS.length);
  });

  it("collapsing the top-level region changes the flat length", () => {
    const expandedAll = allGroupIds();
    const fullLength = buildDealsFlat(expandedAll).length;

    // Drop the "East" region id (and its descendant stage groups under East).
    const collapsedEast = new Set(
      [...expandedAll].filter((id) => id !== "East" && !id.startsWith("East::")),
    );
    const collapsedLength = buildDealsFlat(collapsedEast).length;

    expect(collapsedLength).toBeLessThan(fullLength);
    // East still appears once as a collapsed group header.
    const eastHeaders = buildDealsFlat(collapsedEast).filter(
      (r) => isGroup(r) && r.depth === 0 && r.groupKey === "East",
    );
    expect(eastHeaders.length).toBe(1);
  });
});
