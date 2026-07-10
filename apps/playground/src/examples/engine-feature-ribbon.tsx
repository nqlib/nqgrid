import { Label, ToggleGroup, ToggleGroupItem, cn } from "@nqlib/nqui";
import {
  ENGINE_LAB_FEATURE_GROUPS,
  type EngineLabFeatureId,
} from "./engine-lab-config";

export function EngineFeatureRibbon({
  active,
  onToggle,
  className,
}: {
  active: ReadonlySet<EngineLabFeatureId>;
  onToggle: (id: EngineLabFeatureId, on: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-xl border border-border bg-muted/20 p-2",
        className,
      )}
      role="toolbar"
      aria-label="Engine features"
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        {ENGINE_LAB_FEATURE_GROUPS.map((group) => (
          <div key={group.id} className="flex min-w-0 flex-col gap-1.5">
            <Label className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </Label>
            <ToggleGroup
              type="multiple"
              value={[...active].filter((id) => group.features.some((f) => f.id === id))}
              onValueChange={(next) => {
                const nextSet = new Set(next as EngineLabFeatureId[]);
                for (const feature of group.features) {
                  const was = active.has(feature.id);
                  const now = nextSet.has(feature.id);
                  if (was !== now) onToggle(feature.id, now);
                }
              }}
              variant="outline"
              size="sm"
              className="flex flex-wrap justify-start gap-1"
            >
              {group.features.map((feature) => (
                <ToggleGroupItem
                  key={feature.id}
                  value={feature.id}
                  aria-label={feature.label}
                  title={feature.hint}
                  className="h-7 px-2.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {feature.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))}
      </div>
    </div>
  );
}
