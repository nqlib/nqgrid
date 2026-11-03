import { pivotHeatStep } from "../pivot/layout";
import { PIVOT_HEAT_BASE_COLOR, PIVOT_HEAT_MIX_PERCENT, PIVOT_SERIES_COLORS } from "../styles";

export type PivotStaticTheme = "light" | "dark";

/**
 * Solid colors of the static (HTML/PDF) stylesheet. Light prints on white paper; both themes use
 * the nqui surface/text hues of the interactive grid, flattened to hex so no `color-mix` or
 * `oklch` support is required (XLSX fills reuse the same values).
 */
export const PIVOT_STATIC_PALETTE = {
  light: {
    page: "#ffffff",
    surface: "#ffffff",
    muted: "#efeee9",
    foreground: "#281d15",
    mutedForeground: "#7e7167",
    border: "#dcdbd7",
    rule: "#eae9e7",
    hairline: "#f1f1ef",
    secondary: "#e9e7e1",
    secondaryForeground: "#3c2c20",
    positive: "#059669",
    negative: "#dc2626",
  },
  dark: {
    page: "#171717",
    surface: "#171717",
    muted: "#201f1f",
    foreground: "#e4e4e4",
    mutedForeground: "#a1a1a1",
    border: "#3a3738",
    rule: "#2c2a2b",
    hairline: "#252424",
    secondary: "#292727",
    secondaryForeground: "#e4e4e4",
    positive: "#34d399",
    negative: "#f87171",
  },
} as const satisfies Record<PivotStaticTheme, Record<string, string>>;

const parseHex = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};

/** `top` composited over `bottom` at `alpha` (0–1) in sRGB — what the browser does for a translucent fill. */
export function mixHexColors(top: string, bottom: string, alpha: number): string {
  const a = parseHex(top);
  const b = parseHex(bottom);
  const t = Math.min(1, Math.max(0, alpha));
  return `#${a.map((v, i) => Math.round(v * t + b[i]! * (1 - t)).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Solid heat fill for palette step `0 … 8` on a theme surface. Matches the interactive default
 * (`color-mix(in oklab, <heat color> N%, transparent)` painted over the cell surface).
 */
export function pivotHeatFillHex(step: number, theme: PivotStaticTheme = "light", baseColor: string = PIVOT_HEAT_BASE_COLOR): string {
  const i = Math.max(0, Math.min(PIVOT_HEAT_MIX_PERCENT.length - 1, Math.round(step)));
  return mixHexColors(baseColor, PIVOT_STATIC_PALETTE[theme].surface, PIVOT_HEAT_MIX_PERCENT[i]! / 100);
}

/** Solid fill for a model heat level (`cell.heat`, `0 … levels-1`), e.g. for XLSX cell fills. */
export function pivotHeatLevelFillHex(level: number, levels: number, theme: PivotStaticTheme = "light"): string {
  return pivotHeatFillHex(pivotHeatStep(level, levels), theme);
}

/** Header-chart series color for slot `index` in a theme (same order as `pivotThemeVars`). */
export function pivotSeriesHex(index: number, theme: PivotStaticTheme = "light"): string {
  const palette = PIVOT_SERIES_COLORS[theme];
  return palette[((index % palette.length) + palette.length) % palette.length]!;
}
