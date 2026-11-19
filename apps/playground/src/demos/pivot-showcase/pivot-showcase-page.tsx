import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@nqlib/nqui";
import { DESIGN_STORY_IDS, DesignStories } from "./design-stories";
import { ExampleView } from "./example-view";
import { DEFAULT_PIVOT_LINK, PIVOT_EXAMPLES, resolvePivotLink, type PivotLinkTarget } from "./registry";

const PARAM = "pivot";

/** The "Design" tab (`?pivot=design` or `design:<story>`): stories of the 0.5.0 design props. */
const DESIGN = "design";

function readParam(): string | null {
  return new URLSearchParams(window.location.search).get(PARAM);
}

function readLink(): PivotLinkTarget {
  return resolvePivotLink(readParam()) ?? DEFAULT_PIVOT_LINK;
}

function readDesignStory(): string | null {
  const v = readParam();
  if (v === DESIGN) return DESIGN_STORY_IDS[0]!;
  return v?.startsWith(`${DESIGN}:`) && DESIGN_STORY_IDS.includes(v.slice(DESIGN.length + 1)) ? v.slice(DESIGN.length + 1) : null;
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
  const [designStory, setDesignStory] = useState<string | null>(readDesignStory);
  const [resetCount, setResetCount] = useState(0);
  const go = (id: string) => {
    if (id === DESIGN) {
      setDesignStory(DESIGN_STORY_IDS[0]!);
      writeLink(DESIGN);
      return;
    }
    const next = resolvePivotLink(id);
    if (!next) return;
    setDesignStory(null);
    setLink(next);
    writeLink(next.view.id);
  };
  const goStory = (story: string) => {
    setDesignStory(story);
    writeLink(`${DESIGN}:${story}`);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ToggleGroup
        type="single"
        variant="segmented"
        size="lg"
        value={designStory ? DESIGN : link.example.id}
        aria-label="Pivot example"
        onValueChange={(v: string) => v && go(v)}
        className="w-full sm:w-fit"
      >
        {PIVOT_EXAMPLES.map((e) => (
          <ToggleGroupItem key={e.id} value={e.id} className="flex-1 px-4 sm:flex-none">
            {e.title}
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem value={DESIGN} className="flex-1 px-4 sm:flex-none">
          Design
        </ToggleGroupItem>
      </ToggleGroup>
      {designStory ? (
        <DesignStories story={designStory} onStoryChange={goStory} />
      ) : (
        <ExampleView
          key={`${link.view.id}:${resetCount}`}
          example={link.example}
          view={link.view}
          onViewChange={go}
          onReset={() => setResetCount((n) => n + 1)}
        />
      )}
    </div>
  );
}
