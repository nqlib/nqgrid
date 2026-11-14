import { useState } from "react";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from "@nqlib/nqui";
import { DEFAULT_PIVOT_LINK, PIVOT_SCENARIOS, resolvePivotLink, type PivotLinkTarget } from "./registry";
import { ScenarioView } from "./scenario-view";

const PARAM = "pivot";

function readLink(): PivotLinkTarget {
  return resolvePivotLink(new URLSearchParams(window.location.search).get(PARAM)) ?? DEFAULT_PIVOT_LINK;
}

/** Keep `?pivot=<variant id>` in the address bar (other params untouched) so every view is linkable. */
function writeLink(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, id);
  window.history.replaceState(window.history.state, "", url);
}

/**
 * Guided pivot showcase: a scenario list (a select on narrow screens) and the current scenario.
 * `?pivot=<id>` deep-links a scenario or one of its variants; the old preset ids still work.
 */
export function PivotShowcasePage() {
  const [link, setLink] = useState<PivotLinkTarget>(readLink);
  const [resetCount, setResetCount] = useState(0);
  const go = (id: string) => {
    const next = resolvePivotLink(id);
    if (!next) return;
    setLink(next);
    writeLink(next.variant.id);
  };
  const index = PIVOT_SCENARIOS.indexOf(link.scenario);

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
      <nav aria-label="Pivot scenarios" className="lg:sticky lg:top-4 lg:w-60 lg:shrink-0">
        <div className="lg:hidden">
          <Select value={link.scenario.id} onValueChange={go}>
            <SelectTrigger aria-label="Scenario" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIVOT_SCENARIOS.map((s, i) => (
                <SelectItem key={s.id} value={s.id}>
                  {i + 1}. {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ol className="hidden flex-col gap-0.5 lg:flex">
          {PIVOT_SCENARIOS.map((s, i) => {
            const current = s === link.scenario;
            return (
              <li key={s.id}>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-current={current ? "page" : undefined}
                  onClick={() => go(s.id)}
                  className={cn(
                    "h-auto w-full justify-start gap-2.5 px-2.5 py-2 text-left font-normal whitespace-normal",
                    current ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] tabular-nums",
                      current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">{s.title}</span>
                </Button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="min-w-0 flex-1">
        <ScenarioView
          key={`${link.variant.id}:${resetCount}`}
          scenario={link.scenario}
          variant={link.variant}
          onVariantChange={go}
          onReset={() => setResetCount((n) => n + 1)}
        />
        <div className="mt-4 flex justify-between gap-2">
          {index > 0 ? (
            <Button variant="outline" size="sm" onClick={() => go(PIVOT_SCENARIOS[index - 1]!.id)}>
              ← {PIVOT_SCENARIOS[index - 1]!.title}
            </Button>
          ) : (
            <span />
          )}
          {index < PIVOT_SCENARIOS.length - 1 ? (
            <Button variant="outline" size="sm" onClick={() => go(PIVOT_SCENARIOS[index + 1]!.id)}>
              {PIVOT_SCENARIOS[index + 1]!.title} →
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
