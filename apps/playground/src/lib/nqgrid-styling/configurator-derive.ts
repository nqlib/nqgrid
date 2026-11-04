import {
  buildGridBodyClass,
  buildTableClasses,
  createTableTokens,
  tableBodyClassFor as tokenBodyClassFor,
  tableTokensForPreset,
  withBodyFillMode,
  type TableClassBundle,
  type TableColorTokens,
} from "./tokens";
import type { NqgridLibraryConfig } from "./configurator-types";

/** Resolve preset + overrides from library config into a token object. */
export function resolveTableColorTokens(config?: NqgridLibraryConfig): TableColorTokens {
  const preset = config?.styles?.tablePreset ?? "card";
  const base = tableTokensForPreset(preset);
  const merged = createTableTokens(base, config?.styles?.tableColorOverrides);
  const fill = config?.styles?.tableBodyFill ?? "solid";
  return withBodyFillMode(merged, fill);
}

/** Full class bundle from library config. */
export function tableClassBundleFromLibraryConfig(config?: NqgridLibraryConfig): TableClassBundle {
  return buildTableClasses(resolveTableColorTokens(config));
}

/** `TableBody` / `<tbody>` class string from library config. */
export function tableBodyClassFromLibraryConfig(config?: NqgridLibraryConfig): string {
  return tokenBodyClassFor(resolveTableColorTokens(config));
}

/** Spreadsheet grid tbody (hover + optional fill, no card corner radius). */
export function gridBodyClassFromLibraryConfig(config?: NqgridLibraryConfig): string {
  const tokens = resolveTableColorTokens({
    ...config,
    styles: { ...config?.styles, tablePreset: "spreadsheet" },
  });
  return buildGridBodyClass(tokens);
}
