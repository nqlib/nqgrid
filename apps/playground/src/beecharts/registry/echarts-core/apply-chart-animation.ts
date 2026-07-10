import type { EChartsOption } from "echarts";
import {
  CHART_ANIMATION,
  CHART_EASING,
  createStaggerDelay,
  monospaceSeriesAnimationFields,
  prefersReducedMotion,
  seriesIndexStagger,
} from "./chart-animation-tokens";

type SeriesLike = Record<string, unknown> & {
  type?: string;
  data?: unknown;
  beeMonospace?: boolean;
  coordinateSystem?: string;
};

const ROOT_ANIMATION = {
  animation: true,
  animationDuration: CHART_ANIMATION.root.duration,
  animationEasing: CHART_ANIMATION.root.easing,
  animationDurationUpdate: CHART_ANIMATION.root.durationUpdate,
  animationEasingUpdate: CHART_ANIMATION.root.easingUpdate,
  animationThreshold: CHART_ANIMATION.root.threshold,
} as const;

function seriesIntroAnimation(series: SeriesLike, seriesIndex: number): SeriesLike {
  if (series.animation === false) return series;

  const type = series.type;
  // ECharts bar/gauge series only animate when `animation: true` is set on the series
  // (root-level animation is ignored by SeriesModel.isAnimationEnabled()).
  // Annotate as SeriesLike so the `Record<string, unknown>` index signature is kept —
  // an object-literal spread would otherwise drop it and hide props like `silent`/`name`.
  const base: SeriesLike = { ...series, animation: true };

  switch (type) {
    case "bar": {
      if (base.silent === true || base.name === "__wf_placeholder__") {
        return { ...base, animation: false };
      }
      if (base.coordinateSystem === "polar") {
        return {
          ...base,
          animationDuration: CHART_ANIMATION.radial.duration,
          animationEasing: CHART_ANIMATION.radial.easing,
          animationDelay: 0,
        };
      }
      if (base.name === "__wf_values__") {
        return {
          ...base,
          animationDuration: CHART_ANIMATION.bar.duration,
          animationEasing: CHART_EASING.intro,
          animationDelay: createStaggerDelay(CHART_ANIMATION.bar.waterfallStaggerMs),
        };
      }
      return {
        ...base,
        animationDuration: CHART_ANIMATION.bar.duration,
        animationEasing: CHART_EASING.intro,
        animationDelay: createStaggerDelay(CHART_ANIMATION.bar.staggerMs),
      };
    }
    case "line": {
      const hasArea = base.areaStyle != null;
      const line = hasArea ? CHART_ANIMATION.area : CHART_ANIMATION.line;
      return {
        ...base,
        animationDuration: line.duration,
        animationEasing: line.easing,
        animationDelay:
          base.animationDelay ??
          seriesIndexStagger(seriesIndex, line.seriesStaggerMs),
      };
    }
    case "pie":
      return {
        ...base,
        animationDuration: CHART_ANIMATION.pie.duration,
        animationEasing: CHART_ANIMATION.pie.easing,
        animationDelay: createStaggerDelay(CHART_ANIMATION.pie.staggerMs),
      };
    case "gauge":
      return {
        ...base,
        animationDuration: CHART_ANIMATION.gauge.duration,
        animationEasing: CHART_ANIMATION.gauge.easing,
      };
    case "radar":
      return {
        ...base,
        animationDuration: CHART_ANIMATION.radar.duration,
        animationEasing: CHART_ANIMATION.radar.easing,
        animationDelay: (dataIndex: number) =>
          dataIndex * CHART_ANIMATION.radar.pointStaggerMs,
      };
    case "scatter":
      return {
        ...base,
        animationDuration: CHART_ANIMATION.scatter.duration,
        animationEasing: CHART_ANIMATION.scatter.easing,
        animationDelay: createStaggerDelay(CHART_ANIMATION.scatter.staggerMs),
      };
    case "heatmap":
      return {
        ...base,
        animationDuration: CHART_ANIMATION.heatmap.duration,
        animationEasing: CHART_ANIMATION.heatmap.easing,
        animationDelay: createStaggerDelay(CHART_ANIMATION.heatmap.staggerMs),
      };
    case "funnel":
      return {
        ...base,
        animationDuration: CHART_ANIMATION.funnel.duration,
        animationEasing: CHART_ANIMATION.funnel.easing,
        animationDelay: createStaggerDelay(CHART_ANIMATION.funnel.staggerMs),
      };
    case "sankey":
      return {
        ...base,
        animationDuration: CHART_ANIMATION.sankey.duration,
        animationEasing: CHART_ANIMATION.sankey.easing,
      };
    case "treemap":
      return {
        ...base,
        animationDuration: CHART_ANIMATION.treemap.duration,
        animationDurationUpdate: CHART_ANIMATION.treemap.duration,
        animationEasing: CHART_ANIMATION.treemap.easing,
        animationEasingUpdate: CHART_ANIMATION.treemap.easing,
      };
    case "waterfall":
      return {
        ...base,
        animationDuration: CHART_ANIMATION.waterfall.duration,
        animationEasing: CHART_ANIMATION.waterfall.easing,
        animationDelay: createStaggerDelay(CHART_ANIMATION.waterfall.staggerMs),
      };
    case "custom":
      if (base.beeMonospace) {
        return { ...base, ...monospaceSeriesAnimationFields() };
      }
      return {
        ...base,
        animationDuration: CHART_ANIMATION.intro.duration,
        animationEasing: CHART_ANIMATION.intro.easing,
        animationDelay: seriesIndexStagger(
          seriesIndex,
          CHART_ANIMATION.custom.seriesStaggerMs,
        ),
      };
    default:
      if (base.beeMonospace) {
        return { ...base, ...monospaceSeriesAnimationFields() };
      }
      return {
        ...base,
        animationDuration: CHART_ANIMATION.intro.duration,
        animationEasing: CHART_ANIMATION.intro.easing,
        animationDelay: seriesIndexStagger(
          seriesIndex,
          CHART_ANIMATION.custom.seriesStaggerMs,
        ),
      };
  }
}

function normalizeSeries(option: EChartsOption): SeriesLike[] {
  if (!option.series) return [];
  return (Array.isArray(option.series) ? option.series : [option.series]) as SeriesLike[];
}

/** Apply intro motion defaults — respects `prefers-reduced-motion`. */
export function applyChartAnimationToOption(option: EChartsOption): EChartsOption {
  const reduced = prefersReducedMotion();
  if (reduced) {
    return {
      ...option,
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
    };
  }

  const seriesList = normalizeSeries(option);
  if (!seriesList.length) {
    return { ...ROOT_ANIMATION, ...option, animation: true };
  }

  return {
    ...ROOT_ANIMATION,
    ...option,
    animation: option.animation ?? true,
    series: seriesList.map((series, index) => seriesIntroAnimation(series, index)) as EChartsOption["series"],
  };
}

export function optionHasAnimatedSeries(option: EChartsOption): boolean {
  return normalizeSeries(option).some((series) => {
    const data = series.data;
    if (Array.isArray(data)) return data.length > 0;
    return data != null;
  });
}

/** Longest intro tween (duration + stagger) — used to guard merge updates during enter. */
export function maxIntroDurationMs(option: EChartsOption): number {
  const rootDuration =
    typeof option.animationDuration === "number"
      ? option.animationDuration
      : CHART_ANIMATION.root.duration;

  let max = rootDuration;
  for (const series of normalizeSeries(option)) {
    const duration =
      typeof series.animationDuration === "number"
        ? series.animationDuration
        : rootDuration;
    let delay = 0;
    const animationDelay = series.animationDelay;
    if (typeof animationDelay === "function") {
      const dataLen = Array.isArray(series.data) ? series.data.length : 1;
      delay = animationDelay(Math.max(0, dataLen - 1)) as number;
    } else if (typeof animationDelay === "number") {
      delay = animationDelay;
    }
    max = Math.max(max, duration + delay);
  }
  return max + 50;
}
