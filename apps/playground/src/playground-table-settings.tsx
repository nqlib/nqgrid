import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { RiSettings3Line } from "@remixicon/react";
import {
  Button,
  Checkbox,
  ScrollArea,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@nqlib/nqui";
import {
  ALL_NQGRID_FEATURE_IDS,
  NQGRID_FEATURES,
  formatEsmImportBlocks,
  resolveNqgridImportPlan,
  type NqgridFeatureId,
} from "@nqlib/nqgrid/configurator";
import {
  defaultNqgridLibraryConfig,
  mergeNqgridLibraryConfig,
  type NqgridLibraryConfig,
} from "./lib/nqgrid-styling";
import type { TableBodyFillMode } from "./lib/nqgrid-styling";
import {
  resolvePlaygroundGridBodyClass,
  resolvePlaygroundTableClassBundle,
  resolvePlaygroundTableColorTokens,
} from "./lib/playground-table-tokens";
import {
  playgroundSheetContentClass,
  playgroundSheetScrollClass,
} from "./lib/playground-sheet-chrome";

const LEGACY_FILL_KEY = "nqgrid-playground-table-body-fill";
const LIBRARY_KEY = "nqgrid-playground-library-v1";
const FEATURE_PLAN_KEY = "nqgrid-playground-configurator-features-v1";

function readLibraryConfig(): NqgridLibraryConfig {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        return mergeNqgridLibraryConfig(defaultNqgridLibraryConfig(), parsed as Partial<NqgridLibraryConfig>);
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const v = localStorage.getItem(LEGACY_FILL_KEY);
    if (v === "solid" || v === "striped") {
      return mergeNqgridLibraryConfig(defaultNqgridLibraryConfig(), { styles: { tableBodyFill: v } });
    }
  } catch {
    /* ignore */
  }
  return defaultNqgridLibraryConfig();
}

function readFeaturePlan(): NqgridFeatureId[] {
  try {
    const raw = localStorage.getItem(FEATURE_PLAN_KEY);
    if (!raw) return [...ALL_NQGRID_FEATURE_IDS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...ALL_NQGRID_FEATURE_IDS];
    const next = parsed.filter((x): x is NqgridFeatureId => typeof x === "string" && ALL_NQGRID_FEATURE_IDS.includes(x as NqgridFeatureId));
    return next.length > 0 ? next : [...ALL_NQGRID_FEATURE_IDS];
  } catch {
    return [...ALL_NQGRID_FEATURE_IDS];
  }
}

type Ctx = {
  libraryConfig: NqgridLibraryConfig;
  setLibraryConfig: (patch: Partial<NqgridLibraryConfig>) => void;
  setTableBodyFill: (v: Exclude<TableBodyFillMode, "none">) => void;
  selectedFeatureIds: NqgridFeatureId[];
  setPlannerFeature: (id: NqgridFeatureId, enabled: boolean) => void;
  selectAllPlannerFeatures: () => void;
  clearPlannerFeatures: () => void;
};

const PlaygroundTableSettingsContext = createContext<Ctx | null>(null);

export function PlaygroundTableSettingsProvider({ children }: { children: ReactNode }) {
  const [libraryConfig, setLibraryConfigState] = useState<NqgridLibraryConfig>(readLibraryConfig);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<NqgridFeatureId[]>(readFeaturePlan);

  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(libraryConfig));
    } catch {
      /* ignore */
    }
  }, [libraryConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(FEATURE_PLAN_KEY, JSON.stringify(selectedFeatureIds));
    } catch {
      /* ignore */
    }
  }, [selectedFeatureIds]);

  const setLibraryConfig = useCallback((patch: Partial<NqgridLibraryConfig>) => {
    setLibraryConfigState((prev) => mergeNqgridLibraryConfig(prev, patch));
  }, []);

  const setTableBodyFill = useCallback((v: Exclude<TableBodyFillMode, "none">) => {
    setLibraryConfigState((prev) => mergeNqgridLibraryConfig(prev, { styles: { tableBodyFill: v } }));
  }, []);

  const setPlannerFeature = useCallback((id: NqgridFeatureId, enabled: boolean) => {
    setSelectedFeatureIds((prev) => {
      const has = prev.includes(id);
      if (enabled && !has) return [...prev, id];
      if (!enabled && has) return prev.filter((x) => x !== id);
      return prev;
    });
  }, []);

  const selectAllPlannerFeatures = useCallback(() => {
    setSelectedFeatureIds([...ALL_NQGRID_FEATURE_IDS]);
  }, []);

  const clearPlannerFeatures = useCallback(() => {
    setSelectedFeatureIds([]);
  }, []);

  const value = useMemo(
    () => ({
      libraryConfig,
      setLibraryConfig,
      setTableBodyFill,
      selectedFeatureIds,
      setPlannerFeature,
      selectAllPlannerFeatures,
      clearPlannerFeatures,
    }),
    [
      libraryConfig,
      setLibraryConfig,
      setTableBodyFill,
      selectedFeatureIds,
      setPlannerFeature,
      selectAllPlannerFeatures,
      clearPlannerFeatures,
    ],
  );

  return (
    <PlaygroundTableSettingsContext.Provider value={value}>{children}</PlaygroundTableSettingsContext.Provider>
  );
}

export function usePlaygroundTableSettings(): Ctx {
  const ctx = useContext(PlaygroundTableSettingsContext);
  if (!ctx) {
    throw new Error("usePlaygroundTableSettings must be used within PlaygroundTableSettingsProvider");
  }
  return ctx;
}

export function usePlaygroundTableBodyClass(): string {
  const { libraryConfig } = usePlaygroundTableSettings();
  return useMemo(
    () => resolvePlaygroundTableClassBundle(libraryConfig).body,
    [libraryConfig],
  );
}

export function usePlaygroundResolvedTableTokens(config?: NqgridLibraryConfig) {
  const { libraryConfig } = usePlaygroundTableSettings();
  const resolved = config ?? libraryConfig;
  return useMemo(
    () => ({
      tokens: resolvePlaygroundTableColorTokens(resolved),
      bundle: resolvePlaygroundTableClassBundle(resolved),
      gridBody: resolvePlaygroundGridBodyClass(resolved),
    }),
    [resolved],
  );
}

export function PlaygroundRowFillToggle({ className }: { className?: string }) {
  const { libraryConfig, setTableBodyFill } = usePlaygroundTableSettings();
  const rowFill = libraryConfig.styles?.tableBodyFill ?? "solid";

  return (
    <ToggleGroup
      type="single"
      value={rowFill}
      onValueChange={(v) => v && setTableBodyFill(v as Exclude<TableBodyFillMode, "none">)}
      variant="outline"
      size="sm"
      className={className}
      aria-label="Row background"
    >
      <ToggleGroupItem value="solid" className="text-xs">
        Solid
      </ToggleGroupItem>
      <ToggleGroupItem value="striped" className="text-xs">
        Striped
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export function PlaygroundTableSettingsMenu() {
  const {
    libraryConfig,
    setLibraryConfig,
    selectedFeatureIds,
    setPlannerFeature,
    selectAllPlannerFeatures,
    clearPlannerFeatures,
  } = usePlaygroundTableSettings();

  const importSnippet = useMemo(() => {
    const plan = resolveNqgridImportPlan(selectedFeatureIds.length > 0 ? selectedFeatureIds : ALL_NQGRID_FEATURE_IDS);
    return formatEsmImportBlocks(plan);
  }, [selectedFeatureIds]);

  const copyImports = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(importSnippet);
    } catch {
      /* ignore */
    }
  }, [importSnippet]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <RiSettings3Line className="size-4 shrink-0" aria-hidden />
          Configure
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className={playgroundSheetContentClass}>
        <SheetHeader className="shrink-0 border-b border-border/60 px-6 py-4 text-left">
          <SheetTitle className="text-base">nqgrid configurator</SheetTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Mirrors <code className="rounded bg-muted px-1">@nqlib/nqgrid/configurator</code>: library runtime options
            and a feature-based import plan.
          </p>
        </SheetHeader>
        <ScrollArea className={playgroundSheetScrollClass}>
          <div className="space-y-6 px-6 py-4">
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Library runtime</h3>
              <p className="text-xs text-muted-foreground">
                <code className="rounded bg-muted px-1">NqgridLibraryConfig.styles.tableBodyFill</code> →{" "}
                <code className="rounded bg-muted px-1">tableBodyClassFromLibraryConfig</code>
              </p>
              <PlaygroundRowFillToggle className="w-full justify-stretch" />
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Percent columns</h3>
              <p className="text-xs text-muted-foreground">
                <code className="rounded bg-muted px-1">NqgridLibraryConfig.styles.percentProgressDisplay</code> — used by
                the Projects demo progress column.
              </p>
              <ToggleGroup
                type="single"
                value={libraryConfig.styles?.percentProgressDisplay ?? "battery"}
                onValueChange={(v) => {
                  if (v === "plain" || v === "battery") {
                    setLibraryConfig({ styles: { percentProgressDisplay: v } });
                  }
                }}
                variant="outline"
                size="sm"
                className="w-full justify-stretch"
                aria-label="Progress column style"
              >
                <ToggleGroupItem value="plain" className="text-xs">
                  Plain text
                </ToggleGroupItem>
                <ToggleGroupItem value="battery" className="text-xs">
                  Battery bar
                </ToggleGroupItem>
              </ToggleGroup>
            </section>

            <Separator />

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Import planner</h3>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllPlannerFeatures}>
                    Select all
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearPlannerFeatures}>
                    Clear
                  </Button>
                  <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" onClick={copyImports}>
                    Copy imports
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Toggle feature areas, then paste the generated lines into your app. Add{" "}
                <code className="rounded bg-muted px-1">import type {"{ … }"}</code> for fixture row types as needed.
              </p>
              <ul className="space-y-3">
                {NQGRID_FEATURES.map((f) => {
                  const checked = selectedFeatureIds.includes(f.id);
                  return (
                    <li
                      key={f.id}
                      className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 dark:bg-muted/10"
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => setPlannerFeature(f.id, !!v)}
                          className="mt-0.5"
                          aria-label={`Include ${f.label} in import plan`}
                        />
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="block text-sm font-medium leading-snug text-foreground">{f.label}</span>
                          <span className="block text-xs leading-normal text-muted-foreground">{f.summary}</span>
                          {f.configure.length > 0 ? (
                            <ul className="list-inside list-disc text-xs text-muted-foreground">
                              {f.configure.map((c) => (
                                <li key={c.key}>
                                  <span className="font-medium text-foreground/90">{c.key}:</span> {c.hint}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Generated ESM</h3>
              <Textarea
                readOnly
                value={importSnippet}
                className={cn("min-h-[10rem] resize-none font-mono text-xs leading-relaxed")}
                spellCheck={false}
              />
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
