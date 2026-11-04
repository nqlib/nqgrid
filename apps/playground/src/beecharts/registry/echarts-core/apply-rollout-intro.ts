"use client";

import type { EChartsType } from "echarts/core";
import { initProps } from "echarts/lib/animation/basicTransition.js";
import * as graphic from "echarts/lib/util/graphic.js";
import { prefersReducedMotion } from "./chart-animation-tokens";

type GroupLike = {
  getBoundingRect(): { x: number; y: number; width: number; height: number };
  setClipPath(clip: graphic.Rect): void;
  removeClipPath(): void;
};

type TreemapViewLike = {
  group?: GroupLike;
  _containerGroup?: GroupLike;
};

type SeriesModelLike = {
  subType?: string;
  __viewId?: string;
  isAnimationEnabled(): boolean;
};

/**
 * ECharts treemap skips `_doAnimation` on first render (`isInit`).
 * Sankey uses a horizontal clip-path wipe instead — mirror that for treemap.
 */
export function applyRolloutIntroReveal(instance: EChartsType): boolean {
  if (prefersReducedMotion()) return false;

  const ecModel = (instance as unknown as { getModel(): { getSeriesCount(): number; getSeriesByIndex(i: number): SeriesModelLike } }).getModel();
  const chartsMap = (instance as unknown as { _chartsMap?: Record<string, TreemapViewLike> })._chartsMap;
  let applied = false;

  for (let i = 0; i < ecModel.getSeriesCount(); i++) {
    const seriesModel = ecModel.getSeriesByIndex(i);
    if (seriesModel.subType !== "treemap") continue;
    if (!seriesModel.isAnimationEnabled()) continue;

    const viewId = seriesModel.__viewId;
    if (!viewId) continue;

    const view = chartsMap?.[viewId];
    const targetGroup = view?._containerGroup ?? view?.group;
    if (!targetGroup) continue;

    const rect = targetGroup.getBoundingRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    const clipRect = new graphic.Rect({
      shape: {
        x: rect.x - 10,
        y: rect.y - 10,
        width: 0,
        height: rect.height + 20,
      },
    });

    initProps(
      clipRect,
      { shape: { width: rect.width + 20 } },
      seriesModel,
      () => {
        targetGroup.removeClipPath();
      },
    );

    targetGroup.setClipPath(clipRect);
    applied = true;
  }

  return applied;
}
