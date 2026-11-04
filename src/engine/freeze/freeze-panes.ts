/**
 * Excel-style freeze panes state and column prefix resolution.
 * Column geometry reuses pinned-layout; this module names the Excel contract.
 */

import {
  resolvePinnedLeftPrefix,
  resolvePinnedLeftWithLeadingGutter,
} from "../pinning/pinned-layout";

export interface FreezePanesState {
  /** Leaf column ids frozen at inline-start (prefix invariant). */
  readonly frozenLeftColumnIds: readonly string[];
  /** Header rows in thead (default 1). */
  readonly headerRowCount: number;
  /**
   * Body rows frozen below header.
   * Excel "Freeze at row R" → `frozenTopBodyRowCount = R - headerRowCount`.
   */
  readonly frozenTopBodyRowCount: number;
}

export const DEFAULT_HEADER_ROW_COUNT = 1;

export function createFreezePanesState(
  partial: Partial<FreezePanesState> & Pick<FreezePanesState, "frozenLeftColumnIds">,
): FreezePanesState {
  return {
    headerRowCount: DEFAULT_HEADER_ROW_COUNT,
    frozenTopBodyRowCount: 0,
    ...partial,
  };
}

/**
 * Excel 1-based cell (row, col) where freeze splits below/right of the cell.
 * Row 3, col 2 → freeze rows 1–2 and column A (col 1).
 *
 * `orderedLeafColumnIds` must be the table's real ordered leaf column ids. The
 * frozen-left prefix is sliced directly from them, so the returned
 * `frozenLeftColumnIds` are ids that actually exist in the grid. Previously this
 * helper fabricated `col-${i}` placeholders that never matched real leaf ids,
 * which made {@link resolveFrozenLeftPrefix} silently freeze nothing — passing
 * the real ids makes the helper usable end-to-end.
 */
export function freezePanesFromExcelCell(
  excelRow: number,
  excelCol: number,
  orderedLeafColumnIds: readonly string[],
  options?: { headerRowCount?: number },
): FreezePanesState {
  const headerRowCount = options?.headerRowCount ?? DEFAULT_HEADER_ROW_COUNT;
  if (excelRow < 1 || excelCol < 1) {
    throw new Error("freezePanesFromExcelCell: excelRow and excelCol must be >= 1");
  }
  const frozenTopBodyRowCount = Math.max(0, excelRow - headerRowCount);
  const frozenLeftColumnCount = Math.max(0, excelCol - 1);
  const frozenLeftColumnIds = orderedLeafColumnIds.slice(0, frozenLeftColumnCount);
  return {
    frozenLeftColumnIds,
    headerRowCount,
    frozenTopBodyRowCount,
  };
}

/** Alias for {@link resolvePinnedLeftPrefix}. */
export function resolveFrozenLeftPrefix(
  visibleColumnIds: readonly string[],
  frozenLeftColumnIds: readonly string[],
): readonly string[] {
  return resolvePinnedLeftPrefix(visibleColumnIds, frozenLeftColumnIds);
}

/** Alias for {@link resolvePinnedLeftWithLeadingGutter}. */
export function resolveFrozenLeftWithLeadingGutter(
  visibleColumnIds: readonly string[],
  dataFrozenLeftIds: readonly string[],
  leadingGutterColumnId: string,
): readonly string[] {
  return resolvePinnedLeftWithLeadingGutter(
    visibleColumnIds,
    dataFrozenLeftIds,
    leadingGutterColumnId,
  );
}

export function getFrozenTopRowCount(state: FreezePanesState): number {
  return state.frozenTopBodyRowCount;
}

export function sumBandHeightsPx(heights: readonly number[]): number {
  return heights.reduce((sum, h) => sum + h, 0);
}
