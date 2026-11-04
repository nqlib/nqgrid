import { useState, type ReactNode } from "react";
import { Card, cn } from "@nqlib/nqui";
import { EngineUtilitiesDemo } from "../demos/engine-utilities-demo";
import { GroupingDemo } from "../demos/grouping-demo";
import { GridKeyboardDemo } from "../demos/grid-keyboard-demo";
import { InfiniteRowsDemo } from "../demos/infinite-rows-demo";
import { KeyboardCellDemo } from "../demos/keyboard-cell-demo";
import { MasterDetailDemo } from "../demos/master-detail-demo";
import { PipelineReferenceDemo } from "../demos/pipeline-reference-demo";
import { RichInlineTasksDemo } from "../demos/rich-inline-tasks-demo";
import { RichNumberFormatsDemo } from "../demos/rich-number-formats-demo";
import { ColumnOutlineDemo } from "../demos/column-outline-demo";
import { FreezePanesVirtualDemo } from "../demos/freeze-panes-virtual-demo";
import { SheetVirtualDemo } from "../demos/sheet-virtual-demo";
import { SpreadsheetChromeDemo } from "../demos/spreadsheet-chrome-demo";
import { TableSelectionDemo } from "../demos/table-selection-demo";
import { TanstackFilterDemo } from "../demos/tanstack-filter-demo";
import { TanstackGroupingTableDemo } from "../demos/tanstack-grouping-table-demo";
import { TanstackPaginationDemo } from "../demos/tanstack-pagination-demo";
import { TanstackPinningDemo } from "../demos/tanstack-pinning-demo";
import { TanstackVirtualTableDemo } from "../demos/tanstack-virtual-table-demo";
import { VirtualDataDemo } from "../demos/virtual-data-demo";
import { WIDE_SELECTION_ROWS } from "./parity-wide-mock-data";

const GROUPING_DATA = [
  { id: "1", country: "US", city: "NYC", units: 12 },
  { id: "2", country: "US", city: "SF", units: 8 },
  { id: "3", country: "DE", city: "BER", units: 5 },
  { id: "4", country: "DE", city: "MUC", units: 7 },
];

const KEYBOARD_DATA = [
  { id: "k1", sku: "SKU-100" },
  { id: "k2", sku: "SKU-200" },
  { id: "k3", sku: "SKU-300" },
];

type ParityEntry = {
  id: string;
  label: string;
  title: string;
  summary: string;
  expect: readonly string[];
  content: ReactNode;
};

const PARITY_ENTRIES: ParityEntry[] = [
  {
    id: "pipeline",
    label: "Pipeline reference",
    title: "BECO pipeline grid",
    summary:
      "Canonical spreadsheet table: TanStack sorting, nqgrid pinned geometry, opaque sticky cells, and nqui ScrollArea for both axes.",
    expect: [
      "Scroll horizontally — id and name stay frozen; a soft edge appears on the last pinned column after you scroll.",
      "Click column headers to sort; pinned left offsets stay aligned (colgroup + table.getTotalSize()).",
      "Wide columns fill the viewport so you can see horizontal scroll behavior.",
    ],
    content: <PipelineReferenceDemo />,
  },
  {
    id: "tsFilter",
    label: "TanStack filter",
    title: "Filtering and faceting",
    summary:
      "TanStack globalFilter + columnFilters via withCoreSortingFaceted and createGlobalFilterFn. Facet chips filter by country.",
    expect: [
      "Type in the search field — rows narrow without pre-filtering data in React state.",
      "Click a country badge — column filter toggles; counts come from getFacetedUniqueValues.",
      "Table scrolls inside nqui ScrollArea when columns exceed width.",
    ],
    content: <TanstackFilterDemo />,
  },
  {
    id: "tsPage",
    label: "TanStack pagination",
    title: "Client pagination",
    summary:
      "getPaginationRowModel through withCoreSortingPaginated. Footer sits below ScrollArea (not inside the scrollport).",
    expect: [
      "Change page size with the toggle group; page index resets to 1.",
      "Previous / Next move through 47 mock rows.",
      "Footer controls remain visible while the table body scrolls.",
    ],
    content: <TanstackPaginationDemo />,
  },
  {
    id: "tsGroup",
    label: "TanStack grouping",
    title: "Native row grouping",
    summary:
      "TanStack getGroupedRowModel with expand/collapse. Prefer this over buildGroupedFlatRows when you already use useReactTable.",
    expect: [
      "Rows group by country with sum aggregates on numeric columns.",
      "Expand/collapse on the group row button.",
      "Grouped column moves to the start (groupedColumnMode: reorder).",
    ],
    content: <TanstackGroupingTableDemo />,
  },
  {
    id: "tsVirtual",
    label: "TanStack virtual",
    title: "Virtualized rows",
    summary:
      "useTableRowVirtualizer over 5,000 rows. ScrollElement is the nqui ScrollArea viewport — not a raw overflow div.",
    expect: [
      "Scroll vertically — only a window of rows is in the DOM.",
      "Sorting still applies to the full data set before virtualization.",
      "Horizontal scroll for wide SKU / warehouse columns.",
    ],
    content: <TanstackVirtualTableDemo />,
  },
  {
    id: "tsPin",
    label: "TanStack pinning",
    title: "Column pinning state",
    summary:
      "TanStack columnPinning + pinPlaygroundCell (playground-row-index-gutter.ts) — single pinning recipe.",
    expect: [
      "Use Pin buttons to move columns in/out of the left pin group.",
      "Scroll right — pinned cells stay opaque; last pinned column shows edge shadow.",
      "colgroup keeps widths authoritative for left offsets.",
    ],
    content: <TanstackPinningDemo />,
  },
  {
    id: "engineUtils",
    label: "Engine utilities",
    title: "Headless helpers",
    summary:
      "Small engine APIs without a full grid: paging math, moveRowBefore, colspan+frozen guard, ARIA host props, TSV paste.",
    expect: [
      "Step through pages with clampPageIndex / slicePage.",
      "Reorder labels with moveRowBefore.",
      "Paste TSV into the textarea to render a mini table.",
    ],
    content: <EngineUtilitiesDemo />,
  },
  {
    id: "sheet",
    label: "Sheet",
    title: "Virtual sheet",
    summary: "TanStack Table + row virtualizer over 4k × 80 cells with pinned frozen columns.",
    expect: ["Pan and scroll a large cell matrix.", "First two columns stay pinned while scrolling."],
    content: <SheetVirtualDemo />,
  },
  {
    id: "freezePanes",
    label: "Freeze panes",
    title: "Excel freeze + virtual center band",
    summary:
      "Prefix-freeze 2 columns and 2 body rows; virtualize center rows with bandOffsetPx. Optional ★ pins row 5 to top.",
    expect: [
      "Scroll — first two columns and first two body rows stay visible.",
      "Center rows virtualize (2000+ rows).",
      "Pin row 5 with ★ — it appears in the top band below frozen prefix rows.",
    ],
    content: <FreezePanesVirtualDemo />,
  },
  {
    id: "columnOutline",
    label: "Column outline",
    title: "Excel column grouping",
    summary:
      "Column outline collapse via engine columnVisibility resolver and multi-row header flattening.",
    expect: [
      "Collapse Q1 — only summary Jan column remains from that quarter.",
      "Collapse Jan — hides Jan Cost while keeping Jan Rev.",
      "Leaf headers align with visible columns.",
    ],
    content: <ColumnOutlineDemo />,
  },
  {
    id: "selection",
    label: "Table selection",
    title: "Row selection and resize",
    summary:
      "withCoreSortingRowSelection, column resize, and column reorder. Uses nqgrid table shell tokens where applicable.",
    expect: [
      "Select rows and column headers; resize columns (persisted to localStorage).",
      "Drag column headers to reorder (DnD kit).",
    ],
    content: <TableSelectionDemo data={WIDE_SELECTION_ROWS} />,
  },
  {
    id: "keyboard",
    label: "Cell keyboard",
    title: "Arrow-key cell focus",
    summary: "useCellKeyboardTable for single-cell navigation on a TanStack row model.",
    expect: ["Arrow keys move a focused cell.", "Read-only navigation — no range selection."],
    content: <KeyboardCellDemo data={KEYBOARD_DATA} />,
  },
  {
    id: "grouping",
    label: "Grouping (compact)",
    title: "Compact row grouping",
    summary: "TanStack getGroupedRowModel on a small country/city dataset (same pattern as native grouping).",
    expect: ["Toggle country groups in the table.", "Expand/collapse group rows with aggregates."],
    content: <GroupingDemo data={GROUPING_DATA} />,
  },
  {
    id: "master",
    label: "Master detail",
    title: "Synthetic detail rows",
    summary: "TanStack expanded state with synthetic detail rows rendered below expanded masters.",
    expect: ["Expand a master row — detail row appears below.", "Collapse removes the synthetic row."],
    content: <MasterDetailDemo />,
  },
  {
    id: "spreadsheet",
    label: "Spreadsheet chrome",
    title: "Clipboard and commands",
    summary: "matrixToTsv and useSpreadsheetCommands — engine clipboard with a TanStack sample matrix.",
    expect: ["Copy logs TSV for a sample matrix.", "Command hook fires on copy/paste actions."],
    content: <SpreadsheetChromeDemo />,
  },
  {
    id: "infinite",
    label: "Infinite rows",
    title: "Append on scroll",
    summary:
      "useInfiniteVisibleRows appends rows into a TanStack table when a sentinel hits the ScrollArea viewport.",
    expect: [
      "Scroll down — more rows append in batches.",
      "All source rows stay in memory; only visible slice is passed to the table.",
    ],
    content: <InfiniteRowsDemo />,
  },
  {
    id: "richInline",
    label: "Rich + inline edit",
    title: "Rich columns",
    summary: "buildRichColumnFromDef with status, people, and inline edit patterns from @nqlib/nqgrid/advanced.",
    expect: ["Double-click cells to edit.", "People picker and status pills from rich schema."],
    content: <RichInlineTasksDemo />,
  },
  {
    id: "richNumbers",
    label: "Number formats",
    title: "Numeric formatters",
    summary: "Rich number and percent battery formatters on TanStack columns.",
    expect: ["Percent battery and plain numeric formats.", "Locale-aware formatting from advanced helpers."],
    content: <RichNumberFormatsDemo />,
  },
  {
    id: "gridKeyboard",
    label: "Grid keyboard",
    title: "Spreadsheet selection",
    summary: "useGridKeyboard on TanStack rows + selection ranges + copyMatrixToClipboard.",
    expect: [
      "Arrow keys with Shift extend selection.",
      "Copy writes TSV to the clipboard.",
    ],
    content: <GridKeyboardDemo />,
  },
  {
    id: "virtualData",
    label: "Virtual data",
    title: "Async page cache",
    summary:
      "VirtualDataManager async page cache with TanStack row virtualizer and skeleton cells while pages load.",
    expect: [
      "Scroll vertically and horizontally — 12 columns span the viewport width.",
      "Change simulated latency and watch pages load with skeleton placeholders.",
      "Clear cache resets scroll position and refetches visible rows.",
    ],
    content: <VirtualDataDemo />,
  },
];

export function ParityPage() {
  const [activeId, setActiveId] = useState(PARITY_ENTRIES[0]!.id);
  const active = PARITY_ENTRIES.find((e) => e.id === activeId) ?? PARITY_ENTRIES[0]!;

  return (
    <Card className="flex min-h-0 flex-1 flex-row gap-0 overflow-hidden py-0">
      <nav
        className="flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border p-2"
        aria-label="Parity examples"
      >
        {PARITY_ENTRIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setActiveId(entry.id)}
            className={cn(
              "rounded-lg px-3 py-2 text-left text-sm transition-colors",
              entry.id === activeId
                ? "bg-muted/40 font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
            )}
          >
            {entry.label}
          </button>
        ))}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4">
        <header className="shrink-0 space-y-2 border-b border-border pb-4">
          <h2 className="text-base font-semibold tracking-tight">{active.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{active.summary}</p>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">What to try</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {active.expect.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </header>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{active.content}</div>
      </div>
    </Card>
  );
}
