/**
 * `@nqlib/nqgrid/render-static` — standalone HTML for pivot models (print / PDF / email).
 * Renders the `@nqlib/nqgrid/pivot` components in static mode with `react-dom/server` and inlines
 * a self-contained stylesheet (no Tailwind, scripts, fonts or network). `nqgrid-export` turns the
 * result into PDF with Chromium; XLSX comes from `pivotModelToSheet` in `@nqlib/nqgrid/core`.
 */
export * from "./color";
export * from "./css";
export * from "./paging";
export * from "./render-html";
