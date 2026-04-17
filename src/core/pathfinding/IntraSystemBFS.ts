/**
 * Layout of objects within a single star system.
 */
export interface SystemLayout {
  /** Number of objects (planets, stations, etc.) in this system. */
  objectCount: number;
  /**
   * Fill `out` with neighbor object indices of `obj` and return count written.
   * Neighbors represent direct connections (orbital links, etc.).
   */
  neighbors(obj: number, out: Uint32Array): number;
}

/**
 * Result of an intra-system BFS search.
 */
export interface BFSResult {
  /** Ordered path from `from` to `to` (inclusive). Empty if not found. */
  path: number[];
  /** Number of hops. -1 if not found. */
  distance: number;
  /** Whether a path was found. */
  found: boolean;
}

/**
 * BFS within a single star system to find shortest hop-count path.
 */
export function intraSystemBFS(
  layout: SystemLayout,
  from: number,
  to: number
): BFSResult {
  if (from === to) {
    return { path: [from], distance: 0, found: true };
  }

  const n = layout.objectCount;
  const visited = new Uint8Array(n);
  const parent = new Int32Array(n);
  parent.fill(-1);
  visited[from] = 1;

  const queue: number[] = [from];
  const neighborBuf = new Uint32Array(64);
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    const count = layout.neighbors(current, neighborBuf);
    for (let i = 0; i < count; i++) {
      const nb = neighborBuf[i];
      if (visited[nb]) continue;
      visited[nb] = 1;
      parent[nb] = current;
      if (nb === to) {
        // reconstruct path
        const path: number[] = [];
        let node = to;
        while (node !== from) {
          path.push(node);
          node = parent[node];
        }
        path.push(from);
        path.reverse();
        return { path, distance: path.length - 1, found: true };
      }
      queue.push(nb);
    }
  }

  return { path: [], distance: -1, found: false };
}

/**
 * Compute distances from a single source to all objects in the system.
 * Returns a Uint8Array where distances[i] = hop count from `from` to `i`.
 * Unreachable nodes have value 255.
 */
export function intraSystemDistances(
  layout: SystemLayout,
  from: number
): Uint8Array {
  const n = layout.objectCount;
  const dist = new Uint8Array(n);
  dist.fill(255);
  dist[from] = 0;

  const queue: number[] = [from];
  const neighborBuf = new Uint32Array(64);
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    const count = layout.neighbors(current, neighborBuf);
    for (let i = 0; i < count; i++) {
      const nb = neighborBuf[i];
      if (dist[nb] !== 255) continue;
      dist[nb] = dist[current] + 1;
      queue.push(nb);
    }
  }

  return dist;
}
