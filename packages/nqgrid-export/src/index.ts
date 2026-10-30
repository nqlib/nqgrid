/**
 * `@nqlib/nqgrid-export` — export nqgrid pivots (`PivotSpec` + rows) to PDF (Playwright Chromium),
 * XLSX (exceljs) or standalone HTML, from Node, the `nqgrid-export` CLI or its HTTP serve mode.
 */
export * from "./errors";
export * from "./request";
export * from "./exporter";
export * from "./pdf";
export * from "./xlsx";
export * from "./serve";
export { main, CLI_USAGE, type CliIo } from "./main";
export { NQGRID_EXPORT_VERSION } from "./version";
