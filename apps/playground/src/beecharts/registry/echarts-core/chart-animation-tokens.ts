/**
 * Single source of truth for BeeCharts ECharts animation timing and easing.
 *
 * Retune every chart intro by changing {@link CHART_INTRO_DURATION_MS}.
 * Per-chart blocks below only override stagger / easing when the motion type
 * needs it (line draw, fold, etc.) — not a separate duration ladder.
 *
 * Applied in `apply-chart-animation.ts` via `applyChartUiToOption()` on every
 * ECharts compile path. Monospace fold rAF reads the same intro duration.
 */

export const CHART_EASING = {
  /** Default intro / enter */
  intro: "cubicOut",
  /** Default data updates */
  update: "cubicOut",
  /** Morph / fold / line draw */
  morph: "cubicInOut",
} as const;

export type ChartEasingName = (typeof CHART_EASING)[keyof typeof CHART_EASING];

/** Primary intro duration — monospace bar height, cartesian bars, radial, pie, treemap rollout, etc. */
export const CHART_INTRO_DURATION_MS = 1200;

/** Data-update tween — half intro keeps updates snappy. */
export const CHART_UPDATE_DURATION_MS = CHART_INTRO_DURATION_MS / 2;

/** @deprecated Use {@link CHART_INTRO_DURATION_MS}. Kept for bar/monospace call sites. */
export const CHART_BAR_DURATION_MS = CHART_INTRO_DURATION_MS;

export const CHART_ANIMATION = {
  /** Spread onto series that only need the shared intro tempo. */
  intro: {
    duration: CHART_INTRO_DURATION_MS,
    easing: CHART_EASING.intro,
  },
  root: {
    duration: CHART_INTRO_DURATION_MS,
    durationUpdate: CHART_UPDATE_DURATION_MS,
    easing: CHART_EASING.intro,
    easingUpdate: CHART_EASING.update,
    threshold: 4000,
  },
  bar: {
    duration: CHART_INTRO_DURATION_MS,
    staggerMs: 55,
    waterfallStaggerMs: 80,
  },
  line: {
    duration: CHART_INTRO_DURATION_MS,
    seriesStaggerMs: 120,
    easing: CHART_EASING.morph,
  },
  area: {
    duration: CHART_INTRO_DURATION_MS,
    seriesStaggerMs: 160,
    easing: CHART_EASING.morph,
  },
  composed: {
    duration: CHART_INTRO_DURATION_MS,
    seriesStaggerMs: 120,
    easing: CHART_EASING.morph,
  },
  pie: {
    duration: CHART_INTRO_DURATION_MS,
    staggerMs: 90,
    easing: CHART_EASING.intro,
  },
  /** Polar radial bars — rings / petals sweep in sync. */
  radial: {
    duration: CHART_INTRO_DURATION_MS,
    easing: CHART_EASING.intro,
  },
  gauge: {
    duration: CHART_INTRO_DURATION_MS,
    easing: CHART_EASING.morph,
  },
  radar: {
    duration: CHART_INTRO_DURATION_MS,
    pointStaggerMs: 100,
    easing: CHART_EASING.intro,
  },
  scatter: {
    duration: CHART_INTRO_DURATION_MS,
    staggerMs: 12,
    easing: CHART_EASING.intro,
  },
  heatmap: {
    duration: CHART_INTRO_DURATION_MS,
    staggerMs: 6,
    easing: CHART_EASING.intro,
  },
  funnel: {
    duration: CHART_INTRO_DURATION_MS,
    staggerMs: 100,
    easing: CHART_EASING.intro,
  },
  sankey: {
    duration: CHART_INTRO_DURATION_MS,
    easing: CHART_EASING.intro,
  },
  treemap: {
    duration: CHART_INTRO_DURATION_MS,
    easing: CHART_EASING.intro,
  },
  waterfall: {
    duration: CHART_INTRO_DURATION_MS,
    staggerMs: 80,
    easing: CHART_EASING.intro,
  },
  custom: {
    seriesStaggerMs: 80,
  },
  /** Monospace bar — fold rAF + intro height share {@link CHART_INTRO_DURATION_MS}. */
  monospace: {
    seriesId: "bee-monospace-bar",
    collapsedScale: 0.1,
    expandedBandRatio: 0.72,
    collapseDelayMs: 700,
    foldDurationMs: CHART_INTRO_DURATION_MS,
    foldEasing: CHART_EASING.morph,
    introStaggerMs: 55,
    foldTauDivisor: 4,
    foldSettleEpsilon: 0.002,
    maxFrameDeltaMs: 32,
  },
  staggerCapMs: CHART_INTRO_DURATION_MS + 80,
} as const;

export const BEE_MONOSPACE_SERIES_ID = CHART_ANIMATION.monospace.seriesId;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function createStaggerDelay(staggerMs: number) {
  return (dataIndex: number) =>
    Math.min(dataIndex * staggerMs, CHART_ANIMATION.staggerCapMs);
}

export function seriesIndexStagger(seriesIndex: number, staggerMs: number) {
  return seriesIndex * staggerMs;
}

/** Target fold scale for a monospace bar (1 = expanded, collapsedScale = thin). */
export function monospaceTargetScale(
  collapsed: boolean,
  hoveredIndex: number | null,
  index: number,
): number {
  const { collapsedScale } = CHART_ANIMATION.monospace;
  return !collapsed || hoveredIndex === index ? 1 : collapsedScale;
}

/** Exponential ease step for monospace fold rAF — tuned to {@link CHART_ANIMATION.monospace.foldDurationMs}. */
export function stepMonospaceFold(current: number, target: number, dtMs: number): number {
  const { foldDurationMs, foldTauDivisor, foldSettleEpsilon } = CHART_ANIMATION.monospace;
  const tau = foldDurationMs / foldTauDivisor;
  const t = 1 - Math.exp(-dtMs / tau);
  const next = current + (target - current) * t;
  if (Math.abs(next - target) < foldSettleEpsilon) return target;
  return next;
}

/** ECharts series animation fields for monospace custom (height intro only; fold is rAF). */
export function monospaceSeriesAnimationFields() {
  const { bar, intro, monospace } = CHART_ANIMATION;
  return {
    animation: true,
    animationDuration: bar.duration,
    animationEasing: intro.easing,
    animationDelay: createStaggerDelay(monospace.introStaggerMs),
    animationDurationUpdate: 0,
    animationEasingUpdate: CHART_ANIMATION.monospace.foldEasing,
  };
}

/** setOption patch while rAF drives fold width — disables ECharts update tween. */
export function monospaceFoldPatchFields() {
  return {
    animation: false,
    animationDurationUpdate: 0,
  } as const;
}
