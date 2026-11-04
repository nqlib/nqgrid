import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Grow `visibleRows` when a sentinel intersects `root` (e.g. ScrollArea viewport via `viewportRef`).
 * Headless: no UI imports — pass `root` from your scroll container ref.
 */
export function useInfiniteVisibleRows<T>(
  rows: readonly T[],
  initialCount: number,
  step = initialCount,
  root: Element | null = null,
) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasMore = visibleCount < rows.length;

  const resetVisibleRows = useCallback(() => {
    setVisibleCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (!hasMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisibleCount((current) => Math.min(current + step, rows.length));
      },
      { root, rootMargin: "160px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, root, rows.length, step]);

  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);

  return { hasMore, resetVisibleRows, sentinelRef, visibleRows };
}
