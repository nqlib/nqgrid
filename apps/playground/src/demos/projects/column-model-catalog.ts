/**
 * Column type catalog — every field Linear/Jira expose, mapped to engine reality.
 * `available: true` means createDefaultRegistry() (+ demo `person`) can drive the column today.
 */
import type { ColumnSchema } from "@nqlib/nqgrid/engine";

export type ColumnTypeId =
  | "text"
  | "number"
  | "select"
  | "date"
  | "dateRange"
  | "person"
  | "multiSelect"
  | "checkbox"
  | "url"
  | "email"
  | "richText"
  | "formula"
  | "relation"
  | "file"
  | "rating"
  | "labels"
  | "rollup"
  | "dependency"
  | "duration";

export interface ColumnTypeCatalogEntry {
  readonly id: ColumnTypeId;
  readonly label: string;
  readonly description: string;
  readonly group: "basic" | "people" | "advanced";
  /** Registered in pmRegistry and shippable through column-types today. */
  readonly available: boolean;
  readonly defaultSchema: Partial<ColumnSchema>;
}

export const COLUMN_TYPE_CATALOG: readonly ColumnTypeCatalogEntry[] = [
  {
    id: "text",
    label: "Text",
    description: "Single-line title or description",
    group: "basic",
    available: true,
    defaultSchema: { type: "text" },
  },
  {
    id: "number",
    label: "Number",
    description: "Decimal, currency, or percent via format config",
    group: "basic",
    available: true,
    defaultSchema: { type: "number", format: { style: "decimal" } },
  },
  {
    id: "select",
    label: "Single select",
    description: "Workflow status, priority, stage — stores option id",
    group: "basic",
    available: true,
    defaultSchema: {
      type: "select",
      options: [{ id: "opt_1", label: "Option 1", order: 0, color: "#64748b" }],
    },
  },
  {
    id: "date",
    label: "Date",
    description: "Single due date — feeds timeline via toInterval",
    group: "basic",
    available: true,
    defaultSchema: { type: "date", format: { preset: "dateMedium" } },
  },
  {
    id: "dateRange",
    label: "Date range",
    description: "Start–end span for gantt / timeline bars",
    group: "basic",
    available: true,
    defaultSchema: { type: "dateRange", format: { preset: "dateMedium" } },
  },
  {
    id: "person",
    label: "Person",
    description: "Assignee id → name chip (custom registry plugin)",
    group: "people",
    available: true,
    defaultSchema: { type: "person" },
  },
  {
    id: "multiSelect",
    label: "Multi-select",
    description: "Labels, components, teams",
    group: "basic",
    available: false,
    defaultSchema: { type: "multiSelect" },
  },
  {
    id: "checkbox",
    label: "Checkbox",
    description: "Done flag, blocked, approved",
    group: "basic",
    available: false,
    defaultSchema: { type: "checkbox" },
  },
  {
    id: "url",
    label: "URL",
    description: "Link with display text",
    group: "basic",
    available: false,
    defaultSchema: { type: "url" },
  },
  {
    id: "email",
    label: "Email",
    description: "Contact email field",
    group: "basic",
    available: false,
    defaultSchema: { type: "email" },
  },
  {
    id: "richText",
    label: "Rich text",
    description: "Markdown or prose description",
    group: "advanced",
    available: false,
    defaultSchema: { type: "richText" },
  },
  {
    id: "formula",
    label: "Formula",
    description: "Computed from other fields",
    group: "advanced",
    available: false,
    defaultSchema: { type: "formula" },
  },
  {
    id: "relation",
    label: "Relation",
    description: "Link to another issue or project",
    group: "advanced",
    available: false,
    defaultSchema: { type: "relation" },
  },
  {
    id: "file",
    label: "File",
    description: "Attachment reference",
    group: "advanced",
    available: false,
    defaultSchema: { type: "file" },
  },
  {
    id: "rating",
    label: "Rating",
    description: "Stars or score",
    group: "advanced",
    available: false,
    defaultSchema: { type: "rating" },
  },
  {
    id: "labels",
    label: "Labels",
    description: "Tag set on an issue",
    group: "advanced",
    available: false,
    defaultSchema: { type: "labels" },
  },
  {
    id: "rollup",
    label: "Rollup",
    description: "Aggregate child issues",
    group: "advanced",
    available: false,
    defaultSchema: { type: "rollup" },
  },
  {
    id: "dependency",
    label: "Dependency",
    description: "Blocked-by / blocks graph",
    group: "advanced",
    available: false,
    defaultSchema: { type: "dependency" },
  },
  {
    id: "duration",
    label: "Duration",
    description: "Elapsed time estimate",
    group: "advanced",
    available: false,
    defaultSchema: { type: "duration" },
  },
];

export type EngineCapabilityId =
  | "parse"
  | "format"
  | "style"
  | "compareKey"
  | "editor"
  | "toInterval"
  | "groupRows"
  | "inlineEdit"
  | "filter"
  | "validation"
  | "aggregation"
  | "reorder"
  | "conditionalFormat";

export interface EngineCapability {
  readonly id: EngineCapabilityId;
  readonly label: string;
  readonly description: string;
  /** Engine ships this today (column-types or grid). */
  readonly engineReady: boolean;
  /** Applies to this column type when engineReady. */
  readonly applies: (typeId: string) => boolean;
}

export const ENGINE_CAPABILITIES: readonly EngineCapability[] = [
  {
    id: "parse",
    label: "parse()",
    description: "Coerce raw cell value",
    engineReady: true,
    applies: () => true,
  },
  {
    id: "format",
    label: "format()",
    description: "Display string from parsed value",
    engineReady: true,
    applies: () => true,
  },
  {
    id: "style",
    label: "style()",
    description: "Chip color, align, percent bar ratio",
    engineReady: true,
    applies: () => true,
  },
  {
    id: "compareKey",
    label: "compareKey()",
    description: "Sort order (not display text)",
    engineReady: true,
    applies: () => true,
  },
  {
    id: "editor",
    label: "editor()",
    description: "Declarative edit control descriptor",
    engineReady: true,
    applies: () => true,
  },
  {
    id: "toInterval",
    label: "toInterval()",
    description: "Project row onto gantt / timeline axis",
    engineReady: true,
    applies: (t) => t === "date" || t === "dateRange",
  },
  {
    id: "groupRows",
    label: "groupRowsByColumn()",
    description: "Board columns from select compareKey order",
    engineReady: true,
    applies: (t) => t === "select",
  },
  {
    id: "inlineEdit",
    label: "Inline cell edit UI",
    description: "React editor mounted in grid cell (editor() descriptor)",
    engineReady: true,
    applies: () => true,
  },
  {
    id: "filter",
    label: "Column filter",
    description: "Faceted / predicate filter on raw values",
    engineReady: false,
    applies: () => true,
  },
  {
    id: "validation",
    label: "Required / constraints",
    description: "Block save when parse fails or empty",
    engineReady: false,
    applies: () => true,
  },
  {
    id: "aggregation",
    label: "Footer aggregation",
    description: "Sum, count, avg in grouped table",
    engineReady: false,
    applies: (t) => t === "number",
  },
  {
    id: "reorder",
    label: "Drag reorder fields",
    description: "Persist column order in project schema",
    engineReady: false,
    applies: () => true,
  },
  {
    id: "conditionalFormat",
    label: "Conditional formatting",
    description: "Rules that override style() by predicate",
    engineReady: false,
    applies: () => true,
  },
];

export function catalogEntry(typeId: string): ColumnTypeCatalogEntry | undefined {
  return COLUMN_TYPE_CATALOG.find((e) => e.id === typeId);
}

export function availableTypeIds(): string[] {
  return COLUMN_TYPE_CATALOG.filter((e) => e.available).map((e) => e.id);
}
