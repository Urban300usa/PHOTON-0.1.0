// Gate-to-gate route planner using Dijkstra's algorithm
// Supports: shortest, prefer highsec, avoid highsec/lowsec

export type GatePreference = "shortest" | "prefer_highsec" | "prefer_lowsec" | "avoid_highsec";

export interface GateRouteOptions {
  preference: GatePreference;
  avoidSystems?: Set<number>; // System IDs to avoid
  avoidRegions?: Set<number>; // Region IDs to avoid
}

export interface GateRouteResult {
  systemIds: number[];
  gateCount: number;
  found: boolean;
}

interface SystemData {
  sec: number;
  regId: number;
}

/**
 * Build an adjacency list from gate pairs
 * @param gates - Array of [fromSystemId, toSystemId] pairs
 * @returns Map of systemId -> Set of connected systemIds
 */
export function buildGateGraph(gates: [number, number][]): Map<number, Set<number>> {
  const graph = new Map<number, Set<number>>();

  for (const [a, b] of gates) {
    if (!graph.has(a)) graph.set(a, new Set());
    if (!graph.has(b)) graph.set(b, new Set());
    graph.get(a)!.add(b);
    graph.get(b)!.add(a);
  }

  return graph;
}

/**
 * Get edge weight for gate routing based on preference
 */
function getGateWeight(
  fromSec: number,
  toSec: number,
  preference: GatePreference,
): number {
  const destIsHighsec = toSec >= 0.45;
  const destIsLowsec = toSec > 0.0 && toSec < 0.45;
  const destIsNullsec = toSec <= 0.0;

  switch (preference) {
    case "shortest":
      return 1;
    case "prefer_highsec":
      if (destIsHighsec) return 1;
      if (destIsLowsec) return 50;
      return 100; // nullsec
    case "prefer_lowsec":
      if (destIsLowsec || destIsNullsec) return 1;
      if (destIsHighsec) return 5;
      return 1;
    case "avoid_highsec":
      if (destIsHighsec) return 1000;
      return 1;
    default:
      return 1;
  }
}

/**
 * Simple min-heap priority queue for Dijkstra
 */
class MinHeap {
  private data: [number, number][] = []; // [priority, systemId]

  push(priority: number, value: number) {
    this.data.push([priority, value]);
    this._bubbleUp(this.data.length - 1);
  }

  pop(): [number, number] | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() {
    return this.data.length;
  }

  private _bubbleUp(idx: number) {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.data[parent][0] <= this.data[idx][0]) break;
      [this.data[parent], this.data[idx]] = [this.data[idx], this.data[parent]];
      idx = parent;
    }
  }

  private _sinkDown(idx: number) {
    const length = this.data.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < length && this.data[left][0] < this.data[smallest][0]) smallest = left;
      if (right < length && this.data[right][0] < this.data[smallest][0]) smallest = right;
      if (smallest === idx) break;
      [this.data[smallest], this.data[idx]] = [this.data[idx], this.data[smallest]];
      idx = smallest;
    }
  }
}

/**
 * Find shortest gate route using Dijkstra's algorithm
 */
export function findGateRoute(
  origin: number,
  destination: number,
  graph: Map<number, Set<number>>,
  systemLookup: (id: number) => SystemData | undefined,
  options: GateRouteOptions = { preference: "shortest" },
): GateRouteResult {
  const { preference, avoidSystems, avoidRegions } = options;

  if (origin === destination) {
    return { systemIds: [origin], gateCount: 0, found: true };
  }

  if (!graph.has(origin) || !graph.has(destination)) {
    return { systemIds: [], gateCount: 0, found: false };
  }

  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  const heap = new MinHeap();

  dist.set(origin, 0);
  heap.push(0, origin);

  while (heap.size > 0) {
    const [currentDist, current] = heap.pop()!;

    if (current === destination) {
      // Reconstruct path
      const path: number[] = [];
      let node: number | undefined = destination;
      while (node !== undefined) {
        path.unshift(node);
        node = prev.get(node);
      }
      return { systemIds: path, gateCount: path.length - 1, found: true };
    }

    if (currentDist > (dist.get(current) ?? Infinity)) continue;

    const neighbors = graph.get(current);
    if (!neighbors) continue;

    const currentSys = systemLookup(current);
    const currentSec = currentSys?.sec ?? 0;

    const neighborArr = Array.from(neighbors);
    for (let ni = 0; ni < neighborArr.length; ni++) {
      const neighbor = neighborArr[ni];
      // Check avoidance
      if (avoidSystems?.has(neighbor)) continue;
      const neighborSys = systemLookup(neighbor);
      if (avoidRegions && neighborSys && avoidRegions.has(neighborSys.regId)) continue;

      const neighborSec = neighborSys?.sec ?? 0;
      const weight = getGateWeight(currentSec, neighborSec, preference);
      const newDist = currentDist + weight;

      if (newDist < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, newDist);
        prev.set(neighbor, current);
        heap.push(newDist, neighbor);
      }
    }
  }

  return { systemIds: [], gateCount: 0, found: false };
}
