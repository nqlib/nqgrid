import {
  buildPivotExportRequest,
  type BuildPivotExportRequestOptions,
  type PivotExportRequest,
} from "../core/pivot/export-request";
import type { PivotDataRow, PivotSpec } from "../core/pivot/types";

export interface PivotGridExportOptions extends BuildPivotExportRequestOptions {
  /**
   * Send the grid's rows with the spec (default `false`). In a Tauri app the backend usually owns
   * the data, so the default sends the spec plus a `dataset` reference and lets the backend
   * load the rows itself (smaller payload, no stale or partial data on the wire).
   */
  readonly includeRows?: boolean;
}

/**
 * "Export what I see": the grid's current spec (expanded groups, heat scope, …) as a
 * `PivotExportRequest`. Without `includeRows`, `dataset` defaults to `spec.id`.
 * Pure — pass `usePivotGrid()`'s result or any `{ spec, rows }`.
 *
 * ```ts
 * const request = pivotExportRequestFromGrid(grid, { format: "pdf", options: { theme: "light" } });
 * await invoke("export_pivot_report", { request });        // Tauri → Python backend
 * ```
 */
export function pivotExportRequestFromGrid(
  grid: { readonly spec: PivotSpec; readonly rows?: readonly PivotDataRow[] },
  { includeRows = false, format = "pdf", dataset, options }: PivotGridExportOptions = {},
): PivotExportRequest {
  if (includeRows && !grid.rows) throw new TypeError("includeRows needs grid.rows");
  const ref = dataset ?? (includeRows ? undefined : grid.spec.id);
  if (!includeRows && !ref) throw new TypeError("pass a dataset reference (the spec has no id) or includeRows: true");
  return buildPivotExportRequest(grid.spec, includeRows ? grid.rows : undefined, { format, options, dataset: ref });
}
