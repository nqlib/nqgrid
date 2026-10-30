import { describe, expect, it } from "vitest";
import { formatEsmImportBlocks, resolveNqgridImportPlan } from "./resolve-imports";

describe("resolveNqgridImportPlan", () => {
  it("merges named exports for a single entry", () => {
    const plan = resolveNqgridImportPlan(["styles.tokens"]);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.entry).toBe("@nqlib/nqgrid/styles");
    expect(plan[0]?.names).toContain("tableShellClass");
    expect(plan[0]?.names).toContain("tableBodyClassFor");
  });

  it("dedupes when multiple features share an entry", () => {
    const plan = resolveNqgridImportPlan(["engine.headless"]);
    const names = plan.find((m) => m.entry === "@nqlib/nqgrid/engine")?.names ?? [];
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("usePinnedTableColumns");
  });
});

describe("formatEsmImportBlocks", () => {
  it("formats sorted import lines", () => {
    const plan = resolveNqgridImportPlan(["fixtures.dashboard", "styles.tokens"]);
    const s = formatEsmImportBlocks(plan);
    expect(s).toContain(`from "@nqlib/nqgrid/fixtures"`);
    expect(s).toContain(`from "@nqlib/nqgrid/styles"`);
  });

  it("plans the pivot React entry", () => {
    const plan = resolveNqgridImportPlan(["core.pivot", "pivot.react"]);
    expect(plan.map((m) => m.entry)).toEqual(["@nqlib/nqgrid/core", "@nqlib/nqgrid/pivot"]);
    expect(plan[1]?.names).toContain("usePivotGrid");
  });

  it("plans the static pivot renderer entry", () => {
    const plan = resolveNqgridImportPlan(["pivot.renderStatic"]);
    expect(plan.map((m) => m.entry)).toEqual(["@nqlib/nqgrid/render-static"]);
    expect(plan[0]?.names).toContain("renderPivotHtml");
  });

  it("includes root package entry for component features", () => {
    const plan = resolveNqgridImportPlan(["components.tablePercentBattery"]);
    expect(plan.some((m) => m.entry === "@nqlib/nqgrid" && m.names.includes("TablePercentBattery"))).toBe(true);
  });
});
