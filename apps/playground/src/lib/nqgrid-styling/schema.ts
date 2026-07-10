/** Row background fill strategy for tbody cells. */
export type TableBodyFillMode = "solid" | "striped" | "none";

/** Shipped preset identifiers: dashboard card, dense spreadsheet, project/PMO. */
export type TableTokenPreset = "card" | "spreadsheet" | "pmo";

/**
 * Typed table color tokens — every value is an nqui semantic Tailwind class string.
 * Consumers fork or override via `createTableTokens`.
 */
export interface TableColorTokens {
  shell: {
    bg: string;
    border: string;
    text: string;
    shadow: string;
  };
  scroll: {
    /** Layout-only ScrollArea flex contract (may include no color classes). */
    root: string;
  };
  header: {
    row: string;
    cell: string;
    cellText: string;
    border: string;
    hoverSuppress: string;
  };
  body: {
    fillMode: TableBodyFillMode;
    rowSolid: string;
    /** Solid fill applied on `<tr>` (preferred with pinned columns). */
    rowSolidTr: string;
    rowStripeOdd: string;
    rowStripeEven: string;
    /** Striped fill applied on `<tr>` (preferred with pinned columns). */
    rowStripeOddTr: string;
    rowStripeEvenTr: string;
    /** Opaque even stripe for pinned body cells (matches `rowStripeEvenTr` without scroll bleed). */
    rowStripeEvenPinnedTr: string;
    rowNone: string;
    rowHover: string;
    rowSelected: string;
    rowFocus: string;
    rowDisabled: string;
    rowExpanded: string;
    rowGroup: string;
  };
  pinned: {
    headFill: string;
    bodyFill: string;
    bodyHoverLock: string;
  };
  cell: {
    default: string;
    focus: string;
    active: string;
    rangeFill: string;
    rangeActive: string;
  };
  border: {
    row: string;
    rowLast: string;
    cornerRadius: string;
    column: string;
  };
  footer: {
    bg: string;
    border: string;
  };
  nested: {
    panel: string;
    header: string;
    body: string;
  };
  chrome: {
    resizeHover: string;
    resizeActive: string;
    sortActive: string;
  };
  /**
   * Select column (row number ↔ checkbox ↔ drag grip). A stable gutter layout —
   * `gutterWidth` reserves the grip lane so it never overlays the checkbox. All
   * values are semantic class strings the consumer forks.
   */
  selectCell: {
    /** Width of the leading grip lane (keeps the grip off the checkbox hit area). */
    gutterWidth: string;
    /** Row-number text. */
    number: string;
    /** Grip icon at rest. */
    grip: string;
    /** Grip icon when drag-ready / grabbed. */
    gripActive: string;
    /** Hold-progress ring border. */
    holdRing: string;
    /** Focus ring for the keyboard-reachable grip. */
    gripFocus: string;
  };
  /** Excel-style row index gutter (# column) — visually distinct from data cells. */
  rowHeader: {
    /** Unpinned gutter corner header — may be translucent. */
    headFill: string;
    headText: string;
    /** Unpinned gutter body cell — may be translucent. */
    bodyFill: string;
    bodyText: string;
    /** Right edge separating the gutter from the first data column. */
    edgeBorder: string;
    /** Opaque fill when gutter is pinned (sticky). Required — never translucent. */
    pinnedHeadFill: string;
    pinnedBodyFill: string;
  };
  text: {
    header: string;
    primary: string;
    muted: string;
    emphasis: string;
  };
  pill: {
    default: string;
    secondary: string;
    destructive: string;
    outline: string;
  };
}

/** Deep partial override shape for `createTableTokens`. */
export type PartialTableColorTokens = {
  [K in keyof TableColorTokens]?: Partial<TableColorTokens[K]>;
};

/** @deprecated Use `TableBodyFillMode` from `@nqlib/nqgrid/tokens`. */
export type TableBodyFill = Exclude<TableBodyFillMode, "none">;
