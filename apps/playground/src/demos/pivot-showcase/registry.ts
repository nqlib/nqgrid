import { financeExample } from "./examples/finance";
import { salesWorkbenchExample } from "./examples/sales-workbench";
import { scaleExample } from "./examples/scale";
import type { PivotExample, PivotExampleView } from "./types";

/**
 * The pivot showcase: as few examples as cover every feature. Each feature is explained one by one
 * in the docs (`docs.ts`); the examples link there.
 */
export const PIVOT_EXAMPLES: readonly PivotExample[] = [salesWorkbenchExample, financeExample, scaleExample];

/** `?pivot=` ids of the former "Planning pivot" presets and showcase scenarios → example or view id. */
export const LEGACY_PIVOT_ALIASES: Readonly<Record<string, string>> = {
  planning: "sales",
  dates: "sales",
  calc: "sales",
  filter: "sales",
  fields: "sales",
  columns: "sales",
  statement: "income",
  fpa: "finance",
  big: "scale",
  "big-250k": "scale-250k",
  "big-500k": "scale-500k",
};

export interface PivotLinkTarget {
  readonly example: PivotExample;
  readonly view: PivotExampleView;
}

const byLinkId = new Map<string, PivotLinkTarget>();
for (const example of PIVOT_EXAMPLES) {
  for (const view of example.views) byLinkId.set(view.id, { example, view });
  if (!byLinkId.has(example.id)) byLinkId.set(example.id, { example, view: example.views[0] });
}

/** Resolve a `?pivot=` value (example id, view id or legacy alias); unknown → `null`. */
export function resolvePivotLink(id: string | null | undefined): PivotLinkTarget | null {
  if (!id) return null;
  return byLinkId.get(id) ?? (Object.hasOwn(LEGACY_PIVOT_ALIASES, id) ? (byLinkId.get(LEGACY_PIVOT_ALIASES[id]!) ?? null) : null);
}

export const DEFAULT_PIVOT_LINK: PivotLinkTarget = { example: PIVOT_EXAMPLES[0]!, view: PIVOT_EXAMPLES[0]!.views[0] };
