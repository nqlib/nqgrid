import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@nqlib/nqui";
import { ExampleView } from "./example-view";
import { DEFAULT_PIVOT_LINK, PIVOT_EXAMPLES, resolvePivotLink, type PivotLinkTarget } from "./registry";

const PARAM = "pivot";

function readLink(): PivotLinkTarget {
  return resolvePivotLink(new URLSearchParams(window.location.search).get(PARAM)) ?? DEFAULT_PIVOT_LINK;
}

/** Keep `?pivot=<view id>` in the address bar (other params untouched) so every view is linkable. */
function writeLink(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, id);
  window.history.replaceState(window.history.state, "", url);
}

/**
 * Pivot showcase: three examples that together exercise every pivot feature (each feature is
 * explained one by one in the docs the examples link to). `?pivot=<id>` deep-links an example or one
 * of its views; ids of the former presets and scenarios still resolve.
 */
export function PivotShowcasePage() {
  const [link, setLink] = useState<PivotLinkTarget>(readLink);
  const [resetCount, setResetCount] = useState(0);
  const go = (id: string) => {
    const next = resolvePivotLink(id);
    if (!next) return;
    setLink(next);
    writeLink(next.view.id);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ToggleGroup
        type="single"
        variant="segmented"
        size="lg"
        value={link.example.id}
        aria-label="Pivot example"
        onValueChange={(v: string) => v && go(v)}
        className="w-full sm:w-fit"
      >
        {PIVOT_EXAMPLES.map((e) => (
          <ToggleGroupItem key={e.id} value={e.id} className="flex-1 px-4 sm:flex-none">
            {e.title}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ExampleView
        key={`${link.view.id}:${resetCount}`}
        example={link.example}
        view={link.view}
        onViewChange={go}
        onReset={() => setResetCount((n) => n + 1)}
      />
    </div>
  );
}
