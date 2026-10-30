/** Stable ids for the import planner + docs. */
export type NqgridFeatureId =
  | "styles.tokens"
  | "fixtures.dashboard"
  | "core.pivot"
  | "engine.headless"
  | "sheet.virtual"
  | "spreadsheet.chrome"
  | "advanced.columnFactory"
  | "components.tablePercentBattery";

export interface NqgridFeatureDescriptor {
  readonly id: NqgridFeatureId;
  readonly label: string;
  readonly summary: string;
  /** ESM import specifier (matches `package.json#exports`). */
  readonly entry:
    | "@nqlib/nqgrid"
    | "@nqlib/nqgrid/styles"
    | "@nqlib/nqgrid/fixtures"
    | "@nqlib/nqgrid/core"
    | "@nqlib/nqgrid/engine"
    | "@nqlib/nqgrid/sheet"
    | "@nqlib/nqgrid/spreadsheet"
    | "@nqlib/nqgrid/advanced";
  /** Representative named exports to seed import statements (merge + dedupe per entry). */
  readonly namedExports: readonly string[];
  /** How to configure when this feature is on (library + usual TanStack peers). */
  readonly configure: readonly { readonly key: string; readonly hint: string }[];
}

export const NQGRID_FEATURES = [
  {
    id: "styles.tokens",
    label: "Table shell & class tokens",
    summary: "Scroll layout, typography, tbody/header chrome, numeric helpers.",
    entry: "@nqlib/nqgrid/styles",
    namedExports: [
      "tableShellClass",
      "tableScrollAreaRootClass",
      "tableScrollViewportStyle",
      "tableScrollAreaContentClass",
      "tableDenseTypography",
      "tableHeaderClass",
      "tableHeadClass",
      "tableBodyClass",
      "tableBodyStripedClass",
      "tableBodyClassFor",
      "tableRowClass",
      "tableCellClass",
      "tableFooterClass",
      "flightsTableShellExtraClass",
      "tableNumericClass",
      "tableNumericMutedClass",
      "tableNumericStrongClass",
      "tablePercentBatteryShellClass",
      "tablePercentBatteryTrackClass",
      "tablePercentBatteryFillClass",
      "tablePercentBatteryLabelMutedClass",
      "tablePercentBatteryLabelStrongClass",
    ],
    configure: [
      { key: "styles.tableBodyFill", hint: "Pass `'solid' | 'striped'` into `tableBodyClassFor` (or `tableBodyClassFromLibraryConfig`)." },
      {
        key: "styles.percentProgressDisplay",
        hint: "Optional `'plain' | 'battery'` for percent cells — battery uses `TablePercentBattery` from `@nqlib/nqgrid`.",
      },
      { key: "UI peer", hint: "Compose with `@nqlib/nqui` `Table`, `ScrollArea`, etc." },
    ],
  },
  {
    id: "fixtures.dashboard",
    label: "Dashboard fixtures",
    summary: "Typed mock rows + generators for demos and tests.",
    entry: "@nqlib/nqgrid/fixtures",
    namedExports: [
      "mockPortfolio",
      "mockProjects",
      "mockFlightsOperations",
      "demoAssigneePerson",
      "generateExtraMockFlights",
    ],
    configure: [
      {
        key: "types",
        hint: "Use `import type { PortfolioRow, ProjectRow, FlightRow } from \"@nqlib/nqgrid/fixtures\"`.",
      },
    ],
  },
  {
    id: "core.pivot",
    label: "Pivot core (framework-free)",
    summary: "PivotSpec JSON → PivotModel: groups, subtotals, show-values-as, heat, header series, KPIs, XLSX sheet.",
    entry: "@nqlib/nqgrid/core",
    namedExports: [
      "buildPivotModel",
      "validatePivotSpec",
      "togglePivotGroup",
      "pivotModelToSheet",
      "formatPivotNumber",
      "PIVOT_SPEC_JSON_SCHEMA",
    ],
    configure: [
      { key: "PivotSpec", hint: "Same JSON from the app or a backend (schema: `contract/pivot/v1/pivot-spec.schema.json`)." },
      { key: "spec.expanded", hint: "View state lives in the spec — send it to the backend to export what the user sees." },
      { key: "aggregators", hint: "Register `{ type: \"custom\", name }` functions via `buildPivotModel(spec, rows, { aggregators })`." },
    ],
  },
  {
    id: "engine.headless",
    label: "TanStack engine helpers",
    summary: "Pinned columns, infinite rows, clipboard, grouping, keyboard, defaults.",
    entry: "@nqlib/nqgrid/engine",
    namedExports: [
      "EMPTY_ROW_SELECTION",
      "clampPageIndex",
      "colSpanCrossesFrozenBoundary",
      "computePinnedLayout",
      "getDirectionDocument",
      "getPageCount",
      "getPinnedTableCellStickyStyle",
      "getTableWrapperAria",
      "isLastPinnedColumn",
      "isPinnedColumn",
      "moveRowBefore",
      "resolvePinnedLeftPrefix",
      "slicePage",
      "tsvToMatrix",
      "useCellKeyboardTable",
      "useGridImperativeHandle",
      "useInfiniteVisibleRows",
      "useMasterDetail",
      "usePinnedTableColumns",
      "useScrollToCellScroller",
      "withCoreRowModel",
      "withCoreSorting",
      "withCoreSortingExpanded",
      "withCoreSortingRowSelection",
      "buildGroupedFlatRows",
    ],
    configure: [
      { key: "engine.pinnedLeftIds", hint: "Prefix column ids for `usePinnedTableColumns`." },
      { key: "engine.moveRowBefore", hint: "Reorder stable-id row arrays when not using `@nqlib/nqui/sortable`." },
      {
        key: "TanStack.rowSelection",
        hint: "Use `getRowId` when rows have stable ids; bind checkbox `checked` to `row.getIsSelected()` and `EMPTY_ROW_SELECTION` / `withCoreSortingRowSelection` defaults.",
      },
      { key: "TanStack", hint: "Peer: `@tanstack/react-table` v8." },
    ],
  },
  {
    id: "sheet.virtual",
    label: "Sheet viewport",
    summary: "Windowed grid metrics + `VirtualSheet` shell.",
    entry: "@nqlib/nqgrid/sheet",
    namedExports: ["VirtualSheet", "computeSheetViewport", "useSheetViewport"],
    configure: [{ key: "sheet", hint: "`VirtualSheet` props: `rowCount`, `columnCount`, `frozenColumnCount`, …" }],
  },
  {
    id: "spreadsheet.chrome",
    label: "Spreadsheet commands",
    summary: "Command ids, menus, hooks for spreadsheet-style chrome.",
    entry: "@nqlib/nqgrid/spreadsheet",
    namedExports: [
      "COMMAND_IDS",
      "DEFAULT_MENU_GROUPS",
      "useSpreadsheetCommands",
      "useCellFormats",
    ],
    configure: [{ key: "spreadsheet", hint: "Wire `useSpreadsheetCommands` to your sheet adapter / state." }],
  },
  {
    id: "advanced.columnFactory",
    label: "Advanced column factory",
    summary: "Build TanStack columns from a small schema DSL.",
    entry: "@nqlib/nqgrid/advanced",
    namedExports: [
      "buildColumnFromDef",
      "buildRichColumnFromDef",
      "buildRichColumnsFromDefs",
      "RichColumnCell",
      "RichFormulaPresentationCell",
      "getByPath",
      "formatNumberValue",
    ],
    configure: [
      {
        key: "RichSchemaColumnDef",
        hint: "Discriminated `kind`: text, number, currency, percent, date, status, tag, people, formula, custom.",
      },
      { key: "ColumnFactoryConfig.locale", hint: "Default Intl `locale` for rich columns." },
    ],
  },
  {
    id: "components.tablePercentBattery",
    label: "Percent battery cell",
    summary: "Optional 0–100 readout with a filled track behind tabular text.",
    entry: "@nqlib/nqgrid",
    namedExports: ["TablePercentBattery"],
    configure: [
      {
        key: "styles.percentProgressDisplay",
        hint: "Toggle `'battery'` vs `'plain'` in your app config / column renderers.",
      },
    ],
  },
] as const satisfies readonly NqgridFeatureDescriptor[];

export const ALL_NQGRID_FEATURE_IDS: NqgridFeatureId[] = NQGRID_FEATURES.map((f) => f.id);
