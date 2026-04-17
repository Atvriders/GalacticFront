import type { StationNetwork } from "./StationAdapter";
import type { PathResult } from "./PathResult";
import { StationAdapter } from "./StationAdapter";
import { UnionFind } from "./UnionFind";
import { MinHeap } from "./MinHeap";
import { aStar } from "./AStar";
import { noPath } from "./PathResult";

/**
 * Station (Hyperloop) pathfinder with cluster-aware connectivity check.
 */
export class StationPathfinder {
  private adapter: StationAdapter;
  private queue: MinHeap;
  private uf: UnionFind;
  private readonly net: StationNetwork;

  constructor(net: StationNetwork) {
    this.net = net;
    this.adapter = new StationAdapter(net);
    this.queue = new MinHeap(net.stationCount);
    this.uf = new UnionFind(net.stationCount);
    this.rebuildComponents();
  }

  /** Find shortest path between two stations. */
  findPath(from: number, to: number): PathResult {
    // Quick connectivity check
    if (!this.uf.connected(from, to)) {
      return noPath(0);
    }
    return aStar(this.adapter, from, to, this.queue);
  }

  /** Rebuild the UnionFind from the current network connections. */
  rebuildComponents(): void {
    const pairs: [number, number][] = [];
    const buf = new Uint32Array(256);
    for (let i = 0; i < this.net.stationCount; i++) {
      const count = this.net.stationNeighbors(i, buf);
      for (let j = 0; j < count; j++) {
        if (buf[j] > i) {
          pairs.push([i, buf[j]]);
        }
      }
    }
    this.uf.rebuild(pairs);
  }

  /** Check if two stations are in the same connected cluster. */
  connected(a: number, b: number): boolean {
    return this.uf.connected(a, b);
  }
}
