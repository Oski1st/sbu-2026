import type { ConceptEdge } from './graph';

/** Simple independent array Dijkstra, stable catalogue-order ties. */
export function reference(nodes: readonly string[], edges: readonly ConceptEdge[], from: string, to: string) {
  const costs = new Map([[from, 0]]), prev = new Map<string, ConceptEdge>(), remaining = new Set(nodes);
  while (remaining.size) {
    let next: string | undefined, cost = Infinity;
    for (const node of remaining) if ((costs.get(node) ?? Infinity) < cost) { next = node; cost = costs.get(node)!; }
    if (!next) break;
    remaining.delete(next); if (next === to) break;
    for (const edge of edges) if (edge.from === next && remaining.has(edge.to)) {
      const candidate = cost + edge.minutes;
      if (candidate < (costs.get(edge.to) ?? Infinity)) { costs.set(edge.to, candidate); prev.set(edge.to, edge); }
    }
  }
  if (!prev.has(to)) return undefined;
  const result: ConceptEdge[] = [];
  for (let at = to; at !== from;) { const edge = prev.get(at)!; result.unshift({ ...edge }); at = edge.from; }
  return result;
}
