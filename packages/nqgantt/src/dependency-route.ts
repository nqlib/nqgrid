/** Geometry of a rendered bar, in time-area coordinates. */
export interface BarBox {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DepEdge {
  readonly from: string;
  readonly to: string;
}

export interface DepPath {
  readonly from: string;
  readonly to: string;
  /** SVG path `d` for a finish-to-start orthogonal connector. */
  readonly d: string;
}

/**
 * Route finish-to-start dependency arrows from each predecessor's end to its successor's
 * start, as orthogonal elbows. Pure geometry over the supplied bar boxes — the edge list
 * itself lives in the data, not the view.
 */
export function routeDependencies(edges: readonly DepEdge[], boxes: readonly BarBox[], gap = 12): DepPath[] {
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const paths: DepPath[] = [];
  for (const edge of edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) continue;
    const sx = from.x + from.width;
    const sy = from.y + from.height / 2;
    const tx = to.x;
    const ty = to.y + to.height / 2;
    const midX = Math.max(sx + gap, tx - gap);
    paths.push({ from: edge.from, to: edge.to, d: `M ${sx} ${sy} H ${midX} V ${ty} H ${tx}` });
  }
  return paths;
}
