import { useCallback, useEffect, useState } from "react";
import { EngineFeatureRibbon } from "./engine-feature-ribbon";
import { EngineLabTable } from "./engine-lab-table";
import type { EngineLabFeatureId, EngineLabIntegratedFeature } from "./engine-lab-config";

const STORAGE_KEY = "nqgrid-engine-lab-features-v2";

const DEFAULT_ACTIVE: EngineLabIntegratedFeature[] = ["sort", "pinColumns", "numberFormats"];

function readStoredFeatures(): Set<EngineLabFeatureId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_ACTIVE);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set(DEFAULT_ACTIVE);
    return new Set(parsed.filter((x): x is EngineLabFeatureId => typeof x === "string"));
  } catch {
    return new Set(DEFAULT_ACTIVE);
  }
}

export function EngineLabDemo() {
  const [active, setActive] = useState<Set<EngineLabFeatureId>>(() => readStoredFeatures());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...active]));
    } catch {
      /* ignore */
    }
  }, [active]);

  const onToggle = useCallback((id: EngineLabFeatureId, on: boolean) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <EngineFeatureRibbon active={active} onToggle={onToggle} />
      <EngineLabTable active={active} />
    </div>
  );
}
