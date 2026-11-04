import { useCallback, useEffect, useState } from "react";

/** Bind nqui ScrollArea viewport for infinite/virtual roots and horizontal pin divider. */
export function useEngineScrollViewport(trackScrollX = false) {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [scrolledX, setScrolledX] = useState(false);

  const viewportRef = useCallback((node: HTMLDivElement | null) => {
    setViewport(node);
  }, []);

  useEffect(() => {
    if (!viewport || !trackScrollX) return;
    const sync = () => setScrolledX(viewport.scrollLeft > 0);
    sync();
    viewport.addEventListener("scroll", sync, { passive: true });
    return () => viewport.removeEventListener("scroll", sync);
  }, [viewport, trackScrollX]);

  return { viewportRef, scrollRoot: viewport, scrolledX };
}
