import type { PathTransformer } from "./PathTransformer.js";
import type { PathResult } from "./PathResult.js";
import { noPath } from "./PathResult.js";
import type { UnionFind } from "./UnionFind.js";

/**
 * Fail-fast transformer that rejects pathfinding requests when
 * the source and destination are in different connected components.
 */
export class ComponentCheckTransformer implements PathTransformer {
  readonly name = "ComponentCheck";
  private readonly uf: UnionFind;

  constructor(uf: UnionFind) {
    this.uf = uf;
  }

  preCheck(from: number, to: number): PathResult | null {
    if (this.uf.connected(from, to)) {
      return null; // same component, proceed with pathfinding
    }
    return noPath(0);
  }
}
