import { withAlpha } from "./color-alpha";

export function barSeriesColor(
  variant: string | undefined,
  strokeColor: string,
  fillColor = strokeColor,
) {
  switch (variant) {
    case "gradient":
      return {
        type: "linear" as const,
        x: 0,
        y: 1,
        x2: 0,
        y2: 0,
        colorStops: [
          { offset: 0, color: withAlpha(fillColor, 0.35) },
          { offset: 1, color: strokeColor },
        ],
      };
    case "duotone":
      return {
        type: "linear" as const,
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: strokeColor },
          { offset: 1, color: withAlpha(fillColor, 0.45) },
        ],
      };
    case "duotone-reverse":
      return {
        type: "linear" as const,
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: withAlpha(fillColor, 0.45) },
          { offset: 1, color: strokeColor },
        ],
      };
    default:
      return strokeColor;
  }
}
