import type { StarMap } from "./HyperlaneAdapter.js";
import type { PathResult } from "./PathResult.js";
import { HyperlaneAdapter } from "./HyperlaneAdapter.js";
import { BucketQueue } from "./BucketQueue.js";
import { aStar } from "./AStar.js";

/**
 * Convenience wrapper for hyperlane pathfinding.
 * Reuses a BucketQueue across calls for reduced allocation.
 */
export class HyperlanePathfinder {
  private adapter: HyperlaneAdapter;
  private queue: BucketQueue;

  constructor(map: StarMap) {
    this.adapter = new HyperlaneAdapter(map);
    this.queue = new BucketQueue(map.systemCount, 1024);
  }

  /** Find shortest path between two systems via hyperlanes. */
  findPath(from: number, to: number): PathResult {
    return aStar(this.adapter, from, to, this.queue);
  }

  /** Update the star map reference (e.g. after hyperlane changes). */
  updateMap(map: StarMap): void {
    this.adapter = new HyperlaneAdapter(map);
    this.queue = new BucketQueue(map.systemCount, 1024);
  }
}
