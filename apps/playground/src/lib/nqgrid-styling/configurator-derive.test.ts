import { describe, expect, it } from "vitest";
import {
  gridBodyClassFromLibraryConfig,
  resolveTableColorTokens,
  tableBodyClassFromLibraryConfig,
  tableClassBundleFromLibraryConfig,
} from "./configurator-derive";
import { defaultNqgridLibraryConfig } from "./configurator-types";

describe("resolveTableColorTokens", () => {
  it("defaults to card preset with solid fill", () => {
    const tokens = resolveTableColorTokens(defaultNqgridLibraryConfig());
    expect(tokens.body.fillMode).toBe("solid");
    expect(tokens.shell.bg).toBe("bg-card");
  });

  it("applies spreadsheet preset", () => {
    const tokens = resolveTableColorTokens({
      styles: { tablePreset: "spreadsheet" },
    });
    expect(tokens.shell.bg).toBe("bg-card");
    expect(tokens.body.rowHover).toContain("bg-muted/40");
  });
});

describe("tableBodyClassFromLibraryConfig", () => {
  it("includes muted hover for card preset", () => {
    const body = tableBodyClassFromLibraryConfig(defaultNqgridLibraryConfig());
    expect(body).toContain("[&_tr:hover>td:not([data-row-header])]:bg-muted/40");
    expect(body).toContain("[&_td]:bg-background");
  });

  it("striped fill alternates row surfaces", () => {
    const body = tableBodyClassFromLibraryConfig({
      styles: { tableBodyFill: "striped" },
    });
    expect(body).toContain("[&>tr:nth-child(odd)>td]:bg-background");
    expect(body).toContain("[&>tr:nth-child(even)>td]:bg-foreground/5");
  });
});

describe("tableClassBundleFromLibraryConfig", () => {
  it("returns pinned fills", () => {
    const bundle = tableClassBundleFromLibraryConfig();
    expect(bundle.pinnedHeadFill).toBe("bg-card");
  });
});

describe("gridBodyClassFromLibraryConfig", () => {
  it("uses spreadsheet hover semantics", () => {
    const body = gridBodyClassFromLibraryConfig();
    expect(body).toContain("[&_tr:hover>td:not([data-row-header]):not([data-pinned])]:bg-muted/40");
  });
});
