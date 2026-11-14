import { useEffect, useState } from "react";
import { Button, ScrollArea, cn } from "@nqlib/nqui";

/** Read-only JSON / code in a bounded nqui ScrollArea. */
export function CodeBlock({ code, label, className }: { code: string; label: string; className?: string }) {
  return (
    <ScrollArea orientation="both" fadeMask={false} className={cn("h-80 rounded-lg border border-border/70 bg-muted/40", className)}>
      <pre className="p-3 font-mono text-xs leading-relaxed text-foreground/90" aria-label={label} tabIndex={0}>
        {code}
      </pre>
    </ScrollArea>
  );
}

/** Copies `text`; the label confirms for two seconds. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => setState("copied"),
          () => setState("failed"),
        )
      }
    >
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}</span>
    </Button>
  );
}
