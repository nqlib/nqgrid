import type { CSSProperties } from "react";
import type { Row } from "@tanstack/react-table";
import type { ExpandedState, Updater } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";

export interface OutlineRowMeta {
  readonly level: number;
  readonly isGroupHeader: boolean;
  readonly isExpanded: boolean;
  readonly canExpand: boolean;
}

export interface OutlineRowIndentOptions {
  /** px per outline level (default 16). */
  indentPxPerLevel?: number;
  /** Base padding before indent (default 8). */
  basePaddingPx?: number;
}

/**
 * Inline padding for Excel-style row group indent (geometry only).
 */
export function getOutlineRowIndentPx(
  depth: number,
  options?: OutlineRowIndentOptions,
): number {
  const perLevel = options?.indentPxPerLevel ?? 16;
  const base = options?.basePaddingPx ?? 8;
  return base + Math.max(0, depth) * perLevel;
}

export function getOutlineRowIndentStyle(
  depth: number,
  options?: OutlineRowIndentOptions,
): CSSProperties {
  const px = getOutlineRowIndentPx(depth, options);
  return { paddingInlineStart: px };
}

export function getOutlineRowMeta<TData>(row: Row<TData>): OutlineRowMeta {
  return {
    level: row.depth,
    isGroupHeader: row.getIsGrouped(),
    isExpanded: row.getIsExpanded(),
    canExpand: row.getCanExpand(),
  };
}

export function expandAllGroups(_expanded?: ExpandedState): ExpandedState {
  return true;
}

export function collapseAllGroups(): ExpandedState {
  return {};
}

/**
 * Expand/collapse every group row at a given `depth` in the current row model.
 */
export function setOutlineLevelExpanded<TData>(
  rows: readonly Row<TData>[],
  level: number,
  expanded: boolean,
  current: ExpandedState,
): ExpandedState {
  const next: Record<string, boolean> =
    typeof current === "object" && current !== null && !Array.isArray(current)
      ? { ...current }
      : {};

  for (const row of rows) {
    if (row.depth === level && row.getCanExpand()) {
      next[row.id] = expanded;
    }
  }
  return next;
}

export interface UseOutlineRowExpansionOptions {
  expanded: ExpandedState;
  onExpandedChange: (updater: Updater<ExpandedState>) => void;
}

export function useOutlineRowExpansion(options: UseOutlineRowExpansionOptions) {
  const { expanded, onExpandedChange } = options;

  const expandAll = useCallback(() => {
    onExpandedChange(expandAllGroups(expanded));
  }, [expanded, onExpandedChange]);

  const collapseAll = useCallback(() => {
    onExpandedChange(collapseAllGroups());
  }, [onExpandedChange]);

  const setLevelExpanded = useCallback(
    <TData>(rows: readonly Row<TData>[], level: number, isExpanded: boolean) => {
      onExpandedChange((old) => setOutlineLevelExpanded(rows, level, isExpanded, old));
    },
    [onExpandedChange],
  );

  return useMemo(
    () => ({ expandAll, collapseAll, setLevelExpanded }),
    [expandAll, collapseAll, setLevelExpanded],
  );
}
