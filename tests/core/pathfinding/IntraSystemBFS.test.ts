import { describe, it, expect } from "vitest";
import {
  intraSystemBFS,
  intraSystemDistances,
  SystemLayout,
} from "@core/pathfinding/IntraSystemBFS";

/**
 * Mock 6-planet system:
 *   0 -- 1 -- 2
 *   |         |
 *   3 -- 4    5
 */
function make6PlanetLayout(): SystemLayout {
  const adj: number[][] = [
    [1, 3],    // 0
    [0, 2],    // 1
    [1, 5],    // 2
    [0, 4],    // 3
    [3],       // 4
    [2],       // 5
  ];
  return {
    objectCount: 6,
    neighbors(obj: number, out: Uint32Array): number {
      const nb = adj[obj];
      for (let i = 0; i < nb.length; i++) out[i] = nb[i];
      return nb.length;
    },
  };
}

describe("intraSystemBFS", () => {
  it("finds shortest path between adjacent planets", () => {
    const layout = make6PlanetLayout();
    const result = intraSystemBFS(layout, 0, 1);
    expect(result.found).toBe(true);
    expect(result.path).toEqual([0, 1]);
    expect(result.distance).toBe(1);
  });

  it("finds shortest path across the system", () => {
    const layout = make6PlanetLayout();
    const result = intraSystemBFS(layout, 4, 5);
    expect(result.found).toBe(true);
    expect(result.path[0]).toBe(4);
    expect(result.path[result.path.length - 1]).toBe(5);
    // 4->3->0->1->2->5 = 5 hops
    expect(result.distance).toBe(5);
  });

  it("returns self-path for same source and dest", () => {
    const layout = make6PlanetLayout();
    const result = intraSystemBFS(layout, 3, 3);
    expect(result.found).toBe(true);
    expect(result.path).toEqual([3]);
    expect(result.distance).toBe(0);
  });

  it("returns not found when disconnected", () => {
    // Layout with isolated node
    const layout: SystemLayout = {
      objectCount: 3,
      neighbors(obj: number, out: Uint32Array): number {
        if (obj === 0) { out[0] = 1; return 1; }
        if (obj === 1) { out[0] = 0; return 1; }
        return 0; // node 2 isolated
      },
    };
    const result = intraSystemBFS(layout, 0, 2);
    expect(result.found).toBe(false);
    expect(result.distance).toBe(-1);
  });

  it("finds path from leaf to leaf", () => {
    const layout = make6PlanetLayout();
    // 4 and 5 are leaves
    const result = intraSystemBFS(layout, 4, 2);
    expect(result.found).toBe(true);
    // 4->3->0->1->2 = 4 hops
    expect(result.distance).toBe(4);
  });
});

describe("intraSystemDistances", () => {
  it("computes all distances from source", () => {
    const layout = make6PlanetLayout();
    const dist = intraSystemDistances(layout, 0);
    expect(dist[0]).toBe(0);
    expect(dist[1]).toBe(1);
    expect(dist[2]).toBe(2);
    expect(dist[3]).toBe(1);
    expect(dist[4]).toBe(2);
    expect(dist[5]).toBe(3);
  });

  it("marks unreachable nodes as 255", () => {
    const layout: SystemLayout = {
      objectCount: 3,
      neighbors(obj: number, out: Uint32Array): number {
        if (obj === 0) { out[0] = 1; return 1; }
        if (obj === 1) { out[0] = 0; return 1; }
        return 0;
      },
    };
    const dist = intraSystemDistances(layout, 0);
    expect(dist[2]).toBe(255);
  });
});
