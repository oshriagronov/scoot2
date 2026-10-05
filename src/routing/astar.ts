import { edgeCost, heuristicCost, type CostOptions } from './cost';
import { distance } from './geo';
import type { Graph } from './graph';

/** Binary min-heap keyed by priority. */
class MinHeap {
  private keys: number[] = [];
  private vals: number[] = [];

  get size() {
    return this.keys.length;
  }

  peekKey() {
    return this.keys[0];
  }

  push(key: number, val: number) {
    const k = this.keys;
    const v = this.vals;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }

  pop(): number {
    const k = this.keys;
    const v = this.vals;
    const top = v[0];
    const lastK = k.pop()!;
    const lastV = v.pop()!;
    if (k.length > 0) {
      let i = 0;
      const n = k.length;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && k[r] < k[l] ? r : l;
        if (k[c] >= lastK) break;
        k[i] = k[c];
        v[i] = v[c];
        i = c;
      }
      k[i] = lastK;
      v[i] = lastV;
    }
    return top;
  }
}

export interface Terminal {
  node: number;
  /** Cost of getting between the node and the actual start/end point. */
  cost: number;
}

export interface PathResult {
  /** Node sequence from a start terminal to an end terminal. */
  nodes: number[];
  /** Way index used to reach nodes[i] from nodes[i - 1]; ways[0] is -1. */
  ways: number[];
  cost: number;
}

/**
 * Multi-source, multi-target A*. Sources and targets carry connection costs so
 * the search can pick whichever nearby node gives the cheapest overall route.
 */
export function aStar(
  g: Graph,
  sources: Terminal[],
  targets: Terminal[],
  dest: { lat: number; lon: number },
  opts: CostOptions,
): PathResult | null {
  const n = g.lat.length;
  const gScore = new Float64Array(n).fill(Infinity);
  const prevNode = new Int32Array(n).fill(-1);
  const prevWay = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const targetCost = new Map(targets.map((t) => [t.node, t.cost]));
  const h = (i: number) => heuristicCost(distance(g.lat[i], g.lon[i], dest.lat, dest.lon), opts);

  const heap = new MinHeap();
  for (const s of sources) {
    if (s.cost < gScore[s.node]) {
      gScore[s.node] = s.cost;
      heap.push(s.cost + h(s.node), s.node);
    }
  }

  let bestCost = Infinity;
  let bestNode = -1;

  while (heap.size > 0 && heap.peekKey() < bestCost) {
    const u = heap.pop();
    if (closed[u]) continue;
    closed[u] = 1;

    const tc = targetCost.get(u);
    if (tc !== undefined && gScore[u] + tc < bestCost) {
      bestCost = gScore[u] + tc;
      bestNode = u;
    }

    for (const e of g.adj[u]) {
      if (closed[e.to]) continue;
      const cand = gScore[u] + edgeCost(g.ways[e.way], e.length, opts);
      if (cand < gScore[e.to]) {
        gScore[e.to] = cand;
        prevNode[e.to] = u;
        prevWay[e.to] = e.way;
        heap.push(cand + h(e.to), e.to);
      }
    }
  }

  if (bestNode < 0) return null;
  const nodes: number[] = [];
  const ways: number[] = [];
  for (let cur = bestNode; cur !== -1; cur = prevNode[cur]) {
    nodes.push(cur);
    ways.push(prevWay[cur]);
  }
  nodes.reverse();
  ways.reverse();
  return { nodes, ways, cost: bestCost };
}
