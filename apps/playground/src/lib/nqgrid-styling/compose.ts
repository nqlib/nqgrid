import type { TableBodyFillMode, TableColorTokens } from "./schema";

export interface TableClassBundle {
  shell: string;
  header: string;
  headCell: string;
  body: string;
  row: string;
  cell: string;
  pinnedHeadFill: string;
  pinnedBodyFill: string;
  footer: string;
  nestedPanel: string;
  nestedHeader: string;
  nestedBody: string;
  cellFocus: string;
  cellActive: string;
  cellRangeFill: string;
  cellRangeActive: string;
  rowDisabled: string;
  rowExpanded: string;
  rowGroup: string;
  chromeResizeHover: string;
  chromeResizeActive: string;
  /** Select-column grip lane width (reserves space so the grip never overlays the checkbox). */
  selectGutterWidth: string;
  /** Row-number text in the select column. */
  selectNumber: string;
  /** Grip icon at rest. */
  selectGrip: string;
  /** Grip icon when drag-ready / grabbed. */
  selectGripActive: string;
  /** Hold-progress ring border. */
  selectHoldRing: string;
  /** Keyboard focus ring for the grip. */
  selectGripFocus: string;
  /** Corner `#` header cell in the row-index gutter. */
  gridRowHeaderHeadCell: string;
  /** Body row-index gutter cell (`<td data-row-header>`). */
  gridRowHeaderCell: string;
  /** Gutter layout without body fill — use with per-row pinned stripe fill. */
  gridRowHeaderCellShell: string;
  /** Row number text inside the gutter. */
  gridRowHeaderNumber: string;
  /** Opaque fills for pinned row-index gutter cells (sticky horizontal scroll). */
  gridRowHeaderPinnedHeadFill: string;
  gridRowHeaderPinnedBodyFill: string;
  /** Layout-only scroll root (no color). */
  scrollRoot: string;
  /** Full card shell: bounded flex column + rounded border. */
  tableShell: string;
  /** Spreadsheet outer scroll shell. */
  gridShell: string;
  gridScroll: string;
  gridTable: string;
  gridHeadCell: string;
  gridCell: string;
  gridNumeric: string;
  tableDenseTypography: string;
  tableHeadCellPadding: string;
  tableCellPadding: string;
  tableFooter: string;
  textNumeric: string;
  textNumericMuted: string;
  textNumericStrong: string;
  richPillBase: string;
  richTagBase: string;
  richStatusSelect: string;
}

function joinClasses(...parts: (string | undefined | false)[]): string {
  return parts.filter(Boolean).join(" ");
}

function bodyFillClass(tokens: TableColorTokens): string {
  switch (tokens.body.fillMode) {
    case "striped":
      return joinClasses(tokens.body.rowStripeOdd, tokens.body.rowStripeEven);
    case "none":
      return tokens.body.rowNone;
    case "solid":
    default:
      return tokens.body.rowSolid;
  }
}

/** Per-row fill for `<tr>` — reliable with pinned columns (tbody nth-child can miss generated utilities). */
export function buildRowFillClass(tokens: TableColorTokens, rowIndex: number): string {
  switch (tokens.body.fillMode) {
    case "striped":
      return rowIndex % 2 === 0 ? tokens.body.rowStripeOddTr : tokens.body.rowStripeEvenTr;
    case "solid":
      return tokens.body.rowSolidTr;
    case "none":
    default:
      return "";
  }
}

/** tbody class: borders + hover + selection + fill + corner radius (legacy order). */
export function buildBodyClass(tokens: TableColorTokens): string {
  return joinClasses(buildBodyChromeClass(tokens), bodyFillClass(tokens));
}

/** tbody borders, hover, selection — no row fill (use `buildRowFillClass` on `<tr>`). */
export function buildBodyChromeClass(tokens: TableColorTokens): string {
  return joinClasses(
    tokens.border.row,
    tokens.border.rowLast,
    tokens.border.cornerRadius,
    tokens.body.rowHover,
    tokens.body.rowSelected,
  );
}

/** Spreadsheet tbody: hover + selection only (no default fill when fillMode is none). */
export function buildGridBodyClass(tokens: TableColorTokens): string {
  const fill = tokens.body.fillMode === "none" ? "" : bodyFillClass(tokens);
  return joinClasses(fill, tokens.body.rowHover, tokens.body.rowSelected);
}

/** Pick tbody classes respecting `body.fillMode`. */
export function tableBodyClassFor(tokens: TableColorTokens): string {
  return buildBodyClass(tokens);
}

/** Apply fill mode without mutating the base tokens object. */
export function withBodyFillMode(
  tokens: TableColorTokens,
  fillMode: TableBodyFillMode,
): TableColorTokens {
  return { ...tokens, body: { ...tokens.body, fillMode } };
}

/** Per-row fill for pinned body cells — opaque stripes that match `<tr>` fills. */
export function buildPinnedRowFillClass(tokens: TableColorTokens, rowIndex: number): string {
  switch (tokens.body.fillMode) {
    case "striped":
      return rowIndex % 2 === 0 ? tokens.body.rowStripeOddTr : tokens.body.rowStripeEvenPinnedTr;
    case "solid":
      return tokens.body.rowSolidTr;
    case "none":
    default:
      return "";
  }
}

/**
 * Opaque per-row fill for a pinned body cell — matches the `<tr>` fill exactly
 * (solid/striped) so the pinned column reads identically to the body at rest.
 * No hover lock: the consumer supplies the opaque hover/selected overlay (see
 * the `[data-pinned]` rules in the app CSS) so the pinned column tracks row state.
 */
export function buildPinnedBodyCellFill(tokens: TableColorTokens, rowIndex: number): string {
  const fill = buildPinnedRowFillClass(tokens, rowIndex);
  if (!fill) return buildPinnedBodyFill(tokens);
  return fill;
}

export function buildPinnedBodyFill(tokens: TableColorTokens): string {
  return joinClasses(tokens.pinned.bodyFill, tokens.pinned.bodyHoverLock);
}

export function buildTableClasses(tokens: TableColorTokens): TableClassBundle {
  const header = joinClasses(
    tokens.header.row,
    "[&_tr]:border-b",
    `[&_tr]:${tokens.header.border}`,
    tokens.header.hoverSuppress,
  );

  const headCell = joinClasses(
    tokens.header.cell,
    "h-8 whitespace-nowrap border-0 px-3 align-middle text-xs font-medium uppercase tracking-wide",
    tokens.header.cellText,
  );

  const gridHeadCell = joinClasses(
    tokens.header.cell,
    "h-8 whitespace-nowrap border-b border-border px-3 py-2 text-left align-middle text-[10px] font-medium uppercase tracking-wider",
    tokens.header.cellText,
  );

  const gridRowHeaderHeadCell = joinClasses(
    tokens.rowHeader.headFill,
    tokens.rowHeader.headText,
    tokens.rowHeader.edgeBorder,
    "h-8 border-b border-border px-0 text-center align-middle text-[10px] font-semibold tabular-nums tracking-wider",
  );

  const gridRowHeaderCell = joinClasses(
    tokens.rowHeader.bodyFill,
    tokens.rowHeader.edgeBorder,
    "px-0 py-0 text-center align-middle select-none",
  );

  const gridRowHeaderCellShell = joinClasses(
    tokens.rowHeader.edgeBorder,
    "px-0 py-0 text-center align-middle select-none",
  );

  const gridRowHeaderNumber = tokens.rowHeader.bodyText;

  const cell = joinClasses("px-3 py-1.5 align-middle text-xs", tokens.cell.default);
  const gridCell = joinClasses("px-3 py-1.5 align-middle text-xs", tokens.cell.default);

  const tableShell = joinClasses(
    "flex w-full min-h-[28rem] max-h-[min(84dvh,calc(100dvh-8rem))] flex-col overflow-hidden rounded-2xl border",
    tokens.shell.border,
    tokens.shell.bg,
    tokens.shell.text,
    tokens.shell.shadow,
  );

  const gridShell = joinClasses(
    "min-h-0 max-h-full w-full overflow-auto rounded-2xl border nqui-scrollbar-on-scroll",
    tokens.shell.border,
    tokens.shell.bg,
  );

  const tableFooter = joinClasses(
    "flex shrink-0 flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
    tokens.footer.border,
    tokens.footer.bg,
  );

  const textNumeric = "text-xs leading-normal tabular-nums";
  const textNumericMuted = joinClasses(textNumeric, tokens.text.muted);
  const textNumericStrong = joinClasses(textNumeric, "font-medium", tokens.text.primary);

  return {
    shell: joinClasses("rounded-2xl border", tokens.shell.border, tokens.shell.bg, tokens.shell.text),
    header,
    headCell,
    body: buildBodyClass(tokens),
    row: "group/row border-0 transition-colors",
    cell,
    pinnedHeadFill: tokens.pinned.headFill,
    pinnedBodyFill: buildPinnedBodyFill(tokens),
    footer: tableFooter,
    nestedPanel: tokens.nested.panel,
    nestedHeader: tokens.nested.header,
    nestedBody: tokens.nested.body,
    cellFocus: tokens.cell.focus,
    cellActive: tokens.cell.active,
    cellRangeFill: tokens.cell.rangeFill,
    cellRangeActive: tokens.cell.rangeActive,
    rowDisabled: tokens.body.rowDisabled,
    rowExpanded: tokens.body.rowExpanded,
    rowGroup: tokens.body.rowGroup,
    chromeResizeHover: tokens.chrome.resizeHover,
    chromeResizeActive: tokens.chrome.resizeActive,
    selectGutterWidth: tokens.selectCell.gutterWidth,
    selectNumber: tokens.selectCell.number,
    selectGrip: tokens.selectCell.grip,
    selectGripActive: tokens.selectCell.gripActive,
    selectHoldRing: tokens.selectCell.holdRing,
    selectGripFocus: tokens.selectCell.gripFocus,
    gridRowHeaderHeadCell,
    gridRowHeaderCell,
    gridRowHeaderCellShell,
    gridRowHeaderNumber,
    gridRowHeaderPinnedHeadFill: tokens.rowHeader.pinnedHeadFill,
    gridRowHeaderPinnedBodyFill: tokens.rowHeader.pinnedBodyFill,
    scrollRoot: tokens.scroll.root,
    tableShell,
    gridShell,
    gridScroll: "min-h-0 flex-1 w-full overflow-auto nqui-scrollbar-on-scroll",
    gridTable: "table-fixed border-separate border-spacing-0 text-xs",
    gridHeadCell,
    gridCell,
    gridNumeric: "text-right tabular-nums",
    tableDenseTypography:
      "w-full caption-bottom border-separate border-spacing-0 text-xs [&_thead_th]:text-xs [&_thead_th]:font-medium [&_thead_th]:text-muted-foreground [&_tbody_td]:leading-normal",
    tableHeadCellPadding: "h-8",
    tableCellPadding: cell,
    tableFooter,
    textNumeric,
    textNumericMuted,
    textNumericStrong,
    richPillBase:
      "inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize leading-normal",
    richTagBase:
      "inline-flex max-w-full items-center rounded-md border px-1.5 py-0 text-[11px] font-medium capitalize leading-normal",
    richStatusSelect:
      "max-w-full cursor-pointer appearance-none rounded-md border px-2 py-0.5 text-xs font-medium capitalize leading-normal outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring",
  };
}
