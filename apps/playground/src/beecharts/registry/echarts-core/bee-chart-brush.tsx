"use client";

import { cn } from "@/lib/utils";
import type { EChartsOption } from "echarts";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { extractCategoryBoundaryGap, extractGridInsets, indexToPlotPercent, type ChartPlotInsets } from "./chart-grid";
import { EChartsHost } from "./echarts-host";
import { toMiniPreviewOption } from "./to-mini-preview-option";
import type { ChartBrushRange } from "./use-chart-brush";
import { useCompiledOption, type CompileRootFields } from "./use-compiled-option";
import type { CompileContext } from "./parts/types";

const SPRING = { stiffness: 300, damping: 35, mass: 0.8 };

type DragType = "left" | "right" | "middle";

type DragState = {
  type: DragType;
  originX: number;
  originRange: ChartBrushRange;
};

function useBrushDrag({
  range,
  totalPoints,
  plotRef,
  commit,
}: {
  range: ChartBrushRange;
  totalPoints: number;
  plotRef: React.RefObject<HTMLDivElement | null>;
  commit: (next: ChartBrushRange, mode?: DragType) => void;
}) {
  const dragRef = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const toIndexDelta = useCallback(
    (px: number) => {
      if (!plotRef.current || totalPoints <= 1) return 0;
      return Math.round(
        (px / plotRef.current.getBoundingClientRect().width) * (totalPoints - 1),
      );
    },
    [totalPoints, plotRef],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, type: DragType) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { type, originX: e.clientX, originRange: { ...range } };
      setIsDragging(true);
    },
    [range],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;

      const delta = toIndexDelta(e.clientX - d.originX);
      const { type, originRange: o } = d;

      if (type === "left") {
        commit({ startIndex: o.startIndex + delta, endIndex: o.endIndex }, "left");
      } else if (type === "right") {
        commit({ startIndex: o.startIndex, endIndex: o.endIndex + delta }, "right");
      } else {
        const span = o.endIndex - o.startIndex;
        let s = o.startIndex + delta;
        let e2 = s + span;
        if (s < 0) {
          s = 0;
          e2 = span;
        }
        if (e2 > totalPoints - 1) {
          e2 = totalPoints - 1;
          s = Math.max(0, e2 - span);
        }
        commit({ startIndex: s, endIndex: e2 }, "middle");
      }
    },
    [toIndexDelta, totalPoints, commit],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  const bind = useCallback(
    (type: DragType) => ({
      onPointerDown: (e: React.PointerEvent) => onPointerDown(e, type),
      onPointerMove,
      onPointerUp,
    }),
    [onPointerDown, onPointerMove, onPointerUp],
  );

  return { isDragging, bind };
}

function BrushHandle({
  side,
  position,
  label,
  bind,
  showLabel,
}: {
  side: "left" | "right";
  position: MotionValue<string>;
  label?: string;
  showLabel: boolean;
  bind: (type: DragType) => {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
  };
}) {
  const isLeft = side === "left";

  return (
    <motion.div className="group/handle absolute inset-y-0 z-20" style={{ left: position }}>
      <div
        className={cn(
          "absolute inset-y-0 flex w-4 cursor-ew-resize touch-none items-center justify-center",
          "after:absolute after:inset-y-0 after:w-10 after:content-['']",
          isLeft ? "after:-left-3" : "-translate-x-full after:-right-3",
        )}
        {...bind(side)}
      >
        <div
          className={cn(
            "border-border bg-background group-hover/handle:border-muted-foreground group-hover/handle:bg-muted group-active/handle:border-foreground group-active/handle:bg-muted relative flex h-6 w-2.5 items-center justify-center rounded-md border-2 shadow-md transition-colors",
            isLeft ? "-left-[7px]" : "-right-[7px]",
          )}
        >
          <div className="flex flex-col gap-[3px]">
            <div className="bg-muted-foreground group-hover/handle:bg-foreground h-[2px] w-[3px] rounded-full" />
            <div className="bg-muted-foreground group-hover/handle:bg-foreground h-[2px] w-[3px] rounded-full" />
            <div className="bg-muted-foreground group-hover/handle:bg-foreground h-[2px] w-[3px] rounded-full" />
          </div>
        </div>
      </div>
      {label ? (
        <div
          className={cn(
            "brush-label bg-foreground text-background pointer-events-none absolute top-0 z-30 -translate-y-[calc(100%+6px)] rounded px-1.5 py-0.5 text-[10px] leading-tight font-medium whitespace-nowrap shadow-sm transition-opacity",
            isLeft ? "left-0" : "right-0 -translate-x-full",
            showLabel ? "opacity-100" : "opacity-0 group-hover/handle:opacity-100",
          )}
        >
          {label}
        </div>
      ) : null}
    </motion.div>
  );
}

export type BeeChartBrushProps<TData extends Record<string, unknown>> = {
  data: TData[];
  compile: (ctx: CompileContext<TData>) => EChartsOption;
  rootFields?: Omit<CompileRootFields<TData>, "data">;
  startIndex: number;
  endIndex: number;
  onChange: (range: ChartBrushRange) => void;
  xDataKey?: string;
  formatLabel?: (value: unknown, index: number) => string;
  height?: number;
  className?: string;
  minSpan?: number;
  showLabels?: boolean;
  /** Measured plot insets from the main chart — aligns the brush track with the chart grid. */
  plotAlign?: ChartPlotInsets | null;
};

export function BeeChartBrush<TData extends Record<string, unknown>>({
  data,
  compile,
  rootFields = {},
  startIndex,
  endIndex,
  onChange,
  xDataKey,
  formatLabel,
  height = 52,
  className,
  minSpan = 2,
  showLabels = true,
  plotAlign = null,
}: BeeChartBrushProps<TData>) {
  const plotRef = useRef<HTMLDivElement>(null);
  const totalPoints = data.length;
  const { option, colorEpoch } = useCompiledOption(compile, { data, ...rootFields });
  const gridInsets = useMemo(() => extractGridInsets(option), [option]);
  const boundaryGap = useMemo(() => extractCategoryBoundaryGap(option), [option]);
  const miniOption = useMemo(() => toMiniPreviewOption(option, { edgeToEdge: true }), [option]);
  const sideInsets = plotAlign ?? { left: gridInsets.left, right: gridInsets.right };

  const [internalRange, setInternalRange] = useState<ChartBrushRange>({
    startIndex,
    endIndex,
  });
  const lastCommittedRef = useRef(internalRange);

  // Sync internal range when the controlled start/end props change, using
  // React's documented "adjust state on prop change" pattern (prev-value ref
  // compared during render) — preferred over a setState-in-effect. The lint
  // rule doesn't recognize this idiom, so the prev-value ref access is disabled.
  /* eslint-disable react-hooks/refs */
  const prevRangePropsRef = useRef({ startIndex, endIndex });
  if (
    prevRangePropsRef.current.startIndex !== startIndex ||
    prevRangePropsRef.current.endIndex !== endIndex
  ) {
    const synced = { startIndex, endIndex };
    prevRangePropsRef.current = synced;
    setInternalRange(synced);
    lastCommittedRef.current = synced;
  }
  /* eslint-enable react-hooks/refs */

  const clampRange = useCallback(
    (range: ChartBrushRange, mode?: DragType): ChartBrushRange => {
      let { startIndex: s, endIndex: e } = range;
      const maxIndex = Math.max(0, totalPoints - 1);
      s = Math.max(0, Math.min(s, maxIndex));
      e = Math.max(0, Math.min(e, maxIndex));

      if (mode === "left") {
        s = Math.min(s, Math.max(0, e - minSpan));
        return { startIndex: s, endIndex: e };
      }
      if (mode === "right") {
        e = Math.max(e, Math.min(maxIndex, s + minSpan));
        return { startIndex: s, endIndex: e };
      }
      if (e - s < minSpan) {
        e = Math.min(maxIndex, s + minSpan);
        if (e - s < minSpan) s = Math.max(0, e - minSpan);
      }
      return { startIndex: s, endIndex: e };
    },
    [minSpan, totalPoints],
  );

  const commit = useCallback(
    (next: ChartBrushRange, mode?: DragType) => {
      const clamped = clampRange(next, mode);
      const last = lastCommittedRef.current;
      if (last.startIndex === clamped.startIndex && last.endIndex === clamped.endIndex) return;
      lastCommittedRef.current = clamped;
      setInternalRange(clamped);
      onChange(clamped);
    },
    [clampRange, onChange],
  );

  const { isDragging, bind } = useBrushDrag({
    range: internalRange,
    totalPoints,
    plotRef,
    commit,
  });

  const leftPct = indexToPlotPercent(internalRange.startIndex, totalPoints, boundaryGap);
  const rightPct = indexToPlotPercent(internalRange.endIndex, totalPoints, boundaryGap);

  const leftTarget = useMotionValue(leftPct);
  const rightTarget = useMotionValue(rightPct);
  if (leftTarget.get() !== leftPct) leftTarget.set(leftPct);
  if (rightTarget.get() !== rightPct) rightTarget.set(rightPct);

  const leftSpring = useSpring(leftTarget, SPRING);
  const rightSpring = useSpring(rightTarget, SPRING);
  const leftPosition = useTransform(leftSpring, (v) => `${v}%`);
  const rightPosition = useTransform(rightSpring, (v) => `${v}%`);
  const leftOverlayWidth = useTransform(leftSpring, (v) => `${v}%`);
  const rightOverlayWidth = useTransform(rightSpring, (v) => `${Math.max(0, 100 - v)}%`);
  const selectedWidth = useMotionValue(`${Math.max(0, rightPct - leftPct)}%`);

  const updateSelectedWidth = useCallback(() => {
    selectedWidth.set(`${Math.max(0, rightSpring.get() - leftSpring.get())}%`);
  }, [leftSpring, rightSpring, selectedWidth]);

  useMotionValueEvent(leftSpring, "change", updateSelectedWidth);
  useMotionValueEvent(rightSpring, "change", updateSelectedWidth);

  const getLabel = useCallback(
    (idx: number) => {
      if (!xDataKey) return String(idx);
      const v = data[idx]?.[xDataKey];
      return formatLabel ? formatLabel(v, idx) : String(v ?? idx);
    },
    [data, formatLabel, xDataKey],
  );

  if (totalPoints === 0) return null;

  return (
    <div
      className={cn("relative mt-1 overflow-visible pt-6", className)}
      style={{ height: height + 24 }}
    >
      <div
        className="absolute overflow-hidden rounded-md border border-border/60 bg-muted/20"
        style={{ top: 24, height, left: sideInsets.left, right: sideInsets.right }}
      >
        <EChartsHost option={miniOption} colorEpoch={colorEpoch} className="h-full w-full" />

        <div ref={plotRef} className="absolute inset-0 z-10">
          <motion.div
          className="bg-background/75 pointer-events-none absolute inset-y-0 left-0 backdrop-blur-[1px]"
          style={{ width: leftOverlayWidth }}
        />
        <motion.div
          className="bg-background/75 pointer-events-none absolute inset-y-0 right-0 backdrop-blur-[1px]"
          style={{ width: rightOverlayWidth }}
        />

        <motion.div
          className="border-border absolute inset-y-0 cursor-grab touch-none rounded-sm border bg-foreground/5 active:cursor-grabbing"
          style={{ left: leftPosition, width: selectedWidth }}
          {...bind("middle")}
        />

        <BrushHandle
          side="left"
          position={leftPosition}
          label={showLabels ? getLabel(internalRange.startIndex) : undefined}
          showLabel={isDragging}
          bind={bind}
        />
        <BrushHandle
          side="right"
          position={rightPosition}
          label={showLabels ? getLabel(internalRange.endIndex) : undefined}
          showLabel={isDragging}
          bind={bind}
        />
        </div>
      </div>
    </div>
  );
}
