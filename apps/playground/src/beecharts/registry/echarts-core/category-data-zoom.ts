import type { DataZoomComponentOption } from "echarts";

export const DATA_ZOOM_SLIDER_HEIGHT = 52;

type CategoryZoomOptions = {
  /** Category axis dimension — `x` for vertical bars/lines, `y` for horizontal bars. */
  axisDim?: "x" | "y";
  axisIndex?: number;
  /** Chart kind — tunes slider mini-preview height. */
  chartVariant?: "line" | "area" | "bar" | "composed" | "waterfall";
};

/** Drag-pan + shift-wheel zoom on chart, plus a themed overview slider. */
export function buildCategoryDataZoom(
  enabled: boolean,
  options: CategoryZoomOptions = {},
): DataZoomComponentOption[] | undefined {
  if (!enabled) return undefined;

  const axisDim = options.axisDim ?? "x";
  const axisIndex = options.axisIndex ?? 0;
  const axisKey = axisDim === "y" ? "yAxisIndex" : "xAxisIndex";
  const sliderHeight =
    options.chartVariant === "area" ||
    options.chartVariant === "line" ||
    options.chartVariant === "bar" ||
    options.chartVariant === "composed" ||
    options.chartVariant === "waterfall"
      ? DATA_ZOOM_SLIDER_HEIGHT
      : 40;

  const inside: DataZoomComponentOption = {
    type: "inside",
    [axisKey]: axisIndex,
    filterMode: "filter",
    zoomOnMouseWheel: "shift",
    moveOnMouseMove: true,
    moveOnMouseWheel: false,
  };

  const slider: DataZoomComponentOption =
    axisDim === "y"
      ? {
          type: "slider",
          [axisKey]: axisIndex,
          orient: "vertical",
          right: 6,
          width: 22,
          brushSelect: false,
          showDetail: false,
          showDataShadow: true,
          realtime: true,
          throttle: 40,
          borderColor: "transparent",
        }
      : {
          type: "slider",
          [axisKey]: axisIndex,
          bottom: 6,
          height: sliderHeight,
          brushSelect: false,
          showDetail: false,
          showDataShadow: true,
          realtime: true,
          throttle: 40,
          borderColor: "transparent",
        };

  return [inside, slider];
}

/** Pan/zoom dense heatmap grids — drag to move, scroll to zoom both axes. */
export function buildHeatmapDataZoom(
  enabled: boolean,
): DataZoomComponentOption[] | undefined {
  if (!enabled) return undefined;

  return [
    {
      type: "inside",
      xAxisIndex: 0,
      yAxisIndex: 0,
      filterMode: "filter",
      zoomOnMouseWheel: true,
      moveOnMouseMove: true,
      moveOnMouseWheel: false,
    },
    {
      type: "slider",
      xAxisIndex: 0,
      bottom: 0,
      height: 16,
      showDetail: false,
      brushSelect: true,
    },
    {
      type: "slider",
      yAxisIndex: 0,
      left: 0,
      width: 16,
      showDetail: false,
      brushSelect: true,
    },
  ];
}

export function gridBottomWithZoom(hasZoom: boolean, base = 48): number {
  return hasZoom ? base + DATA_ZOOM_SLIDER_HEIGHT + 4 : base;
}
