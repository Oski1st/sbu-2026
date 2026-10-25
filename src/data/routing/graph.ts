import type { Agency } from '../../types';
export interface ConceptEdge { from: string; to: string; minutes: number; agency: Agency; line: string }

/** Binary heap with the catalogue's original node order as deterministic tie-break. */
class Heap {
  private items: { node: string; cost: number; rank: number }[] = [];
  private before(a: typeof this.items[number], b: typeof this.items[number]) {
    return a.cost < b.cost || (a.cost === b.cost && a.rank < b.rank);
  }
  push(item: typeof this.items[number]) {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(item, this.items[parent])) break;
      this.items[i] = this.items[parent]; i = parent;
    }
    this.items[i] = item;
  }
  pop() {
    const first = this.items[0], last = this.items.pop();
    if (!this.items.length || !last) return first;
    let i = 0;
    while (2 * i + 1 < this.items.length) {
      let child = 2 * i + 1;
      if (child + 1 < this.items.length && this.before(this.items[child + 1], this.items[child])) child++;
      if (!this.before(this.items[child], last)) break;
      this.items[i] = this.items[child]; i = child;
    }
    this.items[i] = last;
    return first;
  }
  get size() { return this.items.length; }
}

/** Static nonnegative concept weights only; not a timetable/live-data router. */
export function createGraph(nodes: readonly string[], edges: readonly ConceptEdge[]) {
  if (new Set(nodes).size !== nodes.length) throw new Error('Duplicate graph node');
  const rank = new Map(nodes.map((node, i) => [node, i]));
  const adjacency = new Map(nodes.map(node => [node, [] as ConceptEdge[]]));
  for (const edge of edges) {
    if (!rank.has(edge.from) || !rank.has(edge.to) || !Number.isFinite(edge.minutes) || edge.minutes < 0) {
      throw new Error('Invalid static concept edge');
    }
    adjacency.get(edge.from)!.push({ ...edge });
  }
  return {
    nodeCount: nodes.length, edgeCount: edges.length,
    path(origin: string, destination: string): ConceptEdge[] | undefined {
      if (!rank.has(origin) || !rank.has(destination) || origin === destination) return undefined;
      const costs = new Map<string, number>([[origin, 0]]), previous = new Map<string, ConceptEdge>();
      const settled = new Set<string>(), queue = new Heap();
      queue.push({ node: origin, cost: 0, rank: rank.get(origin)! });
      while (queue.size) {
        const current = queue.pop()!;
        if (settled.has(current.node) || current.cost !== costs.get(current.node)) continue;
        settled.add(current.node);
        if (current.node === destination) break;
        for (const edge of adjacency.get(current.node)!) {
          if (settled.has(edge.to)) continue;
          const candidate = current.cost + edge.minutes;
          if (candidate < (costs.get(edge.to) ?? Infinity)) {
            costs.set(edge.to, candidate); previous.set(edge.to, edge);
            queue.push({ node: edge.to, cost: candidate, rank: rank.get(edge.to)! });
          }
        }
      }
      if (!previous.has(destination)) return undefined;
      const result: ConceptEdge[] = [];
      for (let node = destination; node !== origin;) {
        const edge = previous.get(node)!; result.push({ ...edge }); node = edge.from;
      }
      return result.reverse();
    },
  };
}
