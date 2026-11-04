import type { ReactNode } from "react";
import { mockFlightsOperations, mockPortfolio, mockProjects } from "@nqlib/nqgrid";
import { FlightsTable } from "../demos/flights-table";
import { PortfolioTable } from "../demos/portfolio-table";
import { ProjectsTable } from "../demos/projects-table";
import { SupportQueueTable } from "../demos/support-queue-table";
import { TaskDeliveryTable } from "../demos/task-delivery-table";
import { EngineLabDemo } from "./engine-lab-demo";
import { PivotDemo } from "../demos/pivot-demo";
import { NestedGroupingDemo } from "../demos/nested-grouping-demo";
import { RowOutlineExpansionDemo } from "../demos/row-outline-expansion-demo";

export type ExampleCategory = "dashboard" | "engine";

export type PlaygroundExample = {
  id: string;
  category: ExampleCategory;
  label: string;
  title: string;
  summary: string;
  expect: readonly string[];
  content: ReactNode;
};

export const EXAMPLE_CATEGORY_LABELS: Record<ExampleCategory, string> = {
  dashboard: "Dashboard tables",
  engine: "Engine & patterns",
};

export const PLAYGROUND_EXAMPLES: PlaygroundExample[] = [
  {
    id: "task-delivery",
    category: "dashboard",
    label: "Task delivery",
    title: "Task delivery",
    summary:
      "Product-style task board (~40 epics, 8 projects): view tabs, filter chips, hierarchical subtasks, full-width task column, paginated footer.",
    expect: [
      "Switch All tasks / Active / Backlog — counts update per tab.",
      "Select rows via first-column checkboxes — bulk bar offers status update and reassign.",
      "Expand parent rows for indented subtasks; done items show strikethrough from status, not checkbox.",
    ],
    content: <TaskDeliveryTable />,
  },
  {
    id: "support-queue",
    category: "dashboard",
    label: "Support queue",
    title: "Support queue",
    summary:
      "Compact canonical grid (12 rows/page, tall scrollport): checkbox column, column+row reorder, bulk bar, queue filter.",
    expect: [
      "Search narrows tickets by id, title, company, or owner.",
      "Select rows — bulk bar offers assign owner and update status.",
      "Paginate 6 rows per page; column badge shows visible count.",
    ],
    content: <SupportQueueTable />,
  },
  {
    id: "portfolio",
    category: "dashboard",
    label: "Portfolio",
    title: "Portfolio holdings",
    summary:
      "Canonical grid: virtual-data shell, #/checkbox/drag column, pinned ticker/name, column + row reorder, resize.",
    expect: [
      "Pin and sort ticker columns; hover # for row drag; select rows with checkbox.",
      "Toggle Solid / Striped at the top to switch row fill across examples.",
    ],
    content: <PortfolioTable data={mockPortfolio} />,
  },
  {
    id: "projects",
    category: "dashboard",
    label: "Projects",
    title: "Projects pipeline",
    summary:
      "Canonical grid with #/checkbox/drag, row reorder, expandable subtasks panel, progress battery, infinite scroll.",
    expect: [
      "Expand a project row to reveal subtasks.",
      "Scroll down to load more rows in batches.",
    ],
    content: <ProjectsTable data={mockProjects} />,
  },
  {
    id: "flights",
    category: "dashboard",
    label: "Flights (ops)",
    title: "Flight operations",
    summary:
      "Ops board on canonical grid: # column, pinned select/code/origin, row drag, gate notes, infinite scroll.",
    expect: [
      "Search gates, cities, and flight codes.",
      "Expand delayed flights for operational notes.",
    ],
    content: <FlightsTable data={mockFlightsOperations} />,
  },
  {
    id: "engine-lab",
    category: "engine",
    label: "Engine lab",
    title: "Engine lab — capital program ledger",
    summary:
      "One canonical grid (~480 commitment lines or 10k virtual rows). Toggle ribbon features to enable sort, filter, pin, pagination, grouping, selection, range copy, detail rows, status badges, and currency formatting on the same table.",
    expect: [
      "Toggle Sort / Pin cols / Currency — behavior updates on the ledger without mounting new demos.",
      "Enable Virtual for async 10k-row streaming with skeleton cells.",
      "Enable Select for checkbox + row/column reorder; Range for keyboard selection and copy.",
    ],
    content: <EngineLabDemo />,
  },
  {
    id: "pivot",
    category: "engine",
    label: "Pivot table",
    title: "Pivot table — sales cross-tab",
    summary:
      "Headless computePivot cross-tab: region and category nest down the rows, quarter spreads across columns, revenue and units summed per intersection with subtotal and grand-total rows.",
    expect: [
      "Read revenue and units per region, category, and quarter at each intersection.",
      "Subtotal rows roll up each region; the grand-total row sums every measure.",
      "Toggle Quarter columns / Flat columns to collapse the column dimension.",
    ],
    content: <PivotDemo />,
  },
  {
    id: "nested-grouping",
    category: "engine",
    label: "Nested grouping",
    title: "Nested grouping — deals by region and stage",
    summary:
      "Multi-level grouping from buildGroupedFlatRows: region then stage flattened to render-ready rows, with expansion held as a plain set of group ids.",
    expect: [
      "Click a group header to expand or collapse it; the child count and amount show on the header.",
      "Use Expand all / Collapse all to fill or clear the expanded set.",
      "Leaf rows indent one level past their stage group.",
    ],
    content: <NestedGroupingDemo />,
  },
  {
    id: "row-outline-expansion",
    category: "engine",
    label: "Row outline expansion",
    title: "Row outline expansion — grouped TanStack rows",
    summary:
      "TanStack grouped rows wired to the row-outline expansion API: expand or collapse every group, or a single outline level, with amount summed per group.",
    expect: [
      "Expand all / Collapse all toggle every group at once.",
      "Expand level 0 / Expand level 1 open a single outline depth.",
      "Each group header shows its summed amount and child count.",
    ],
    content: <RowOutlineExpansionDemo />,
  },
];

export const EXAMPLE_CATEGORIES = (["dashboard", "engine"] as const).map((category) => ({
  category,
  label: EXAMPLE_CATEGORY_LABELS[category],
  examples: PLAYGROUND_EXAMPLES.filter((e) => e.category === category),
}));
