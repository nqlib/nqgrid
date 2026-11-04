/**
 * `@nqlib/nqgrid/core` — framework-free engine: no React, TanStack or DOM.
 * Runs unchanged in the browser, a Tauri webview and Node (export/CLI).
 *
 * The pure table helpers live here; `src/engine/<domain>/` re-exports them for
 * the React layer (the 0.2.0 import paths keep working).
 */
export * from "./paging";
export * from "./pinned-layout";
export * from "./clipboard-tsv";
export * from "./group-by-tree";
export * from "./col-span-frozen";
export * from "./row-reorder";
export * from "./format-types";
export * from "./rich-value-format";
export * from "./pivot";
