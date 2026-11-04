"use client";

import { cn } from "@/lib/utils";
import { LoadingShimmerPattern, useLoadingMaskId } from "@/registry/ui/loading-shimmer";

export type ChartLoadingVariant =
  | "bar"
  | "line"
  | "area"
  | "composed"
  | "pie"
  | "radial"
  | "radar"
  | "scatter"
  | "heatmap"
  | "calendar"
  | "funnel"
  | "waterfall"
  | "sparkline"
  | "sankey"
  | "treemap"
  | "generic";

type ChartLoadingSkeletonProps = {
  variant: ChartLoadingVariant;
  className?: string;
};

function SkeletonFrame({
  children,
  className,
  maskId,
}: {
  children: React.ReactNode;
  className?: string;
  maskId: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex items-stretch justify-center p-6",
        className,
      )}
      aria-hidden
    >
      <svg className="h-full w-full overflow-visible" viewBox="0 0 400 220" preserveAspectRatio="none">
        <defs>
          <LoadingShimmerPattern id={maskId} />
        </defs>
        <g className="text-muted-foreground/30" mask={`url(#${maskId}-shimmer-mask)`}>
          {children}
        </g>
      </svg>
    </div>
  );
}

function BarSkeleton({ maskId }: { maskId: string }) {
  const bars = [0.45, 0.72, 0.55, 0.88, 0.62, 0.78, 0.5, 0.68];
  return (
    <SkeletonFrame maskId={maskId}>
      {bars.map((h, i) => {
        const w = 28;
        const gap = 12;
        const x = 32 + i * (w + gap);
        const barH = h * 140;
        return (
          <rect
            key={i}
            x={x}
            y={180 - barH}
            width={w}
            height={barH}
            rx={6}
            fill="currentColor"
          />
        );
      })}
    </SkeletonFrame>
  );
}

function LineAreaSkeleton({ maskId, filled }: { maskId: string; filled?: boolean }) {
  const path =
    "M 32 160 C 80 120, 100 180, 140 130 S 220 90, 280 140 S 340 170, 368 110";
  return (
    <SkeletonFrame maskId={maskId}>
      {filled ? (
        <>
          <path d={`${path} L 368 180 L 32 180 Z`} fill="currentColor" opacity={0.25} />
          <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} opacity={0.55} />
        </>
      ) : (
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} opacity={0.55} />
      )}
    </SkeletonFrame>
  );
}

function RadialSkeleton({ maskId }: { maskId: string }) {
  const rings = [
    { r: 28, sweep: 1 },
    { r: 44, sweep: 0.75 },
    { r: 60, sweep: 0.6 },
    { r: 76, sweep: 0.45 },
  ];
  return (
    <SkeletonFrame maskId={maskId} className="items-center">
      <g transform="translate(200 110)">
        {rings.map(({ r, sweep }, i) => {
          if (sweep >= 0.99) {
            return (
              <circle
                key={i}
                cx={0}
                cy={0}
                r={r}
                fill="none"
                stroke="currentColor"
                strokeWidth={12}
              />
            );
          }
          const start = -90;
          const end = start + 360 * sweep;
          const large = sweep > 0.5 ? 1 : 0;
          const rad = (deg: number) => (deg * Math.PI) / 180;
          const x1 = r * Math.cos(rad(start));
          const y1 = r * Math.sin(rad(start));
          const x2 = r * Math.cos(rad(end));
          const y2 = r * Math.sin(rad(end));
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={12}
              strokeLinecap="round"
            />
          );
        })}
      </g>
    </SkeletonFrame>
  );
}

function PieSkeleton({ maskId }: { maskId: string }) {
  const slices = [0.35, 0.25, 0.2, 0.12, 0.08];
  let angle = -90;
  return (
    <SkeletonFrame maskId={maskId} className="items-center">
      <g transform="translate(200 110)">
        {slices.map((frac, i) => {
          const sweep = frac * 360;
          const start = angle;
          const end = angle + sweep;
          angle = end;
          const rad = (deg: number) => (deg * Math.PI) / 180;
          const r = 72;
          const ir = 44;
          const x1 = r * Math.cos(rad(start));
          const y1 = r * Math.sin(rad(start));
          const x2 = r * Math.cos(rad(end));
          const y2 = r * Math.sin(rad(end));
          const ix1 = ir * Math.cos(rad(start));
          const iy1 = ir * Math.sin(rad(start));
          const ix2 = ir * Math.cos(rad(end));
          const iy2 = ir * Math.sin(rad(end));
          const large = sweep > 180 ? 1 : 0;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1} Z`}
              fill="currentColor"
              opacity={0.35 + i * 0.08}
            />
          );
        })}
      </g>
    </SkeletonFrame>
  );
}

function RadarSkeleton({ maskId }: { maskId: string }) {
  const pts = 6;
  const r = 70;
  const cx = 200;
  const cy = 110;
  const poly = Array.from({ length: pts }, (_, i) => {
    const a = (-90 + (360 / pts) * i) * (Math.PI / 180);
    const scale = 0.55 + (i % 3) * 0.15;
    return `${cx + r * scale * Math.cos(a)},${cy + r * scale * Math.sin(a)}`;
  }).join(" ");
  return (
    <SkeletonFrame maskId={maskId}>
      <polygon points={poly} fill="currentColor" opacity={0.2} />
      <polygon points={poly} fill="none" stroke="currentColor" strokeWidth={2} opacity={0.5} />
    </SkeletonFrame>
  );
}

function ScatterSkeleton({ maskId }: { maskId: string }) {
  const pts = [
    [60, 150], [90, 120], [120, 160], [150, 90], [180, 130], [210, 70], [240, 110],
    [270, 85], [300, 140], [330, 100], [100, 80], [200, 155], [280, 60], [320, 125],
  ];
  return (
    <SkeletonFrame maskId={maskId}>
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={5} fill="currentColor" opacity={0.45} />
      ))}
    </SkeletonFrame>
  );
}

function CalendarSkeleton({ maskId }: { maskId: string }) {
  const cols = 7;
  const rows = 5;
  const cell = 28;
  const gap = 3;
  return (
    <SkeletonFrame maskId={maskId}>
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => {
          const opacity = 0.12 + ((row * cols + col) % 7) * 0.1;
          return (
            <rect
              key={`${row}-${col}`}
              x={48 + col * (cell + gap)}
              y={36 + row * (cell + gap)}
              width={cell}
              height={cell}
              rx={3}
              fill="currentColor"
              opacity={opacity}
            />
          );
        }),
      )}
    </SkeletonFrame>
  );
}

function HeatmapSkeleton({ maskId }: { maskId: string }) {
  const cols = 8;
  const rows = 5;
  const cell = 32;
  const gap = 4;
  return (
    <SkeletonFrame maskId={maskId}>
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => {
          const opacity = 0.15 + ((row + col) % 5) * 0.12;
          return (
            <rect
              key={`${row}-${col}`}
              x={40 + col * (cell + gap)}
              y={30 + row * (cell + gap)}
              width={cell}
              height={cell}
              rx={4}
              fill="currentColor"
              opacity={opacity}
            />
          );
        }),
      )}
    </SkeletonFrame>
  );
}

function FunnelSkeleton({ maskId }: { maskId: string }) {
  const stages = [
    { y: 40, w: 280 },
    { y: 78, w: 230 },
    { y: 116, w: 180 },
    { y: 154, w: 130 },
  ];
  return (
    <SkeletonFrame maskId={maskId}>
      {stages.map(({ y, w }, i) => (
        <rect
          key={i}
          x={(400 - w) / 2}
          y={y}
          width={w}
          height={32}
          rx={6}
          fill="currentColor"
          opacity={0.25 + i * 0.1}
        />
      ))}
    </SkeletonFrame>
  );
}

function WaterfallSkeleton({ maskId }: { maskId: string }) {
  const bars = [
    { x: 40, y: 80, h: 100 },
    { x: 90, y: 60, h: 40 },
    { x: 140, y: 40, h: 30 },
    { x: 190, y: 70, h: 50 },
    { x: 240, y: 50, h: 80 },
    { x: 290, y: 90, h: 90 },
  ];
  return (
    <SkeletonFrame maskId={maskId}>
      {bars.map(({ x, y, h }, i) => (
        <rect key={i} x={x} y={y} width={36} height={h} rx={4} fill="currentColor" opacity={0.35} />
      ))}
    </SkeletonFrame>
  );
}

function SparklineSkeleton({ maskId }: { maskId: string }) {
  return (
    <SkeletonFrame maskId={maskId} className="p-4">
      <path
        d="M 20 120 C 60 100, 80 140, 120 90 S 200 110, 280 70 S 340 100, 380 85"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        opacity={0.5}
      />
    </SkeletonFrame>
  );
}

function SankeySkeleton({ maskId }: { maskId: string }) {
  return (
    <SkeletonFrame maskId={maskId}>
      <rect x={40} y={50} width={24} height={120} rx={4} fill="currentColor" opacity={0.3} />
      <rect x={180} y={70} width={24} height={80} rx={4} fill="currentColor" opacity={0.35} />
      <rect x={320} y={40} width={24} height={140} rx={4} fill="currentColor" opacity={0.3} />
      <path d="M 64 80 C 120 80, 120 100, 180 100" stroke="currentColor" strokeWidth={8} opacity={0.2} fill="none" />
      <path d="M 64 130 C 120 130, 120 120, 180 120" stroke="currentColor" strokeWidth={12} opacity={0.25} fill="none" />
      <path d="M 204 110 C 260 110, 260 90, 320 90" stroke="currentColor" strokeWidth={10} opacity={0.2} fill="none" />
    </SkeletonFrame>
  );
}

function TreemapSkeleton({ maskId }: { maskId: string }) {
  return (
    <SkeletonFrame maskId={maskId}>
      <rect x={32} y={32} width={160} height={120} rx={4} fill="currentColor" opacity={0.28} />
      <rect x={200} y={32} width={168} height={56} rx={4} fill="currentColor" opacity={0.22} />
      <rect x={200} y={96} width={80} height={56} rx={4} fill="currentColor" opacity={0.32} />
      <rect x={288} y={96} width={80} height={56} rx={4} fill="currentColor" opacity={0.18} />
      <rect x={32} y={160} width={336} height={28} rx={4} fill="currentColor" opacity={0.2} />
    </SkeletonFrame>
  );
}

function GenericSkeleton({ maskId }: { maskId: string }) {
  return (
    <SkeletonFrame maskId={maskId}>
      <rect x={32} y={48} width={336} height={124} rx={8} fill="currentColor" opacity={0.2} />
    </SkeletonFrame>
  );
}

export function ChartLoadingSkeleton({ variant, className }: ChartLoadingSkeletonProps) {
  const maskId = useLoadingMaskId(variant);

  const skeleton = (() => {
    switch (variant) {
      case "bar":
      case "composed":
        return <BarSkeleton maskId={maskId} />;
      case "line":
        return <LineAreaSkeleton maskId={maskId} />;
      case "area":
        return <LineAreaSkeleton maskId={maskId} filled />;
      case "radial":
        return <RadialSkeleton maskId={maskId} />;
      case "pie":
        return <PieSkeleton maskId={maskId} />;
      case "radar":
        return <RadarSkeleton maskId={maskId} />;
      case "scatter":
        return <ScatterSkeleton maskId={maskId} />;
      case "heatmap":
        return <HeatmapSkeleton maskId={maskId} />;
      case "calendar":
        return <CalendarSkeleton maskId={maskId} />;
      case "funnel":
        return <FunnelSkeleton maskId={maskId} />;
      case "waterfall":
        return <WaterfallSkeleton maskId={maskId} />;
      case "sparkline":
        return <SparklineSkeleton maskId={maskId} />;
      case "sankey":
        return <SankeySkeleton maskId={maskId} />;
      case "treemap":
        return <TreemapSkeleton maskId={maskId} />;
      default:
        return <GenericSkeleton maskId={maskId} />;
    }
  })();

  return <div className={className}>{skeleton}</div>;
}
