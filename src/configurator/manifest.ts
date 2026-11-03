/** Stable ids for the import planner + docs. */
export type NqgridFeatureId =
  | "styles.tokens"
  | "fixtures.dashboard"
  | "core.pivot"
  | "pivot.react"
  | "pivot.renderStatic"
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
    | "@nqlib/nqgrid/pivot"
    | "@nqlib/nqgrid/render-static"
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
      "createPivotModelBuilder",
      "validatePivotSpec",
      "togglePivotGroup",
      "setPivotFilter",
      "togglePivotFilterValue",
      "clearPivotFilters",
      "setPivotSort",
      "setPivotTopN",
      "resolvePivotFields",
      "pivotFieldListState",
      "movePivotField",
      "addPivotMeasure",
      "setPivotMeasureAggregate",
      "swapPivotRowsColumns",
      "togglePivotColumnGroup",
      "setPivotColumnsExpandedAll",
      "setPivotDateGrouping",
      "pivotColumnFields",
      "setPivotCalculatedMeasure",
      "checkPivotCalculatedMeasure",
      "parsePivotCalc",
      "setPivotMeasureShowAs",
      "setPivotSubtotal",
      "pivotDrillThrough",
      "pivotCellDrillTarget",
      "pivotModelToSheet",
      "formatPivotNumber",
      "PIVOT_SPEC_JSON_SCHEMA",
    ],
    configure: [
      { key: "PivotSpec", hint: "Same JSON from the app or a backend (schema: `contract/pivot/v1/pivot-spec.schema.json`)." },
      { key: "spec.expanded", hint: "View state lives in the spec — send it to the backend to export what the user sees." },
      { key: "spec.filters / spec.facets", hint: "Report / slicer / label filters applied before aggregation; `facets` returns cross-filtered slicer counts in `model.facets`." },
      { key: "rows[].sortBy / rows[].topN", hint: "Sort siblings by a measure; Top / Bottom N per parent group (`other: true` keeps totals complete)." },
      { key: "spec.fields / fieldLabels / valuesIndex", hint: "Field catalogue (labels, types, allowed areas; inferred from rows when absent) and the Σ Values position. Rearrange with `movePivotField(spec, { field, from, to, index }, { fields })`; moves never produce an invalid spec." },
      { key: "spec.columns (list) / columnsExpanded", hint: "Several column fields, outermost first (`[{ field: \"region\" }, { field: \"channel\" }]`), with per-level `subtotal: \"end\" | \"start\" | \"none\"`, a grand total column (`totals.rowTotal`) and collapsible column groups (`togglePivotColumnGroup`)." },
      { key: "orderDate:year (date grouping)", hint: "Group a date field by naming `<field>:year | quarter | month | week | day | yearMonth | yearQuarter`; UTC, chronological keys, fixed labels. Fiscal years / offsets / month names on the date's `fields` entry (`fiscalYearStartMonth: 11`). `setPivotDateGrouping(spec, \"orderDate\", [\"year\", \"quarter\"])` regroups." },
      { key: "measures[].calculate", hint: "Calculated measure over other measure ids (`actual / plan - 1`, `[prior year] * 1.05`), evaluated over aggregated values (Excel calculated fields). Safe parser: no eval, whitelisted functions, bounded length / depth; `checkPivotCalculatedMeasure` for inline validation." },
      { key: "measures[].showAs + showAsBase", hint: "`differenceFrom`, `percentDifferenceFrom`, `runningTotal`, `percentRunningTotal`, `rankAscending`, `rankDescending` along a row or column field (`{ field, position: \"previous\" | \"next\" }` or `{ field, item }`)." },
      { key: "rows[].subtotal / aggregate: \"distinctCount\"", hint: "Row subtotals at the top (default), bottom (`end`: \"Camp Total\" rows) or off; distinct counts that stay correct in totals." },
      { key: "pivotDrillThrough(spec, rows, target)", hint: "Source records behind a cell (filters, Top N \"Other\", date keys respected); `createPivotModelBuilder().drillThrough` reuses the encoding." },
      { key: "aggregators", hint: "Register `{ type: \"custom\", name }` functions via `buildPivotModel(spec, rows, { aggregators })`." },
    ],
  },
  {
    id: "pivot.react",
    label: "Pivot grid (React)",
    summary: "usePivotGrid spec state + PivotTable: pinned dimensions, KPI side panel, heat cells, header chart band; static mode for HTML/PDF.",
    entry: "@nqlib/nqgrid/pivot",
    namedExports: [
      "usePivotGrid",
      "PivotTable",
      "PivotSlicer",
      "PivotFilterMenu",
      "PivotHeaderMenu",
      "pivotSlicerProps",
      "pivotFilterMenuProps",
      "PivotFieldList",
      "pivotFieldListProps",
      "pivotFieldDragHandleProps",
      "pivotDropZoneProps",
      "usePivotLayoutDraft",
      "pivotColumnHeaderRole",
      "PivotCalculatedMeasureForm",
      "PivotShowAsMenu",
      "PivotDrillThroughPanel",
      "pivotDrillThroughFieldInfo",
      "PivotHeaderChartBand",
      "PivotKpiPanel",
      "pivotHeatCellProps",
      "pivotModelToTanstack",
    ],
    configure: [
      { key: "usePivotGrid(spec, rows, { onSpecChange })", hint: "Uncontrolled by default; pass `onSpecChange` to own the spec. `grid.spec` is what Export sends." },
      { key: "PivotTable.mode", hint: "`interactive` (toggles + CSS sticky pinning) or `static` for `renderToStaticMarkup` (PDF)." },
      { key: "PivotSlicer / PivotFilterMenu", hint: "Bind with `pivotSlicerProps(grid, field)` / `pivotFilterMenuProps(grid, field)`; list the field in `spec.facets`. Style via `className` / `classNames` slots." },
      { key: "PivotTable.renderDimensionHeader", hint: "Put a filter menu (your popover or `PivotHeaderMenu`) in a row-dimension header; `context.indicator` shows active sort / filter. Spread `pivotFieldDragHandleProps` / `pivotDropZoneProps` to drag headers onto the field list or reorder row levels." },
      { key: "PivotTable.renderColumnHeader / onToggleColumnGroup", hint: "Column-group toggles render with `onToggleColumnGroup={grid.toggleColumnGroup}`. `renderColumnHeader(context)` gets each header's role, column field and `areaIndex` for `pivotDropZoneProps(\"columns\", { axis: \"x\", offset })`, so column headers can be dragged too." },
      { key: "usePivotLayoutDraft", hint: "One \"Defer layout update\" draft for the field list (`pivotFieldListProps(grid, layout)`) and header drags (`layout.moveField`), so header drags wait for Update too." },
      { key: "PivotFieldList", hint: "`<PivotFieldList {...pivotFieldListProps(grid)} />`: checklist + Filters / Columns / Rows / Values zones, pointer and keyboard drag-and-drop (no dependency), chip menus, \"Defer layout update\". Style via `classNames`; i18n via `labels`." },
      { key: "PivotTable.onDrillThrough + PivotDrillThroughPanel", hint: "Double-click a value cell → `grid.drillThrough(target)` → records table (`pivotDrillThroughFieldInfo` for labels / formats)." },
      { key: "PivotCalculatedMeasureForm / PivotShowAsMenu", hint: "Formula editor with inline validation and the \"Show values as\" picker (base field / item); both are built into `PivotFieldList` chip menus, with subtotal positions and Distinct Count." },
      { key: "--nqg-heat-0 … --nqg-heat-8", hint: "Override heat colors (or just `--nqg-heat-color`); `--nqg-series-N` for header stacks (`pivotThemeVars`)." },
      { key: "pivotModelToTanstack", hint: "`{ columns, data, columnPinning, getRowId }` for your own `useReactTable` grid." },
    ],
  },
  {
    id: "pivot.renderStatic",
    label: "Pivot static HTML (print / PDF)",
    summary: "renderPivotHtml(model, options): standalone HTML with inline CSS — light/dark, landscape pages, repeated headers, column chunks.",
    entry: "@nqlib/nqgrid/render-static",
    namedExports: [
      "renderPivotHtml",
      "renderPivotHtmlFromSpec",
      "PIVOT_STATIC_CSS",
      "pivotStaticLayout",
      "pivotHeatFillHex",
    ],
    configure: [
      { key: "options.generatedAt", hint: "Pass the timestamp in (string or Date) — output stays deterministic." },
      { key: "options.page", hint: "`{ size: \"A4\" | \"Letter\" | …, orientation, margins (mm) }`; default A4 landscape." },
      { key: "options.maxColumnsPerPage", hint: "Default: fit the page at `minScale` (0.7), else balanced column chunks with \"(cont.)\" labels." },
      { key: "nqgrid-export", hint: "CLI / HTTP service (`packages/nqgrid-export`) turns the HTML into PDF (Chromium) and the sheet into XLSX." },
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
