import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nqlib/nqui";
import { mockFlightsOperations, mockPortfolio, mockProjects } from "@nqlib/nqgrid";
import { FlightsTable } from "./demos/flights-table";
import { GroupingDemo } from "./demos/grouping-demo";
import { InfiniteRowsDemo } from "./demos/infinite-rows-demo";
import { KeyboardCellDemo } from "./demos/keyboard-cell-demo";
import { RichInlineTasksDemo } from "./demos/rich-inline-tasks-demo";
import { RichNumberFormatsDemo } from "./demos/rich-number-formats-demo";
import { MasterDetailDemo } from "./demos/master-detail-demo";
import { PortfolioTable } from "./demos/portfolio-table";
import { ProjectsTable } from "./demos/projects-table";
import { SheetVirtualDemo } from "./demos/sheet-virtual-demo";
import { SpreadsheetChromeDemo } from "./demos/spreadsheet-chrome-demo";
import { TableSelectionDemo } from "./demos/table-selection-demo";
import { PlaygroundTableSettingsMenu } from "./playground-table-settings";
import { ThemeToggle } from "./theme-toggle";

const GROUPING_DATA = [
  { id: "1", country: "US", city: "NYC", units: 12 },
  { id: "2", country: "US", city: "SF", units: 8 },
  { id: "3", country: "DE", city: "BER", units: 5 },
  { id: "4", country: "DE", city: "MUC", units: 7 },
];

const SELECTION_DATA = [
  { id: "a", label: "Alpha", amount: 120 },
  { id: "b", label: "Bravo", amount: 45 },
  { id: "c", label: "Charlie", amount: 210 },
];

const KEYBOARD_DATA = [
  { id: "k1", sku: "SKU-100" },
  { id: "k2", sku: "SKU-200" },
  { id: "k3", sku: "SKU-300" },
];

export function App() {
  return (
    <div className="flex min-h-full flex-col gap-4 bg-background p-6 text-foreground">
      <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">nqgrid playground</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
          <PlaygroundTableSettingsMenu />
          <ThemeToggle />
        </div>
      </header>

      <Tabs defaultValue="portfolio" className="flex min-h-0 flex-1 flex-col gap-3">
        <TabsList className="max-w-full shrink-0 self-start overflow-x-auto overflow-y-hidden">
          <TabsTrigger className="shrink-0 flex-none" value="portfolio">
            Portfolio
          </TabsTrigger>
          <TabsTrigger className="shrink-0 flex-none" value="projects">
            Projects
          </TabsTrigger>
          <TabsTrigger className="shrink-0 flex-none" value="flights">
            Flights (ops)
          </TabsTrigger>
          <TabsTrigger className="shrink-0 flex-none" value="parity">
            Parity / nqdg
          </TabsTrigger>
        </TabsList>
        <TabsContent value="portfolio" className="min-h-0 flex-1 outline-none data-[state=inactive]:hidden">
          <PortfolioTable data={mockPortfolio} />
        </TabsContent>
        <TabsContent value="projects" className="min-h-0 flex-1 outline-none data-[state=inactive]:hidden">
          <ProjectsTable data={mockProjects} />
        </TabsContent>
        <TabsContent value="flights" className="min-h-0 flex-1 outline-none data-[state=inactive]:hidden">
          <FlightsTable data={mockFlightsOperations} />
        </TabsContent>
        <TabsContent value="parity" className="min-h-0 flex-1 outline-none data-[state=inactive]:hidden">
          <Tabs defaultValue="sheet" className="flex min-h-0 flex-1 flex-col gap-3">
            <TabsList className="max-w-full shrink-0 flex-wrap gap-1">
              <TabsTrigger value="sheet">Sheet</TabsTrigger>
              <TabsTrigger value="selection">Table selection</TabsTrigger>
              <TabsTrigger value="keyboard">Cell keyboard</TabsTrigger>
              <TabsTrigger value="grouping">Grouping</TabsTrigger>
              <TabsTrigger value="master">Master detail</TabsTrigger>
              <TabsTrigger value="spreadsheet">Spreadsheet chrome</TabsTrigger>
              <TabsTrigger value="infinite">Infinite rows</TabsTrigger>
              <TabsTrigger value="richInline">Rich + inline edit</TabsTrigger>
              <TabsTrigger value="richNumbers">Number formats</TabsTrigger>
            </TabsList>
            <TabsContent value="sheet" className="min-h-0 flex-1 data-[state=inactive]:hidden">
              <SheetVirtualDemo />
            </TabsContent>
            <TabsContent value="selection" className="min-h-0 flex-1 data-[state=inactive]:hidden">
              <TableSelectionDemo data={SELECTION_DATA} />
            </TabsContent>
            <TabsContent value="keyboard" className="min-h-0 flex-1 data-[state=inactive]:hidden">
              <KeyboardCellDemo data={KEYBOARD_DATA} />
            </TabsContent>
            <TabsContent value="grouping" className="min-h-0 flex-1 data-[state=inactive]:hidden">
              <GroupingDemo data={GROUPING_DATA} />
            </TabsContent>
            <TabsContent value="master" className="min-h-0 flex-1 data-[state=inactive]:hidden">
              <MasterDetailDemo />
            </TabsContent>
            <TabsContent value="spreadsheet" className="min-h-0 flex-1 data-[state=inactive]:hidden">
              <SpreadsheetChromeDemo />
            </TabsContent>
            <TabsContent value="infinite" className="min-h-0 flex-1 data-[state=inactive]:hidden">
              <InfiniteRowsDemo />
            </TabsContent>
            <TabsContent value="richInline" className="min-h-0 flex-1 data-[state=inactive]:hidden">
              <RichInlineTasksDemo />
            </TabsContent>
            <TabsContent value="richNumbers" className="min-h-0 flex-1 data-[state=inactive]:hidden">
              <RichNumberFormatsDemo />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
