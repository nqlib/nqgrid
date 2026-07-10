/** Stable ids for the import planner + docs. */
export type NqgridFeatureId =
  | "fixtures.dashboard"
  | "engine.headless"
  | "sheet.virtual"
  | "spreadsheet.chrome";

export interface NqgridFeatureDescriptor {
  readonly id: NqgridFeatureId;
  readonly label: string;
  readonly summary: string;
  /** ESM import specifier (matches `package.json#exports`). */
  readonly entry:
    | "@nqlib/nqgrid"
    | "@nqlib/nqgrid/fixtures"
    | "@nqlib/nqgrid/engine"
    | "@nqlib/nqgrid/sheet"
    | "@nqlib/nqgrid/spreadsheet";
  /** Representative named exports to seed import statements (merge + dedupe per entry). */
  readonly namedExports: readonly string[];
  /** How to configure when this feature is on (library + usual TanStack peers). */
  readonly configure: readonly { readonly key: string; readonly hint: string }[];
}

export const NQGRID_FEATURES = [
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
    id: "engine.headless",
    label: "TanStack engine helpers",
    summary: "TanStack row-model presets, pinned geometry, virtualizer glue, keyboard, clipboard.",
    entry: "@nqlib/nqgrid/engine",
    namedExports: [
      "EMPTY_ROW_SELECTION",
      "TANSTACK_ROW_MODEL_PRESETS",
      "clampPageIndex",
      "colSpanCrossesFrozenBoundary",
      "computePinnedLayout",
      "computeFrozenTopLayout",
      "createFreezePanesState",
      "freezePanesFromExcelCell",
      "getFreezePaneCellStickyStyle",
      "createGlobalFilterFn",
      "getDirectionDocument",
      "getPageCount",
      "getPinnedTableCellStickyStyle",
      "getTableWrapperAria",
      "getVirtualTableRowStyle",
      "getBottomPinnedRowStyle",
      "useTableRowSections",
      "useFrozenTopRows",
      "useFrozenTableColumns",
      "withFreezePanesSupport",
      "columnOutlineToVisibility",
      "buildColumnOutlineGroups",
      "getOutlineRowIndentStyle",
      "isLastPinnedColumn",
      "isPinnedColumn",
      "moveRowBefore",
      "resolvePinnedLeftPrefix",
      "resolvePinnedLeftWithLeadingGutter",
      "slicePage",
      "tsvToMatrix",
      "useCellKeyboardTable",
      "useGridImperativeHandle",
      "useInfiniteVisibleRows",
      "useMasterDetail",
      "usePinnedTableColumns",
      "useScrollToCellScroller",
      "useTableRowVirtualizer",
      "withCoreRowModel",
      "withCoreSorting",
      "withCoreSortingExpanded",
      "withCoreSortingRowSelection",
      "withCoreSortingFiltered",
      "withCoreSortingPaginated",
      "withCoreSortingGroupedExpanded",
      "withCoreSortingFaceted",
      "withCoreDataTable",
      "buildGroupedFlatRows",
    ],
    configure: [
      { key: "engine.pinnedLeftIds", hint: "Prefix column ids for `usePinnedTableColumns`, or `fromColumnPinning: true` with TanStack `columnPinning` state." },
      { key: "engine.freezePanes", hint: "`createFreezePanesState` + `useTableRowSections` + `useFrozenTableColumns`; virtualize `centerRows` with `bandOffsetPx`." },
      { key: "engine.rowPinning", hint: "`withFreezePanesSupport` + controlled `rowPinning`; render top/center/bottom bands, not flat `getRowModel().rows`." },
      { key: "engine.columnOutline", hint: "`columnOutlineToVisibility` + `flattenOutlineHeaderRows` for Excel-style column collapse." },
      { key: "engine.globalFilter", hint: "`withCoreSortingFiltered` + `createGlobalFilterFn` + controlled `globalFilter`." },
      { key: "engine.virtualizer", hint: "Optional peer `@tanstack/react-virtual`; `useTableRowVirtualizer`." },
      { key: "engine.moveRowBefore", hint: "Reorder stable-id row arrays when not using `@nqlib/nqui/sortable`." },
      {
        key: "TanStack.rowSelection",
        hint: "Use `getRowId` when rows have stable ids; bind checkbox `checked` to `row.getIsSelected()` and `EMPTY_ROW_SELECTION` / `withCoreSortingRowSelection` defaults.",
      },
      { key: "TanStack", hint: "Peer: `@tanstack/react-table` v8." },
      { key: "docs", hint: "See `docs/engine-tanstack-matrix.md`." },
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
] as const satisfies readonly NqgridFeatureDescriptor[];

export const ALL_NQGRID_FEATURE_IDS: NqgridFeatureId[] = NQGRID_FEATURES.map((f) => f.id);
