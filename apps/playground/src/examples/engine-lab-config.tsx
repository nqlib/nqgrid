export type EngineLabFeatureDef = {
  id: EngineLabFeatureId;
  label: string;
  hint: string;
};

export type EngineLabFeatureGroup = {
  id: string;
  label: string;
  features: EngineLabFeatureDef[];
};

/** Ribbon toggles — each enables behavior on the single Engine Lab table. */
export type EngineLabIntegratedFeature =
  | "sort"
  | "filter"
  | "pinColumns"
  | "pagination"
  | "grouping"
  | "infiniteRows"
  | "selectionLab"
  | "rangeSelect"
  | "masterDetail"
  | "richCells"
  | "numberFormats";

export type EngineLabFeatureId = EngineLabIntegratedFeature;

export const ENGINE_LAB_FEATURE_GROUPS: EngineLabFeatureGroup[] = [
  {
    id: "data",
    label: "Data",
    features: [
      { id: "sort", label: "Sort", hint: "Sort WBS, budget, and variance columns" },
      { id: "filter", label: "Filter", hint: "Search WBS, program, GL account, manager" },
      { id: "pagination", label: "Pages", hint: "25 commitment lines per page with footer" },
      { id: "grouping", label: "Group", hint: "Roll up lines by cost center" },
    ],
  },
  {
    id: "layout",
    label: "Layout",
    features: [
      { id: "pinColumns", label: "Pin cols", hint: "Freeze WBS + program while scrolling" },
      {
        id: "infiniteRows",
        label: "Virtual",
        hint: "Switch to 10k async rows (disables client-only toggles)",
      },
    ],
  },
  {
    id: "interaction",
    label: "Interaction",
    features: [
      {
        id: "selectionLab",
        label: "Select",
        hint: "Checkbox column, row + column reorder",
      },
      { id: "rangeSelect", label: "Range", hint: "Arrow keys + copy TSV selection" },
      { id: "masterDetail", label: "Detail", hint: "Expand journal notes on flagged lines" },
    ],
  },
  {
    id: "cells",
    label: "Cells",
    features: [
      { id: "richCells", label: "Status", hint: "Commitment badges (on track / at risk / …)" },
      { id: "numberFormats", label: "Currency", hint: "USD formatting on budget + actual" },
    ],
  },
];

export const ENGINE_LAB_ALL_FEATURES = ENGINE_LAB_FEATURE_GROUPS.flatMap((g) => g.features);

export function engineLabFeatureDef(id: EngineLabFeatureId): EngineLabFeatureDef | undefined {
  return ENGINE_LAB_ALL_FEATURES.find((f) => f.id === id);
}
