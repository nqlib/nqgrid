import { PIVOT_HEAT_MIX_PERCENT, pivotThemeVars } from "../styles";
import { PIVOT_STATIC_PALETTE, pivotHeatFillHex, type PivotStaticTheme } from "./color";

/** System font stack: no web fonts are loaded (Inter is used when installed). */
export const PIVOT_STATIC_FONT_STACK =
  'Inter, "Inter Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** `--nqg-*` custom properties for one theme: surfaces, text, rules, series and heat steps. */
export function pivotStaticThemeVars(theme: PivotStaticTheme): Record<`--nqg-${string}`, string> {
  const p = PIVOT_STATIC_PALETTE[theme];
  const vars: Record<`--nqg-${string}`, string> = {
    "--nqg-page": p.page,
    "--nqg-surface": p.surface,
    "--nqg-muted": p.muted,
    "--nqg-fg": p.foreground,
    "--nqg-muted-fg": p.mutedForeground,
    "--nqg-border": p.border,
    "--nqg-rule": p.rule,
    "--nqg-hairline": p.hairline,
    "--nqg-secondary": p.secondary,
    "--nqg-secondary-fg": p.secondaryForeground,
    "--nqg-positive": p.positive,
    "--nqg-negative": p.negative,
    ...pivotThemeVars(theme),
  };
  PIVOT_HEAT_MIX_PERCENT.forEach((_, i) => {
    vars[`--nqg-heat-${i}`] = pivotHeatFillHex(i, theme);
  });
  return vars;
}

const declarations = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

/**
 * Self-contained stylesheet for `renderPivotHtml` output. Hand-authored against the semantic
 * `nqg-pivot-*` classes (same type scale and spacing as the Tailwind tokens), so static HTML needs
 * no Tailwind build. Light by default; dark under `:root[data-theme="dark"]` or `.dark`.
 */
export const PIVOT_STATIC_CSS = `:root {
  color-scheme: light;
  --nqg-font: ${PIVOT_STATIC_FONT_STACK};
${declarations(pivotStaticThemeVars("light"))}
}
:root[data-theme="dark"], .dark {
  color-scheme: dark;
${declarations(pivotStaticThemeVars("dark"))}
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: var(--nqg-page); }
body {
  margin: 0;
  background: var(--nqg-page);
  color: var(--nqg-fg);
  font-family: var(--nqg-font);
  font-size: 14px;
  line-height: 20px;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
@media screen { body { padding: 24px; } }

/* Report chrome */
.nqg-report-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin: 0 0 12px;
  padding: 0 0 10px;
  border-bottom: 1px solid var(--nqg-border);
}
.nqg-report-title { margin: 0; font-size: 18px; line-height: 24px; font-weight: 600; letter-spacing: -0.01em; }
.nqg-report-subtitle { margin: 2px 0 0; font-size: 12px; line-height: 16px; color: var(--nqg-muted-fg); }
.nqg-report-meta { font-size: 11px; line-height: 16px; color: var(--nqg-muted-fg); text-align: right; white-space: nowrap; }
.nqg-report-chunk { width: fit-content; min-width: 50%; }
.nqg-report-chunk + .nqg-report-chunk { break-before: page; }
.nqg-report-chunk-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin: 0 0 6px;
  font-size: 11px;
  line-height: 16px;
  color: var(--nqg-muted-fg);
}
.nqg-report-chunk-title { font-size: 13px; font-weight: 600; color: var(--nqg-fg); }
.nqg-report-scale { width: max-content; }

/* Table */
.nqg-pivot {
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  background: var(--nqg-surface);
  color: var(--nqg-fg);
  font-size: 14px;
  line-height: 20px;
}
:where(.nqg-pivot) :where(th, td) { padding: 0 12px; vertical-align: middle; text-align: left; font-weight: inherit; }
.nqg-pivot thead { display: table-header-group; break-inside: avoid; }
/* No table-level border: a table fragment cut by a page break stretches to the page end. */
.nqg-pivot thead > tr:first-child > th { border-top: 1px solid var(--nqg-border); }
.nqg-pivot tbody:last-child > tr:last-child > * { border-bottom: 1px solid var(--nqg-border); }
.nqg-pivot tbody { break-inside: avoid; }
.nqg-pivot tr { break-inside: avoid; }
.nqg-pivot svg { display: block; overflow: visible; }

.nqg-pivot-head {
  white-space: nowrap;
  border-bottom: 1px solid var(--nqg-border);
  background: var(--nqg-surface);
  padding: 0 12px;
  vertical-align: middle;
  text-align: left;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--nqg-muted-fg);
}
.nqg-pivot-head-value { text-align: right; }
.nqg-pivot-band { border-bottom: 1px solid var(--nqg-rule); background: var(--nqg-surface); padding: 8px 0 0; vertical-align: bottom; }
.nqg-pivot-band-summary {
  border-bottom: 1px solid var(--nqg-rule);
  background: var(--nqg-surface);
  padding: 8px 12px;
  vertical-align: top;
  text-align: left;
  font-weight: 400;
}
.nqg-pivot-band-value {
  display: block;
  text-align: center;
  font-size: 10px;
  line-height: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--nqg-muted-fg);
}
.nqg-pivot-summary-label {
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--nqg-muted-fg);
}
.nqg-pivot-summary-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 18px;
  line-height: 24px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--nqg-fg);
}
.nqg-pivot-summary-note { font-size: 11px; font-weight: 400; color: var(--nqg-muted-fg); }
.nqg-pivot-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 12px;
  margin-top: 4px;
  font-size: 11px;
  line-height: 16px;
  color: var(--nqg-muted-fg);
}
.nqg-pivot-legend-swatch { display: inline-block; width: 8px; height: 8px; margin-right: 4px; border-radius: 2px; vertical-align: middle; }

.nqg-pivot-cell { border-bottom: 1px solid var(--nqg-hairline); padding: 0 12px; vertical-align: middle; }
.nqg-pivot-leaf { background: var(--nqg-surface); }
.nqg-pivot-group { background: var(--nqg-muted); font-weight: 500; }
.nqg-pivot-span {
  border-bottom: 1px solid var(--nqg-rule);
  border-right: 1px solid var(--nqg-rule);
  background: var(--nqg-surface);
  padding: 8px 12px;
  vertical-align: top;
}
.nqg-pivot-total {
  border-top: 1px solid var(--nqg-border);
  background: var(--nqg-muted);
  padding: 0 12px;
  vertical-align: middle;
  font-weight: 600;
}
.nqg-pivot-total-label { text-align: left; }
.nqg-pivot-value { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.nqg-pivot-group-value { color: var(--nqg-muted-fg); }
.nqg-pivot-heat { color: var(--nqg-fg); }
.nqg-pivot-edge { border-right: 1px solid var(--nqg-rule); }
.nqg-pivot-row-header { text-align: left; font-weight: 400; }
.nqg-pivot-group-label { display: flex; min-width: 0; align-items: center; gap: 6px; }
.nqg-pivot-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nqg-pivot-count {
  display: inline-flex;
  height: 16px;
  min-width: 16px;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 1px solid var(--nqg-border);
  border-radius: 9999px;
  background: var(--nqg-page);
  font-size: 10px;
  line-height: 1;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--nqg-muted-fg);
}

/* KPI side panel */
.nqg-pivot-kpi { display: flex; flex-direction: column; gap: 8px; }
.nqg-pivot-kpi-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  color: var(--nqg-fg);
}
.nqg-pivot-kpi-headline-label {
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--nqg-muted-fg);
}
.nqg-pivot-kpi-headline { font-size: 20px; line-height: 28px; font-weight: 600; font-variant-numeric: tabular-nums; }
.nqg-pivot-kpi-list { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 0; font-size: 12px; line-height: 16px; }
.nqg-pivot-kpi-term { color: var(--nqg-muted-fg); }
.nqg-pivot-kpi-value { margin: 0; text-align: right; font-weight: 500; font-variant-numeric: tabular-nums; color: var(--nqg-fg); }
.nqg-pivot-kpi-caption {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--nqg-rule);
  font-size: 12px;
  line-height: 16px;
  color: var(--nqg-muted-fg);
}
.nqg-pivot-kpi-avatar {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: var(--nqg-secondary);
  font-size: 9px;
  font-weight: 600;
  color: var(--nqg-secondary-fg);
}
.nqg-pivot-delta { font-size: 12px; line-height: 16px; font-weight: 500; font-variant-numeric: tabular-nums; }
.nqg-pivot-up { color: var(--nqg-positive); }
.nqg-pivot-down { color: var(--nqg-negative); }
.nqg-pivot-flat { color: var(--nqg-muted-fg); }
`;
