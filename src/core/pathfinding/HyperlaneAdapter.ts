import type { AStarAdapter } from "./AStar";

/**
 * CSR (Compressed Sparse Row) adjacency representation of a star map.
 */
export interface StarMap {
  /** Number of star systems. */
  systemCount: number;
  /** X coordinates of each system. */
  systemX: Float32Array;
  /** Y coordinates of each system. */
  systemY: Float32Array;
  /** CSR offset array: adjOffset[i] to adjOffset[i+1] gives neighbor range for system i. */
  adjOffset: Uint32Array;
  /** CSR adjacency list: neighbor ids packed contiguously. */
  adjList: Uint32Array;
}

/**
 * AStarAdapter implementation for hyperlane-based star map pathfinding.
 * Uses Euclidean distance as heuristic.
 */
export class HyperlaneAdapter implements AStarAdapter {
  readonly nodeCount: number;
  private readonly map: StarMap;

  constructor(map: StarMap) {
    this.map = map;
    this.nodeCount = map.systemCount;
  }

  neighbors(node: number, out: Uint32Array): number {
    const start = this.map.adjOffset[node];
    const end = this.map.adjOffset[node + 1];
    const count = end - start;
    for (let i = 0; i < count; i++) {
      out[i] = this.map.adjList[start + i];
    }
    return count;
  }

  cost(a: number, b: number): number {
    const dx = this.map.systemX[a] - this.map.systemX[b];
    const dy = this.map.systemY[a] - this.map.systemY[b];
    return Math.sqrt(dx * dx + dy * dy);
  }

  heuristic(node: number, goal: number): number {
    const dx = this.map.systemX[node] - this.map.systemX[goal];
    const dy = this.map.systemY[node] - this.map.systemY[goal];
    return Math.sqrt(dx * dx + dy * dy);
  }
}
