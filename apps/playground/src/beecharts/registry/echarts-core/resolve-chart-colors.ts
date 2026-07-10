import type { ChartConfig } from "@/registry/ui/chart";

const THEMES = { light: "", dark: ".dark" } as const;
const CSS_VAR_REF = /^var\(\s*--([a-zA-Z0-9_-]+)\s*\)$/;

function getThemePrefix(): string {
  if (typeof document === "undefined") return "";
  return document.documentElement.classList.contains("dark") ? THEMES.dark : THEMES.light;
}

function readCustomProperty(el: Element, name: string): string {
  return getComputedStyle(el).getPropertyValue(`--${name}`).trim();
}

/**
 * Resolve `var(--token)` chains to concrete colors. ECharts and canvas cannot
 * interpret CSS variables — only resolved oklch/hex/rgb strings work.
 */
export function resolveCssColorValue(value: string, contextEl?: Element | null): string {
  const trimmed = value.trim();
  if (!trimmed || typeof document === "undefined") return trimmed;

  const varMatch = CSS_VAR_REF.exec(trimmed);
  if (!varMatch) return trimmed;

  const prop = varMatch[1];
  if (!prop) return trimmed;
  const candidates = [contextEl, document.documentElement].filter(
    (el): el is Element => el != null,
  );

  for (const el of candidates) {
    const resolved = readCustomProperty(el, prop);
    if (resolved) return resolveCssColorValue(resolved, contextEl);
  }

  return trimmed;
}

function finalizeColor(color: string, contextEl?: Element | null): string {
  const resolved = resolveCssColorValue(color, contextEl);
  return resolved.startsWith("var(") ? color : resolved;
}

/** Read resolved hex/rgb from CSS variables on the chart container. */
export function createColorResolver(chartId: string, config: ChartConfig) {
  const cache = new Map<string, string>();

  return function resolveColor(key: string, index = 0): string {
    const cacheKey = `${key}:${index}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;

    let color: string;
    let contextEl: Element | null = null;

    if (typeof document === "undefined") {
      const entry = config[key];
      const colors = entry?.colors?.light ?? entry?.colors?.dark;
      color = colors?.[index] ?? colors?.[0] ?? "#8884d8";
    } else {
      const selector = `${getThemePrefix()} [data-chart="${chartId}"]`.trim();
      contextEl =
        document.querySelector(selector) ?? document.querySelector(`[data-chart="${chartId}"]`);
      if (!contextEl) {
        const entry = config[key];
        const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
        const colors = entry?.colors?.[theme];
        color = colors?.[index] ?? colors?.[0] ?? "#8884d8";
      } else {
        const value = getComputedStyle(contextEl).getPropertyValue(`--color-${key}-${index}`).trim();
        if (value) {
          color = value;
        } else {
          const entry = config[key];
          const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
          const colors = entry?.colors?.[theme];
          color = colors?.[index] ?? colors?.[0] ?? "#8884d8";
        }
      }
    }

    color = finalizeColor(color, contextEl);

    if (!color.startsWith("var(")) {
      cache.set(cacheKey, color);
    }

    return color;
  };
}

/**
 * Wash/fade fills (area, bar gradients, radar polygons, sparklines) in light mode use the
 * brighter `dark` palette slot so opacity fades read airy on white backgrounds.
 * Strokes and solid caps keep `resolveColor` (darker light-slot tokens).
 */
export function resolveAreaFillColor(
  config: ChartConfig,
  key: string,
  resolveColor: (key: string, index: number) => string,
  index = 0,
): string {
  const isDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  if (isDark) return resolveColor(key, index);

  const entry = config[key];
  const bright = entry?.colors?.dark?.[index] ?? entry?.colors?.dark?.[0];
  if (!bright) return resolveColor(key, index);

  const resolved = resolveCssColorValue(bright, document.documentElement);
  return resolved.startsWith("var(") ? resolveColor(key, index) : resolved;
}

/** Subscribe to `.dark` class toggles on `<html>`. */
export function subscribeThemeChange(onChange: () => void): () => void {
  if (typeof document === "undefined") return () => {};

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.attributeName === "class") {
        onChange();
        break;
      }
    }
  });

  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
