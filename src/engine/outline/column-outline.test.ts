import { describe, expect, it } from "vitest";

import {
  buildColumnOutlineGroups,
  flattenOutlineHeaderRows,
  resolveVisibleLeafColumnIds,
  toggleOutlineGroup,
} from "./column-outline";

const tree = [
  {
    id: "q1",
    label: "Q1",
    children: [
      { id: "jan", label: "Jan", leafColumnIds: ["jan-a", "jan-b"] },
      { id: "feb", label: "Feb", leafColumnIds: ["feb-a", "feb-b"] },
    ],
  },
  {
    id: "q2",
    label: "Q2",
    leafColumnIds: ["q2-a", "q2-b"],
  },
] as const;

describe("resolveVisibleLeafColumnIds", () => {
  const all = ["jan-a", "jan-b", "feb-a", "feb-b", "q2-a", "q2-b"];
  const groups = buildColumnOutlineGroups(tree);

  it("returns all leaves when nothing collapsed", () => {
    expect(resolveVisibleLeafColumnIds(all, groups, new Set())).toEqual(all);
  });

  it("hides non-summary leaves when Q1 collapsed", () => {
    const visible = resolveVisibleLeafColumnIds(all, groups, new Set(["q1"]));
    expect(visible).toContain("jan-a");
    expect(visible).not.toContain("jan-b");
    expect(visible).not.toContain("feb-a");
  });
});

describe("flattenOutlineHeaderRows", () => {
  it("produces multi-row header cells", () => {
    const rows = flattenOutlineHeaderRows(tree, new Set());
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0]!.some((c) => c.id === "q1")).toBe(true);
  });

  it("counts only visible leaves so an ancestor colSpan shrinks when a nested group collapses", () => {
    // R ⊃ C(3 leaves). Collapsing C must make both C and the root R span 1,
    // so header rows agree on width.
    const nested = [
      {
        id: "R",
        label: "Root",
        children: [{ id: "C", label: "Child", leafColumnIds: ["c1", "c2", "c3"] }],
      },
    ] as const;

    const expanded = flattenOutlineHeaderRows(nested, new Set());
    expect(expanded[0]!.find((c) => c.id === "R")!.colSpan).toBe(3);
    expect(expanded[1]!.find((c) => c.id === "C")!.colSpan).toBe(3);

    const collapsed = flattenOutlineHeaderRows(nested, new Set(["C"]));
    expect(collapsed[0]!.find((c) => c.id === "R")!.colSpan).toBe(1);
    expect(collapsed[1]!.find((c) => c.id === "C")!.colSpan).toBe(1);
  });
});

describe("toggleOutlineGroup", () => {
  it("toggles membership", () => {
    const next = toggleOutlineGroup(new Set(), "q1");
    expect(next.has("q1")).toBe(true);
    expect(toggleOutlineGroup(next, "q1").has("q1")).toBe(false);
  });
});
