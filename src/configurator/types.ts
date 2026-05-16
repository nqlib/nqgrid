import type { TableBodyFill } from "../styles";

/**
 * Optional knobs your app owns when composing nqgrid **tokens** with `@nqlib/nqui` / TanStack.
 * This object is documentation-first: only `styles.tableBodyFill` is consumed by helpers below.
 */
export interface NqgridLibraryStylesConfig {
  /** Maps to `tableBodyClassFor(fill)` on your `TableBody` / `<tbody>`. */
  tableBodyFill?: TableBodyFill;
  /**
   * Optional progress / percent column presentation (app-owned; used by playground demos).
   * `'battery'` composes `TablePercentBattery` with `tablePercentBattery*` style tokens.
   */
  percentProgressDisplay?: "plain" | "battery";
}

/** Optional engine hints (TanStack wiring stays in your app; these are common inputs). */
export interface NqgridLibraryEngineConfig {
  /** Left-pinned column ids (prefix of visible leaf order). */
  pinnedLeftIds?: readonly string[];
  /** Pixel widths for pinned metrics (`usePinnedTableColumns`). */
  pinnedWidthOverrides?: Record<string, number>;
}

/** Single object you can keep in React context or app config. */
export interface NqgridLibraryConfig {
  styles?: NqgridLibraryStylesConfig;
  engine?: NqgridLibraryEngineConfig;
}

export function defaultNqgridLibraryConfig(): NqgridLibraryConfig {
  return {
    styles: { tableBodyFill: "solid", percentProgressDisplay: "battery" },
    engine: {},
  };
}

export function mergeNqgridLibraryConfig(
  base: NqgridLibraryConfig,
  patch: Partial<NqgridLibraryConfig>,
): NqgridLibraryConfig {
  return {
    styles: { ...base.styles, ...patch.styles },
    engine: { ...base.engine, ...patch.engine },
  };
}
