import {
  buildBodyChromeClass,
  buildGridBodyClass,
  buildTableClasses,
  createTableTokens,
  tableTokensForPreset,
  withBodyFillMode,
  type PartialTableColorTokens,
  type TableBodyFillMode,
  type TableClassBundle,
  type TableColorTokens,
  type TableTokenPreset,
} from "./nqgrid-styling";
import type { NqgridLibraryConfig } from "./nqgrid-styling";

/** Playground-wide defaults merged before user overrides from library config. */
export const PLAYGROUND_TOKEN_DEFAULTS: PartialTableColorTokens = {};

/** Resolve card or spreadsheet tokens from playground config + defaults. */
export function resolvePlaygroundTableColorTokens(
  config?: NqgridLibraryConfig,
  presetOverride?: TableTokenPreset,
): TableColorTokens {
  const preset = presetOverride ?? config?.styles?.tablePreset ?? "card";
  const base = tableTokensForPreset(preset);
  const merged = createTableTokens(base, PLAYGROUND_TOKEN_DEFAULTS);
  const withUser = createTableTokens(merged, config?.styles?.tableColorOverrides);
  const fill = config?.styles?.tableBodyFill ?? "solid";
  return withBodyFillMode(withUser, preset === "spreadsheet" && fill === "solid" ? "none" : fill);
}

export function resolvePlaygroundTableClassBundle(config?: NqgridLibraryConfig): TableClassBundle {
  return buildTableClasses(resolvePlaygroundTableColorTokens(config));
}

export function resolvePlaygroundTableBodyChromeClass(config?: NqgridLibraryConfig): string {
  return buildBodyChromeClass(resolvePlaygroundTableColorTokens(config));
}

export function resolvePlaygroundGridBodyClass(config?: NqgridLibraryConfig): string {
  return buildGridBodyClass(resolvePlaygroundTableColorTokens(config, "spreadsheet"));
}

/** Playground card-table tokens — tweak PLAYGROUND_TOKEN_DEFAULTS or library config. */
export const playgroundCardTokens = resolvePlaygroundTableColorTokens({
  styles: { tablePreset: "card", tableBodyFill: "solid" },
});

/** Playground spreadsheet tokens. */
export const playgroundSpreadsheetTokens = resolvePlaygroundTableColorTokens(
  { styles: { tableBodyFill: "solid" } },
  "spreadsheet",
);

/**
 * Canonical analytics grid — SSOT: `virtual-data-demo.tsx`.
 * Grid chrome (header, cells, gutter, pins) uses the spreadsheet preset via `grid-styles.ts`.
 * Row fills use the card preset fill mode from library config (`neutralTanStackRowFillClass`).
 */
export const playgroundVirtualDataGridTokens = playgroundSpreadsheetTokens;
export const playgroundVirtualDataGridBundle = buildTableClasses(playgroundVirtualDataGridTokens);

export function resolvePlaygroundVirtualDataGridTokens(config?: NqgridLibraryConfig) {
  return resolvePlaygroundTableColorTokens(config, "spreadsheet");
}

export function resolvePlaygroundVirtualDataGridBundle(config?: NqgridLibraryConfig) {
  return buildTableClasses(resolvePlaygroundVirtualDataGridTokens(config));
}

/** Row stripe/solid tokens for virtual-data `<tr>` fills. */
export function resolvePlaygroundVirtualDataRowFillTokens(config?: NqgridLibraryConfig) {
  return resolvePlaygroundTableColorTokens(config, "card");
}

export const playgroundCardBundle = buildTableClasses(playgroundCardTokens);
export const playgroundSpreadsheetBundle = buildTableClasses(playgroundSpreadsheetTokens);
/** @deprecated Use playgroundVirtualDataGridBundle — same bundle, clearer name. */
export const playgroundVirtualDataBundle = playgroundVirtualDataGridBundle;

export function playgroundCardTokensForFill(fill: Exclude<TableBodyFillMode, "none">): TableColorTokens {
  return resolvePlaygroundTableColorTokens({ styles: { tablePreset: "card", tableBodyFill: fill } });
}

export function playgroundCardBundleForFill(fill: Exclude<TableBodyFillMode, "none">): TableClassBundle {
  return buildTableClasses(playgroundCardTokensForFill(fill));
}

export function playgroundCardBodyClassForFill(fill: Exclude<TableBodyFillMode, "none">): string {
  return playgroundCardBundleForFill(fill).body;
}

export const playgroundSpreadsheetBodyClass = resolvePlaygroundGridBodyClass({
  styles: { tablePreset: "spreadsheet" },
});
