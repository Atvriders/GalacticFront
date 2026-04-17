/**
 * Union-Find (Disjoint Set Union) with path compression and union by rank.
 * Used for fast connected-component queries (e.g. wormhole networks).
 */
export class UnionFind {
  private parent: Uint32Array;
  private rank: Uint8Array;
  private readonly size: number;

  constructor(size: number) {
    this.size = size;
    this.parent = new Uint32Array(size);
    this.rank = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      this.parent[i] = i;
    }
  }

  /** Find the root representative of the set containing `x`. */
  find(x: number): number {
    while (this.parent[x] !== x) {
      // path compression: point to grandparent
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }

  /** Merge the sets containing `a` and `b`. */
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    // union by rank
    if (this.rank[ra] < this.rank[rb]) {
      this.parent[ra] = rb;
    } else if (this.rank[ra] > this.rank[rb]) {
      this.parent[rb] = ra;
    } else {
      this.parent[rb] = ra;
      this.rank[ra]++;
    }
  }

  /** Check if `a` and `b` are in the same connected component. */
  connected(a: number, b: number): boolean {
    return this.find(a) === this.find(b);
  }

  /** Get the component id (root) for node `x`. */
  componentId(x: number): number {
    return this.find(x);
  }

  /**
   * Rebuild the union-find from a list of (a, b) pairs.
   * Resets all nodes to singletons first.
   */
  rebuild(pairs: Iterable<[number, number]>): void {
    for (let i = 0; i < this.size; i++) {
      this.parent[i] = i;
      this.rank[i] = 0;
    }
    for (const [a, b] of pairs) {
      this.union(a, b);
    }
  }
}
