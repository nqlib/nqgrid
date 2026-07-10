import type { PartialTableColorTokens, TableColorTokens, TableTokenPreset } from "./schema";

function deepMergeTokens(
  base: TableColorTokens,
  overrides: PartialTableColorTokens,
): TableColorTokens {
  return {
    shell: { ...base.shell, ...overrides.shell },
    scroll: { ...base.scroll, ...overrides.scroll },
    header: { ...base.header, ...overrides.header },
    body: { ...base.body, ...overrides.body },
    pinned: { ...base.pinned, ...overrides.pinned },
    cell: { ...base.cell, ...overrides.cell },
    border: { ...base.border, ...overrides.border },
    footer: { ...base.footer, ...overrides.footer },
    nested: { ...base.nested, ...overrides.nested },
    chrome: { ...base.chrome, ...overrides.chrome },
    selectCell: { ...base.selectCell, ...overrides.selectCell },
    rowHeader: { ...base.rowHeader, ...overrides.rowHeader },
    text: { ...base.text, ...overrides.text },
    pill: { ...base.pill, ...overrides.pill },
  };
}

/** Merge a partial override onto a base token object. */
export function createTableTokens(
  base: TableColorTokens,
  overrides?: PartialTableColorTokens,
): TableColorTokens {
  if (!overrides) return base;
  return deepMergeTokens(base, overrides);
}

/** Card + ScrollArea dashboard tables (portfolio, flights, projects). */
export function nquiCardTablePreset(): TableColorTokens {
  return {
    shell: {
      bg: "bg-card",
      border: "border-border",
      text: "text-card-foreground",
      shadow: "shadow-sm",
    },
    scroll: {
      root: "h-0 max-h-full min-h-0 min-w-0 flex-1 overflow-hidden w-full",
    },
    header: {
      row: "sticky top-0 z-20 bg-card",
      cell: "bg-card",
      cellText: "text-muted-foreground",
      border: "border-border",
      hoverSuppress: "[&_tr:hover]:bg-transparent",
    },
    body: {
      fillMode: "solid",
      rowSolid: "[&_td]:bg-background",
      rowSolidTr: "bg-background",
      rowStripeOdd: "[&>tr:nth-child(odd)>td]:bg-background",
      rowStripeEven: "[&>tr:nth-child(even)>td]:bg-foreground/5",
      rowStripeOddTr: "bg-background",
      // Zebra uses a foreground overlay, not muted: in themes where --muted ≈
      // --background the muted tint is imperceptible. 5% foreground reads as a
      // subtle-but-clear band in both light and dark.
      rowStripeEvenTr: "bg-foreground/5",
      // Opaque twin for sticky cells — color-mix(foreground 5%, card) is the
      // exact opaque equivalent of foreground/5 over the card surface.
      rowStripeEvenPinnedTr: "bg-[color-mix(in_oklab,var(--foreground)_5%,var(--card))]",
      rowNone: "",
      rowHover: "[&_tr:hover>td:not([data-row-header])]:bg-muted/40",
      rowSelected: "[&_tr[data-state=selected]>td:not([data-row-header])]:bg-muted/50",
      rowFocus: "",
      rowDisabled: "opacity-75 text-muted-foreground",
      rowExpanded: "hover:[&>td]:!bg-muted/30",
      rowGroup: "bg-muted/30 font-medium",
    },
    pinned: {
      headFill: "bg-card",
      // Opaque base so sticky cells don't bleed scrolled content. Hover/selected
      // overlays are color-mixed onto [data-pinned] in the consumer CSS, so no
      // !important lock here — that would freeze the pinned column's row state.
      bodyFill: "bg-background",
      bodyHoverLock: "",
    },
    cell: {
      default: "border-border/40",
      focus: "bg-muted/50 outline outline-1 outline-ring/40",
      active: "ring-2 ring-ring",
      rangeFill: "bg-primary/10",
      rangeActive: "bg-primary/15 outline outline-1 -outline-offset-1 outline-primary/40",
    },
    border: {
      row: "[&_td]:border-0 [&_td]:border-b [&_td]:border-border/40",
      rowLast: "[&_tr:last-child_td]:border-b-0",
      cornerRadius:
        "[&_tr:first-child_td:first-child]:rounded-tl-xl [&_tr:first-child_td:last-child]:rounded-tr-xl [&_tr:last-child_td:first-child]:rounded-bl-xl [&_tr:last-child_td:last-child]:rounded-br-xl",
      column: "",
    },
    footer: {
      bg: "bg-card",
      border: "border-border",
    },
    nested: {
      panel: "rounded-xl border border-border/50 bg-card/55",
      header: "bg-card [&_tr]:border-b [&_tr]:border-border/40 [&_tr:hover]:bg-transparent",
      body: "[&_td]:border-0 [&_td]:border-b [&_td]:border-border/40 [&_tr:last-child_td]:border-b-0 [&_td]:bg-muted/20",
    },
    chrome: {
      resizeHover: "hover:border-border hover:bg-primary/15",
      resizeActive: "border-primary/40 bg-primary/20",
      sortActive: "text-foreground",
    },
    selectCell: {
      gutterWidth: "w-6",
      number: "text-sm font-medium tabular-nums text-foreground",
      grip: "text-muted-foreground",
      gripActive: "text-foreground",
      holdRing: "border-muted-foreground/35",
      gripFocus: "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
    },
    rowHeader: {
      // Excel-style muted panel — a foreground overlay reads clearly in both
      // modes (muted ≈ background in this theme). Pinned variants are opaque
      // (color-mix) so the sticky gutter never bleeds scrolled content.
      headFill: "bg-foreground/10",
      headText: "text-muted-foreground",
      bodyFill: "bg-foreground/6",
      bodyText: "text-[11px] font-normal tabular-nums text-muted-foreground",
      edgeBorder: "border-r border-border/80",
      pinnedHeadFill: "bg-[color-mix(in_oklab,var(--foreground)_10%,var(--card))]",
      pinnedBodyFill: "bg-[color-mix(in_oklab,var(--foreground)_6%,var(--card))]",
    },
    text: {
      header: "text-muted-foreground",
      primary: "text-foreground",
      muted: "text-muted-foreground",
      emphasis: "text-primary",
    },
    pill: {
      default: "border-transparent bg-primary/15 text-primary",
      secondary: "border-transparent bg-secondary text-secondary-foreground",
      destructive: "border-transparent bg-destructive/15 text-destructive",
      outline: "border-border bg-background text-foreground",
    },
  };
}

/** Dense pinned spreadsheet grids (pipeline, pinning labs). */
export function nquiSpreadsheetPreset(): TableColorTokens {
  return nquiVirtualDataGridPreset();
}

/**
 * Canonical analytics / virtualized grid — SSOT: `virtual-data-demo.tsx`.
 * Spreadsheet grid chrome + row-index gutter tokens; row fills come from card fill mode in the playground.
 */
export function nquiVirtualDataGridPreset(): TableColorTokens {
  return createTableTokens(nquiCardTablePreset(), {
    shell: {
      bg: "bg-card",
      shadow: "",
    },
    rowHeader: {
      headFill: "bg-foreground/12",
      bodyFill: "bg-foreground/6",
    },
    pinned: {
      headFill: "bg-card",
      // Opaque base only. Row-state overlays come from the [data-pinned] CSS
      // (color-mix), so the pinned column tracks hover/selection like the body.
      bodyFill: "bg-card",
      bodyHoverLock: "",
    },
    body: {
      fillMode: "none",
      rowHover: "[&_tr:hover>td:not([data-row-header]):not([data-pinned])]:bg-muted/40",
      rowSelected: "[&_tr[data-state=selected]>td:not([data-row-header]):not([data-pinned])]:bg-muted/50",
      rowExpanded: "hover:[&>td]:!bg-muted/30",
    },
    border: {
      row: "[&_td]:border-b [&_td]:border-border/60",
      rowLast: "",
      cornerRadius: "",
      column: "border-border/60",
    },
    cell: {
      default: "border-b border-border/60",
    },
    nested: {
      body: "[&_td]:border-b [&_td]:border-border/60 [&_td]:bg-muted/20",
    },
  });
}

/**
 * Project / PMO tables: grouped initiative rows, status pills, accent selection.
 * Card-based with stronger group headers and a slightly wider grip lane for the
 * drag-to-reorder workflows these views lean on.
 */
export function nquiPmoPreset(): TableColorTokens {
  return createTableTokens(nquiCardTablePreset(), {
    body: {
      fillMode: "solid",
      rowSelected: "[&_tr[data-state=selected]_td]:bg-primary/10",
      rowGroup: "bg-muted/40 font-semibold text-foreground",
      rowExpanded: "hover:[&>td]:!bg-primary/5",
    },
    cell: {
      rangeFill: "bg-primary/10",
      rangeActive: "bg-primary/20 outline outline-1 -outline-offset-1 outline-primary/50",
    },
    selectCell: {
      gutterWidth: "w-7",
      gripActive: "text-primary",
    },
    pill: {
      default: "border-transparent bg-primary/15 text-primary",
      secondary: "border-transparent bg-secondary text-secondary-foreground",
      destructive: "border-transparent bg-destructive/15 text-destructive",
      outline: "border-border bg-background text-foreground",
    },
  });
}

/** Resolve a shipped preset by id. */
export function tableTokensForPreset(preset: TableTokenPreset): TableColorTokens {
  switch (preset) {
    case "spreadsheet":
      return nquiSpreadsheetPreset();
    case "pmo":
      return nquiPmoPreset();
    case "card":
    default:
      return nquiCardTablePreset();
  }
}
