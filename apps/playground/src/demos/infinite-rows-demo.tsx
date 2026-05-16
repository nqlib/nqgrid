import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollArea } from "@nqlib/nqui";
import { useInfiniteVisibleRows } from "@nqlib/nqgrid";

export function InfiniteRowsDemo() {
  const items = useMemo(() => Array.from({ length: 400 }, (_, i) => ({ id: String(i), label: `Row ${i + 1}` })), []);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const captureRef = useCallback((n: HTMLDivElement | null) => setScrollRoot(n), []);

  const { visibleRows, sentinelRef, hasMore, resetVisibleRows } = useInfiniteVisibleRows(items, 20, 40, scrollRoot);

  useEffect(() => {
    resetVisibleRows();
  }, [resetVisibleRows]);

  return (
    <div className="flex max-h-[min(50dvh,360px)] flex-col gap-2 rounded-xl border p-3">
      <p className="text-sm text-muted-foreground">
        <code className="rounded bg-muted px-1">useInfiniteVisibleRows</code> sentinel pattern (same engine as flights footer).
      </p>
      <ScrollArea className="h-64" viewportRef={captureRef}>
        <div className="p-2">
          <ul className="text-sm">
            {visibleRows.map((r) => (
              <li key={r.id} className="border-b py-1">
                {r.label}
              </li>
            ))}
          </ul>
          {hasMore ? <div ref={sentinelRef} className="h-2 shrink-0" aria-hidden /> : null}
        </div>
      </ScrollArea>
    </div>
  );
}
