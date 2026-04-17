import type { PriorityQueue } from "./PriorityQueue.js";
import type { PathResult } from "./PathResult.js";
import { noPath } from "./PathResult.js";
import { MinHeap } from "./MinHeap.js";

/** Maximum iterations before A* gives up. */
const MAX_ITERATIONS = 500_000;

/**
 * Adapter that an A* consumer must implement to describe the graph.
 */
export interface AStarAdapter {
  /** Total number of nodes in the graph. */
  nodeCount: number;
  /** Fill `out` with neighbor node ids of `node` and return the count written. */
  neighbors(node: number, out: Uint32Array): number;
  /** Edge cost from `a` to `b`. */
  cost(a: number, b: number): number;
  /** Admissible heuristic estimate from `node` to `goal`. */
  heuristic(node: number, goal: number): number;
}

/**
 * Generic A* search with stamp-based visited tracking.
 *
 * @param adapter  graph description
 * @param start    start node id
 * @param goal     goal node id
 * @param queue    optional priority queue (defaults to MinHeap)
 */
export function aStar(
  adapter: AStarAdapter,
  start: number,
  goal: number,
  queue?: PriorityQueue
): PathResult {
  const n = adapter.nodeCount;
  const pq = queue ?? new MinHeap(n);
  pq.clear();

  // gScore: best known cost to reach each node
  const gScore = new Float32Array(n);
  gScore.fill(Infinity);
  gScore[start] = 0;

  // stamp-based visited: stamp[node] === currentStamp means visited
  const visited = new Uint32Array(n); // all zeros initially
  const currentStamp = 1; // single-use; for reuse, increment

  // parent tracking for path reconstruction
  const parent = new Int32Array(n);
  parent.fill(-1);

  // neighbor scratch buffer
  const neighborBuf = new Uint32Array(256);

  pq.push(start, adapter.heuristic(start, goal));

  let iterations = 0;

  while (!pq.isEmpty()) {
    if (++iterations > MAX_ITERATIONS) {
      return noPath(iterations);
    }

    const current = pq.pop();

    if (current === goal) {
      return buildResult(parent, gScore, start, goal, iterations);
    }

    if (visited[current] === currentStamp) continue;
    visited[current] = currentStamp;

    const count = adapter.neighbors(current, neighborBuf);
    for (let i = 0; i < count; i++) {
      const neighbor = neighborBuf[i];
      if (visited[neighbor] === currentStamp) continue;

      const tentativeG = gScore[current] + adapter.cost(current, neighbor);
      if (tentativeG < gScore[neighbor]) {
        gScore[neighbor] = tentativeG;
        parent[neighbor] = current;
        const f = tentativeG + adapter.heuristic(neighbor, goal);
        pq.push(neighbor, f);
      }
    }
  }

  return noPath(iterations);
}

function buildResult(
  parent: Int32Array,
  gScore: Float32Array,
  start: number,
  goal: number,
  iterations: number
): PathResult {
  const path: number[] = [];
  let node = goal;
  while (node !== start) {
    path.push(node);
    node = parent[node];
    if (node === -1) return noPath(iterations); // shouldn't happen
  }
  path.push(start);
  path.reverse();
  return {
    path,
    cost: gScore[goal],
    found: true,
    iterations,
  };
}
