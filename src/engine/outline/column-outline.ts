import type { Table, VisibilityState } from "@tanstack/react-table";

export interface ColumnOutlineGroup {
  readonly id: string;
  readonly leafColumnIds: readonly string[];
  readonly level: number;
  readonly parentId?: string;
}

export interface ColumnOutlineNode {
  readonly id: string;
  readonly label: string;
  readonly children?: readonly ColumnOutlineNode[];
  readonly leafColumnIds?: readonly string[];
}

export interface OutlineHeaderCell {
  readonly id: string;
  readonly label: string;
  readonly colSpan: number;
  readonly level: number;
  readonly groupId?: string;
}

function collectLeafIds(node: ColumnOutlineNode): readonly string[] {
  if (node.leafColumnIds?.length) return node.leafColumnIds;
  if (!node.children?.length) return [node.id];
  return node.children.flatMap(collectLeafIds);
}

/**
 * Count the leaves currently visible under `node`, honoring `collapsedGroupIds`
 * recursively: a collapsed group contributes 1 (its kept lead column), not its
 * full leaf count. Used so a group header's colSpan matches the width its
 * descendant rows actually render to.
 */
function visibleLeafCount(
  node: ColumnOutlineNode,
  collapsedGroupIds: ReadonlySet<string>,
): number {
  if (collapsedGroupIds.has(node.id)) return 1;
  if (node.leafColumnIds?.length) return node.leafColumnIds.length;
  if (!node.children?.length) return 1;
  return node.children.reduce(
    (sum, child) => sum + visibleLeafCount(child, collapsedGroupIds),
    0,
  );
}

function walkGroups(
  nodes: readonly ColumnOutlineNode[],
  parentId: string | undefined,
  level: number,
  out: ColumnOutlineGroup[],
): void {
  for (const node of nodes) {
    const leafColumnIds = collectLeafIds(node);
    out.push({ id: node.id, leafColumnIds, level, parentId });
    if (node.children?.length) {
      walkGroups(node.children, node.id, level + 1, out);
    }
  }
}

export function buildColumnOutlineGroups(
  tree: readonly ColumnOutlineNode[],
): readonly ColumnOutlineGroup[] {
  const groups: ColumnOutlineGroup[] = [];
  walkGroups(tree, undefined, 0, groups);
  return groups;
}

/**
 * Hides leaf columns belonging to collapsed outline groups (Excel column outline).
 */
export function resolveVisibleLeafColumnIds(
  allLeafIds: readonly string[],
  groups: readonly ColumnOutlineGroup[],
  collapsedGroupIds: ReadonlySet<string>,
): readonly string[] {
  if (collapsedGroupIds.size === 0) return allLeafIds;

  const hidden = new Set<string>();
  for (const group of groups) {
    if (!collapsedGroupIds.has(group.id)) continue;
    const keepFirst = group.leafColumnIds[0];
    if (keepFirst == null) continue;
    for (const id of group.leafColumnIds) {
      if (id !== keepFirst) hidden.add(id);
    }
  }

  return allLeafIds.filter((id) => !hidden.has(id));
}

export function columnOutlineToVisibility(
  allLeafIds: readonly string[],
  groups: readonly ColumnOutlineGroup[],
  collapsedGroupIds: ReadonlySet<string>,
): VisibilityState {
  const visible = new Set(
    resolveVisibleLeafColumnIds(allLeafIds, groups, collapsedGroupIds),
  );
  const visibility: VisibilityState = {};
  for (const id of allLeafIds) {
    visibility[id] = visible.has(id);
  }
  return visibility;
}

export function applyColumnOutlineVisibility<TData>(
  table: Table<TData>,
  groups: readonly ColumnOutlineGroup[],
  collapsedGroupIds: ReadonlySet<string>,
): void {
  const allLeafIds = table.getAllLeafColumns().map((c) => c.id);
  const visibility = columnOutlineToVisibility(allLeafIds, groups, collapsedGroupIds);
  table.setColumnVisibility(visibility);
}

export function flattenOutlineHeaderRows(
  tree: readonly ColumnOutlineNode[],
  collapsedGroupIds: ReadonlySet<string>,
): OutlineHeaderCell[][] {
  const maxDepth = maxOutlineDepth(tree);
  const rows: OutlineHeaderCell[][] = Array.from({ length: maxDepth + 1 }, () => []);

  const walk = (nodes: readonly ColumnOutlineNode[], depth: number): void => {
    for (const node of nodes) {
      const collapsed = collapsedGroupIds.has(node.id);
      // Count only leaves visible under this node: a collapsed descendant
      // group contributes 1, so every header row agrees on the rendered width.
      const colSpan = Math.max(1, visibleLeafCount(node, collapsedGroupIds));

      rows[depth]!.push({
        id: node.id,
        label: node.label,
        colSpan,
        level: depth,
        groupId: node.children?.length ? node.id : undefined,
      });

      if (node.children?.length && !collapsed) {
        walk(node.children, depth + 1);
      }
    }
  };

  walk(tree, 0);
  return rows;
}

function maxOutlineDepth(nodes: readonly ColumnOutlineNode[], depth = 0): number {
  let max = depth;
  for (const node of nodes) {
    if (node.children?.length) {
      max = Math.max(max, maxOutlineDepth(node.children, depth + 1));
    }
  }
  return max;
}

export function toggleOutlineGroup(
  collapsed: ReadonlySet<string>,
  groupId: string,
): Set<string> {
  const next = new Set(collapsed);
  if (next.has(groupId)) next.delete(groupId);
  else next.add(groupId);
  return next;
}
