/**
 * Result of a pathfinding query.
 */
export interface PathResult {
  /** Ordered list of node ids from start to goal (inclusive). Empty if not found. */
  path: number[];
  /** Total cost of the path. 0 if not found. */
  cost: number;
  /** Whether a valid path was found. */
  found: boolean;
  /** Number of iterations the algorithm performed. */
  iterations: number;
}

/** Convenience factory for a "no path" result. */
export function noPath(iterations = 0): PathResult {
  return { path: [], cost: 0, found: false, iterations };
}
