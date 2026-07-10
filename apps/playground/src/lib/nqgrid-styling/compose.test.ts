import { describe, expect, it } from "vitest";
import {
  buildBodyClass,
  buildGridBodyClass,
  buildPinnedBodyCellFill,
  buildPinnedRowFillClass,
  buildRowFillClass,
  buildTableClasses,
  nquiCardTablePreset,
  nquiSpreadsheetPreset,
  tableBodyClassFor,
  withBodyFillMode,
} from "./tokens";

/** Legacy `tableBodyClass` from src/styles/index.ts (solid). */
const LEGACY_TABLE_BODY_CLASS =
  "[&_td]:border-0 [&_td]:border-b [&_td]:border-border/40 [&_tr:last-child_td]:border-b-0 [&_tr:first-child_td:first-child]:rounded-tl-xl [&_tr:first-child_td:last-child]:rounded-tr-xl [&_tr:last-child_td:first-child]:rounded-bl-xl [&_tr:last-child_td:last-child]:rounded-br-xl [&_tr:hover>td:not([data-row-header])]:bg-muted/40 [&_tr[data-state=selected]>td:not([data-row-header])]:bg-muted/50 [&_td]:bg-background";

/** Legacy `gridBodyHoverClass` from apps/playground grid-styles.ts */
const LEGACY_GRID_BODY_HOVER =
  "[&_tr:hover>td:not([data-row-header]):not([data-pinned])]:bg-muted/40 [&_tr[data-state=selected]>td:not([data-row-header]):not([data-pinned])]:bg-muted/50";

describe("nquiCardTablePreset", () => {
  it("buildBodyClass matches legacy tableBodyClass for solid fill", () => {
    const tokens = nquiCardTablePreset();
    expect(buildBodyClass(tokens)).toBe(LEGACY_TABLE_BODY_CLASS);
    expect(tableBodyClassFor(tokens)).toBe(LEGACY_TABLE_BODY_CLASS);
  });

  it("striped fill uses alternate row surfaces", () => {
    const tokens = withBodyFillMode(nquiCardTablePreset(), "striped");
    const body = buildBodyClass(tokens);
    expect(body).toContain("[&>tr:nth-child(odd)>td]:bg-background");
    expect(body).toContain("[&>tr:nth-child(even)>td]:bg-foreground/5");
    expect(body).toContain("[&_tr:hover>td:not([data-row-header])]:bg-muted/40");
  });

  it("buildRowFillClass alternates by row index", () => {
    const striped = withBodyFillMode(nquiCardTablePreset(), "striped");
    expect(buildRowFillClass(striped, 0)).toBe("bg-background");
    expect(buildRowFillClass(striped, 1)).toBe("bg-foreground/5");
    const solid = nquiCardTablePreset();
    expect(buildRowFillClass(solid, 0)).toBe("bg-background");
  });

  it("buildTableClasses exposes pinned fills", () => {
    const bundle = buildTableClasses(nquiCardTablePreset());
    expect(bundle.pinnedHeadFill).toBe("bg-card");
    // Opaque base so sticky cells don't bleed; hover/selected overlays are
    // color-mixed onto [data-pinned] in consumer CSS (no class-level lock).
    expect(bundle.pinnedBodyFill).toBe("bg-background");
    expect(bundle.gridRowHeaderPinnedHeadFill).toBe(
      "bg-[color-mix(in_oklab,var(--foreground)_10%,var(--card))]",
    );
    expect(bundle.gridRowHeaderPinnedBodyFill).toBe(
      "bg-[color-mix(in_oklab,var(--foreground)_6%,var(--card))]",
    );
  });
});

describe("nquiSpreadsheetPreset", () => {
  it("buildGridBodyClass matches legacy grid hover + selection", () => {
    const tokens = nquiSpreadsheetPreset();
    const body = buildGridBodyClass(tokens);
    expect(body).toContain(LEGACY_GRID_BODY_HOVER);
  });

  it("pinned data columns use an opaque base without a hover lock", () => {
    const bundle = buildTableClasses(nquiSpreadsheetPreset());
    expect(bundle.pinnedHeadFill).toBe("bg-card");
    // No `hover:!bg-card` — the lock froze the pinned column's row state.
    // Hover/selected now come from the [data-pinned] color-mix CSS.
    expect(bundle.pinnedBodyFill).toBe("bg-card");
  });

  it("row header gutter uses translucent unpinned and opaque pinned fills", () => {
    const tokens = nquiSpreadsheetPreset();
    expect(tokens.rowHeader.headFill).toMatch(/\/\d+/);
    expect(tokens.rowHeader.bodyFill).toMatch(/\/\d+/);
    expect(tokens.rowHeader.pinnedHeadFill).toBe(
      "bg-[color-mix(in_oklab,var(--foreground)_10%,var(--card))]",
    );
    expect(tokens.rowHeader.pinnedBodyFill).toBe(
      "bg-[color-mix(in_oklab,var(--foreground)_6%,var(--card))]",
    );
    expect(tokens.rowHeader.pinnedHeadFill).not.toMatch(/\/\d+/);
  });

  it("buildPinnedRowFillClass matches row stripes with opaque even pinned fill", () => {
    const striped = withBodyFillMode(nquiCardTablePreset(), "striped");
    expect(buildPinnedRowFillClass(striped, 0)).toBe("bg-background");
    expect(buildPinnedRowFillClass(striped, 1)).toBe(
      "bg-[color-mix(in_oklab,var(--foreground)_5%,var(--card))]",
    );
    // No hover lock — pinned hover/selected come from the consumer's opaque
    // [data-pinned] overlay CSS so the column tracks row state.
    expect(buildPinnedBodyCellFill(striped, 1)).toBe(
      "bg-[color-mix(in_oklab,var(--foreground)_5%,var(--card))]",
    );
    expect(buildPinnedBodyCellFill(striped, 1)).not.toContain("hover:");
  });
});
