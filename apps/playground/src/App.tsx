import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nqlib/nqui";
import { DesignTokensPage } from "./design-tokens/design-tokens-page";
import { ExamplesPage } from "./examples/examples-page";
import { SpreadsheetPage } from "./demos/spreadsheet/spreadsheet-page";
import { ProjectsPage } from "./demos/projects/projects-page";
import { PlanningPivotDemo } from "./demos/planning-pivot-demo";
import { PlaygroundTableSettingsMenu } from "./playground-table-settings";
import { ThemeToggle } from "./theme-toggle";

/** Override nqui defaults (`flex-1 min-w-0` + string `truncate` wrapper) so labels show in full. */
const playgroundTabTriggerClass = "flex-none shrink-0 px-3";

/** Persist the active tab so a full reload (incl. Vite HMR full-reloads) restores it. */
const TAB_STORAGE_KEY = "nqgrid-playground-tab";
function readStoredTab(): string {
  try {
    return localStorage.getItem(TAB_STORAGE_KEY) ?? "examples";
  } catch {
    return "examples";
  }
}

export function App() {
  const [tab, setTab] = useState<string>(readStoredTab);
  const onTabChange = (value: string) => {
    setTab(value);
    try {
      localStorage.setItem(TAB_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  };
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

      <Tabs value={tab} onValueChange={onTabChange} className="flex min-h-0 flex-1 flex-col gap-3">
        <TabsList className="w-fit shrink-0 self-start">
          <TabsTrigger className={playgroundTabTriggerClass} value="examples">
            <span className="whitespace-nowrap">Examples</span>
          </TabsTrigger>
          <TabsTrigger className={playgroundTabTriggerClass} value="spreadsheet">
            <span className="whitespace-nowrap">Spreadsheet</span>
          </TabsTrigger>
          <TabsTrigger className={playgroundTabTriggerClass} value="projects">
            <span className="whitespace-nowrap">Projects</span>
          </TabsTrigger>
          <TabsTrigger className={playgroundTabTriggerClass} value="pivot">
            <span className="whitespace-nowrap">Planning pivot</span>
          </TabsTrigger>
          <TabsTrigger className={playgroundTabTriggerClass} value="design-tokens">
            <span className="whitespace-nowrap">Design tokens</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="examples" className="min-h-0 flex-1 outline-none data-[state=inactive]:hidden">
          <ExamplesPage />
        </TabsContent>
        <TabsContent
          value="spreadsheet"
          className="min-h-0 flex-1 outline-none data-[state=inactive]:hidden"
        >
          <SpreadsheetPage />
        </TabsContent>
        <TabsContent
          value="projects"
          className="min-h-0 flex-1 outline-none data-[state=inactive]:hidden"
        >
          <ProjectsPage />
        </TabsContent>
        <TabsContent value="pivot" className="min-h-0 flex-1 outline-none data-[state=inactive]:hidden">
          <PlanningPivotDemo />
        </TabsContent>
        <TabsContent
          value="design-tokens"
          className="min-h-0 flex-1 overflow-y-auto outline-none data-[state=inactive]:hidden"
        >
          <DesignTokensPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
