"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";

// Inlined from becocharts `@/globals/constants/motion` (not part of the
// copied registry surface).
const CHART_INTRO_DURATION_MS = 1200;

export function generateEasedGradientStops(
  steps = 17,
  minOpacity = 0.05,
  maxOpacity = 0.9,
): Array<{ offset: string; opacity: number }> {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    const eased = Math.sin(t * Math.PI);
    const opacity = minOpacity + eased * (maxOpacity - minOpacity);
    return { offset: `${(t * 100).toFixed(1)}%`, opacity };
  });
}

export function LoadingShimmerPattern({ id }: { id: string }) {
  const reduceMotion = useReducedMotion();
  const gradientStops = generateEasedGradientStops();
  const patternWidth = 3;
  const startX = -1;
  const endX = 2;

  return (
    <>
      <linearGradient id={`${id}-shimmer-gradient`} x1="0" y1="0" x2="1" y2="0">
        {gradientStops.map(({ offset, opacity }) => (
          <stop key={offset} offset={offset} stopColor="white" stopOpacity={opacity} />
        ))}
      </linearGradient>
      <pattern
        id={`${id}-shimmer-pattern`}
        patternUnits="objectBoundingBox"
        patternContentUnits="objectBoundingBox"
        patternTransform="rotate(25)"
        width={patternWidth}
        height="1"
        x="0"
        y="0"
      >
        {reduceMotion ? (
          <rect y="0" width="1" height="1" fill={`url(#${id}-shimmer-gradient)`} x={startX} />
        ) : (
          <motion.rect
            y="0"
            width="1"
            height="1"
            fill={`url(#${id}-shimmer-gradient)`}
            initial={{ x: startX }}
            animate={{ x: endX }}
            transition={{
              duration: CHART_INTRO_DURATION_MS / 1000,
              ease: "linear",
              repeat: Infinity,
            }}
          />
        )}
      </pattern>
      <mask id={`${id}-shimmer-mask`}>
        <rect width="100%" height="100%" fill={`url(#${id}-shimmer-pattern)`} />
      </mask>
    </>
  );
}

export function useLoadingMaskId(prefix = "loading") {
  return `${prefix}-${useId().replace(/:/g, "")}`;
}
