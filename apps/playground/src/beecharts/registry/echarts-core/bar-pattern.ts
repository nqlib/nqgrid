import { withAlpha } from "./color-alpha";
import { barSeriesColor } from "./bar-item-style";

type PatternFill = {
  image: HTMLCanvasElement;
  repeat: "repeat";
};

const patternCache = new Map<string, PatternFill>();

function drawHatchedTile(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
  ctx.lineWidth = 2;
  ctx.lineCap = "square";

  const step = 7;
  for (let offset = -size; offset < size * 2; offset += step) {
    ctx.beginPath();
    ctx.moveTo(offset, size);
    ctx.lineTo(offset + size, 0);
    ctx.stroke();
  }
}

function createHatchedPattern(color: string): PatternFill {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { image: canvas, repeat: "repeat" };
  drawHatchedTile(ctx, size, color);
  return { image: canvas, repeat: "repeat" };
}

/** Muted body + solid cap — matches beecharts `stripped` (not zebra stripes). */
function strippedBarGradient(strokeColor: string, fillColor: string, horizontal: boolean) {
  if (horizontal) {
    return {
      type: "linear" as const,
      x: 0,
      y: 0,
      x2: 1,
      y2: 0,
      colorStops: [
        { offset: 0, color: withAlpha(fillColor, 0.22) },
        { offset: 0.96, color: withAlpha(fillColor, 0.22) },
        { offset: 0.96, color: strokeColor },
        { offset: 1, color: strokeColor },
      ],
    };
  }

  return {
    type: "linear" as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: strokeColor },
      { offset: 0.04, color: strokeColor },
      { offset: 0.04, color: withAlpha(fillColor, 0.22) },
      { offset: 1, color: withAlpha(fillColor, 0.22) },
    ],
  };
}

export function barVariantFill(
  variant: string | undefined,
  strokeColor: string,
  horizontal = false,
  fillColor = strokeColor,
): string | ReturnType<typeof barSeriesColor> | PatternFill {
  if (variant === "hatched") {
    if (typeof document === "undefined") return fillColor;
    const key = `hatched:${fillColor}`;
    const cached = patternCache.get(key);
    if (cached) return cached;
    const pattern = createHatchedPattern(fillColor);
    patternCache.set(key, pattern);
    return pattern;
  }

  if (variant === "stripped") {
    return strippedBarGradient(strokeColor, fillColor, horizontal);
  }

  return barSeriesColor(variant, strokeColor, fillColor);
}
