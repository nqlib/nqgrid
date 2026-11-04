/** Append alpha to hex, rgb, hsl, oklch, and other CSS color strings. */
export function withAlpha(color: string, alpha: number): string {
  const value = color.trim();
  if (!value) return value;

  if (value.startsWith("#") && value.length === 7) {
    const r = Number.parseInt(value.slice(1, 3), 16);
    const g = Number.parseInt(value.slice(3, 5), 16);
    const b = Number.parseInt(value.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  if (value.startsWith("rgba(") || value.startsWith("hsla(")) {
    return value;
  }

  if (value.startsWith("rgb(")) {
    return value.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }

  if (value.startsWith("hsl(")) {
    if (value.includes("/")) return value;
    return value.replace(/\)$/, ` / ${alpha})`);
  }

  // oklch(), oklab(), lab(), lch(), color() — modern alpha syntax
  if (/^(oklch|oklab|lab|lch|color)\(/i.test(value)) {
    if (value.includes("/")) return value;
    return value.replace(/\)$/, ` / ${alpha})`);
  }

  return value;
}

/** Soft top-to-bottom fill for area series (matches beecharts vertical fade). */
export function areaVerticalFill(color: string) {
  return {
    type: "linear" as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: withAlpha(color, 0.28) },
      { offset: 0.55, color: withAlpha(color, 0.1) },
      { offset: 1, color: withAlpha(color, 0) },
    ],
  };
}

/** Matches beecharts `DEFAULT_FILL_OPACITY` on filled radars. */
export const RADAR_FILL_OPACITY = 0.3;

type RadarGradientColor = {
  type: "radial";
  x: number;
  y: number;
  r: number;
  global: false;
  colorStops: { offset: number; color: string }[];
};

function isDarkTheme(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function radarFillAlphas(): { center: number; edge: number; opacity: number } {
  if (isDarkTheme()) {
    return { center: 0.8, edge: 0.3, opacity: RADAR_FILL_OPACITY };
  }
  // Light mode chart tokens use darker hex — soften center so overlap does not muddy the plot.
  return { center: 0.5, edge: 0.22, opacity: 0.32 };
}

function radarGradientColorStops(
  resolveColor: (index: number) => string,
  colorsCount: number,
): RadarGradientColor {
  const { center: centerAlpha, edge: edgeAlpha } = radarFillAlphas();

  if (colorsCount <= 1) {
    const color = resolveColor(0);
    return {
      type: "radial",
      x: 0.5,
      y: 0.5,
      r: 0.5,
      global: false,
      colorStops: [
        { offset: 0, color: withAlpha(color, centerAlpha) },
        { offset: 1, color: withAlpha(color, edgeAlpha) },
      ],
    };
  }

  return {
    type: "radial",
    x: 0.5,
    y: 0.5,
    r: 0.5,
    global: false,
    colorStops: Array.from({ length: colorsCount }, (_, i) => ({
      offset: i / (colorsCount - 1),
      color: withAlpha(resolveColor(i), i === 0 ? centerAlpha : edgeAlpha),
    })),
  };
}

/** Radial fill for radar polygons — per-shape bbox (beecharts FillGradient). */
export function radarRadialFill(color: string): RadarGradientColor {
  return radarGradientColorStops(() => color, 1);
}

export function radarAreaFill(
  resolveFillColor: (key: string, index: number) => string,
  dataKey: string,
  colorsCount: number,
): { color: RadarGradientColor; opacity: number } {
  const { opacity } = radarFillAlphas();
  return {
    color: radarGradientColorStops((index) => resolveFillColor(dataKey, index), colorsCount),
    opacity,
  };
}

const SPARKLINE_DOMAIN_PADDING = 0.12;

/** Tight Y domain so sparklines use full strip height (not zero-based). */
export function computeSparklineDomain(
  values: number[],
): [number, number] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return [0, 1];

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min;
  const pad =
    span > 0
      ? span * SPARKLINE_DOMAIN_PADDING
      : Math.max(Math.abs(max) * SPARKLINE_DOMAIN_PADDING, 1);

  return [min - pad, max + pad];
}
