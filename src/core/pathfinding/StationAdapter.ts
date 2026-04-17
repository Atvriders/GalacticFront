import type { AStarAdapter } from "./AStar.js";

/**
 * Network of stations (Hyperloop nodes) with positions and connections.
 */
export interface StationNetwork {
  /** Total number of stations. */
  stationCount: number;
  /** X coordinates of each station. */
  stationX: Float32Array;
  /** Y coordinates of each station. */
  stationY: Float32Array;
  /**
   * Fill `out` with connected station indices and return count.
   */
  stationNeighbors(station: number, out: Uint32Array): number;
  /**
   * Optional: cluster id for each station (-1 if none).
   * Used for connectivity pre-check.
   */
  stationCluster?: Int32Array;
}

/**
 * AStarAdapter implementation for station (Hyperloop) networks.
 */
export class StationAdapter implements AStarAdapter {
  readonly nodeCount: number;
  private readonly net: StationNetwork;

  constructor(net: StationNetwork) {
    this.net = net;
    this.nodeCount = net.stationCount;
  }

  neighbors(node: number, out: Uint32Array): number {
    return this.net.stationNeighbors(node, out);
  }

  cost(a: number, b: number): number {
    const dx = this.net.stationX[a] - this.net.stationX[b];
    const dy = this.net.stationY[a] - this.net.stationY[b];
    return Math.sqrt(dx * dx + dy * dy);
  }

  heuristic(node: number, goal: number): number {
    const dx = this.net.stationX[node] - this.net.stationX[goal];
    const dy = this.net.stationY[node] - this.net.stationY[goal];
    return Math.sqrt(dx * dx + dy * dy);
  }
}
