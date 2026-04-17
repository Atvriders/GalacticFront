import type { PathResult } from "./PathResult.js";

/**
 * Transformer that can intercept a pathfinding request before execution.
 * If preCheck returns a PathResult, that result is used instead of running the pathfinder.
 */
export interface PathTransformer {
  /** Unique name for this transformer (used for removal). */
  name: string;
  /**
   * Pre-check before pathfinding runs.
   * Return a PathResult to short-circuit, or null to let the pathfinder proceed.
   */
  preCheck(from: number, to: number): PathResult | null;
}
