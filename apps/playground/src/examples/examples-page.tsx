import { useEffect, useRef, useState } from "react";
import { Card, Skeleton, ToggleGroup, ToggleGroupItem, cn } from "@nqlib/nqui";
import { PlaygroundRowFillToggle } from "../playground-table-settings";
import {
  EXAMPLE_CATEGORIES,
  PLAYGROUND_EXAMPLES,
  type PlaygroundExample,
} from "./examples-registry";

type BrowseMode = "sidebar" | "scroll";

const BROWSE_MODE_KEY = "nqgrid-playground-examples-browse-mode-v1";

function readBrowseMode(): BrowseMode {
  try {
    const raw = localStorage.getItem(BROWSE_MODE_KEY);
    if (raw === "sidebar" || raw === "scroll") return raw;
  } catch {
    /* ignore */
  }
  return "sidebar";
}

function ExampleMeta({ example }: { example: PlaygroundExample }) {
  return (
    <header className="shrink-0 space-y-2 border-b border-border pb-4">
      <h2 className="text-base font-semibold tracking-tight">{example.title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{example.summary}</p>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">What to try</p>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          {example.expect.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </header>
  );
}

function LazyExampleBlock({ example }: { example: PlaygroundExample }) {
  const ref = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (mounted) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "480px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <section ref={ref} id={example.id} className="scroll-mt-6 space-y-4">
      <ExampleMeta example={example} />
      <div className="flex min-h-[24rem] min-w-0 flex-col">
        {mounted ? (
          example.content
        ) : (
          <div className="flex min-h-[24rem] flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full max-w-xl" />
            <Skeleton className="min-h-[18rem] flex-1 rounded-lg" />
          </div>
        )}
      </div>
    </section>
  );
}

function SidebarExamplesView() {
  const [activeId, setActiveId] = useState(PLAYGROUND_EXAMPLES[0]!.id);
  const active = PLAYGROUND_EXAMPLES.find((e) => e.id === activeId) ?? PLAYGROUND_EXAMPLES[0]!;

  return (
    <Card className="flex min-h-0 flex-1 flex-row gap-0 overflow-hidden py-0">
      <nav className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-border p-2" aria-label="Examples">
        {EXAMPLE_CATEGORIES.map(({ category, label, examples }) => (
          <div key={category} className="mb-2 last:mb-0">
            <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <div className="flex flex-col gap-0.5">
              {examples.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setActiveId(entry.id)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    entry.id === activeId
                      ? "bg-muted/40 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <ExampleMeta example={active} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{active.content}</div>
      </div>
    </Card>
  );
}

function ScrollExamplesView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-16 overflow-y-auto pb-12">
      {EXAMPLE_CATEGORIES.map(({ category, label, examples }) => (
        <div key={category} className="space-y-10">
          <div className="sticky top-0 z-10 -mx-1 border-b border-border bg-background/95 px-1 py-3 backdrop-blur-sm">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</h2>
          </div>
          <div className="flex flex-col gap-16">
            {examples.map((example) => (
              <LazyExampleBlock key={example.id} example={example} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ExamplesPage() {
  const [mode, setMode] = useState<BrowseMode>(() => readBrowseMode());

  useEffect(() => {
    try {
      localStorage.setItem(BROWSE_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {PLAYGROUND_EXAMPLES.length} examples — dashboard tables plus one engine lab with feature toggles.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <PlaygroundRowFillToggle />
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => {
              if (v === "sidebar" || v === "scroll") setMode(v);
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="sidebar" aria-label="Sidebar selection">
              Sidebar
            </ToggleGroupItem>
            <ToggleGroupItem value="scroll" aria-label="Scroll all examples">
              Scroll all
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      {mode === "sidebar" ? <SidebarExamplesView /> : <ScrollExamplesView />}
    </div>
  );
}
