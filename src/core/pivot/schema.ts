import exportRequestSchema from "../../../contract/pivot/v1/export-request.schema.json";
import schema from "../../../contract/pivot/v1/pivot-spec.schema.json";

/** JSON Schema (draft 2020-12) for `PivotSpec` v1 — the same file non-JS producers validate against. */
export const PIVOT_SPEC_JSON_SCHEMA: Readonly<Record<string, unknown>> = schema;

/**
 * JSON Schema (draft 2020-12) for `PivotExportRequest` v1. Its `spec` is a `$ref` to
 * `pivot-spec.schema.json` (resolved by `$id`), so register both schemas with your validator.
 */
export const PIVOT_EXPORT_REQUEST_JSON_SCHEMA: Readonly<Record<string, unknown>> = exportRequestSchema;
