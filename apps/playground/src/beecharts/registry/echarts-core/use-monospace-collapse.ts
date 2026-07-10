"use client";

import { useEffect, useState } from "react";
import { CHART_ANIMATION, prefersReducedMotion } from "./chart-animation-tokens";
import { usePartsSnapshot } from "./part-registry";

/** Monospace bars mount expanded, then animate to thin rest width. */
export function useMonospaceCollapse(dataEpoch: unknown, chartReadyEpoch = 0) {
  const parts = usePartsSnapshot();
  const hasMonospace = parts.some((p) => p.type === "bar" && p.variant === "monospace");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!hasMonospace || !chartReadyEpoch) return;

    // Reduced motion: skip the expand→collapse tween and settle collapsed.
    // setState runs inside the rAF callback (not synchronously in the effect
    // body) to avoid the cascading-render setState-in-effect smell.
    if (prefersReducedMotion()) {
      const raf = requestAnimationFrame(() => setCollapsed(true));
      return () => cancelAnimationFrame(raf);
    }

    let raf1 = 0;
    let raf2 = 0;
    let timer = 0;

    // Mount expanded, then animate to thin rest width.
    raf1 = requestAnimationFrame(() => {
      setCollapsed(false);
      raf2 = requestAnimationFrame(() => {
        timer = window.setTimeout(
          () => setCollapsed(true),
          CHART_ANIMATION.monospace.collapseDelayMs,
        );
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timer);
    };
  }, [hasMonospace, dataEpoch, chartReadyEpoch]);

  return collapsed;
}
