import { NQGRID_FEATURES, type NqgridFeatureId } from "./manifest";

export interface NqgridImportModulePlan {
  readonly entry: (typeof NQGRID_FEATURES)[number]["entry"];
  readonly names: readonly string[];
}

function featureById(id: NqgridFeatureId) {
  const f = NQGRID_FEATURES.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown nqgrid feature id: ${id}`);
  return f;
}

/** Dedupe named exports per package entry for the selected feature ids. */
export function resolveNqgridImportPlan(featureIds: readonly NqgridFeatureId[]): NqgridImportModulePlan[] {
  const byEntry = new Map<string, Set<string>>();

  for (const id of featureIds) {
    const f = featureById(id);
    let set = byEntry.get(f.entry);
    if (!set) {
      set = new Set();
      byEntry.set(f.entry, set);
    }
    for (const n of f.namedExports) {
      if (n.startsWith("type ")) continue;
      set.add(n);
    }
  }

  return [...byEntry.entries()]
    .map(([entry, set]) => ({
      entry: entry as NqgridImportModulePlan["entry"],
      names: [...set].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.entry.localeCompare(b.entry));
}

/** One ESM import line per entry (sorted). */
export function formatEsmImportBlocks(plan: readonly NqgridImportModulePlan[]): string {
  return plan
    .map(({ entry, names }) => {
      if (names.length === 0) return "";
      return `import { ${names.join(", ")} } from "${entry}";`;
    })
    .filter(Boolean)
    .join("\n");
}
