import { describe, it, expect } from "vitest";
import { StationPathfinder } from "@core/pathfinding/StationPathfinder";
import { StationNetwork } from "@core/pathfinding/StationAdapter";

/**
 * 2-cluster mock network:
 * Cluster A: stations 0-1-2 (triangle at x=0..20, y=0)
 * Cluster B: stations 3-4 (pair at x=100..110, y=0)
 * No connection between clusters.
 */
function make2ClusterNetwork(): StationNetwork {
  const stationCount = 5;
  const stationX = new Float32Array([0, 10, 20, 100, 110]);
  const stationY = new Float32Array([0, 0, 0, 0, 0]);

  const adj: number[][] = [
    [1, 2],  // 0
    [0, 2],  // 1
    [0, 1],  // 2
    [4],     // 3
    [3],     // 4
  ];

  return {
    stationCount,
    stationX,
    stationY,
    stationNeighbors(station: number, out: Uint32Array): number {
      const nb = adj[station];
      for (let i = 0; i < nb.length; i++) out[i] = nb[i];
      return nb.length;
    },
  };
}

describe("StationPathfinder", () => {
  it("finds path within cluster A", () => {
    const net = make2ClusterNetwork();
    const pf = new StationPathfinder(net);
    const result = pf.findPath(0, 2);
    expect(result.found).toBe(true);
    expect(result.path[0]).toBe(0);
    expect(result.path[result.path.length - 1]).toBe(2);
  });

  it("finds path within cluster B", () => {
    const net = make2ClusterNetwork();
    const pf = new StationPathfinder(net);
    const result = pf.findPath(3, 4);
    expect(result.found).toBe(true);
    expect(result.path).toEqual([3, 4]);
  });

  it("returns no path between different clusters", () => {
    const net = make2ClusterNetwork();
    const pf = new StationPathfinder(net);
    const result = pf.findPath(0, 4);
    expect(result.found).toBe(false);
  });

  it("connectivity check works", () => {
    const net = make2ClusterNetwork();
    const pf = new StationPathfinder(net);
    expect(pf.connected(0, 2)).toBe(true);
    expect(pf.connected(3, 4)).toBe(true);
    expect(pf.connected(0, 3)).toBe(false);
  });

  it("handles same station", () => {
    const net = make2ClusterNetwork();
    const pf = new StationPathfinder(net);
    const result = pf.findPath(1, 1);
    expect(result.found).toBe(true);
    expect(result.path).toEqual([1]);
  });

  it("finds shortest path in triangle", () => {
    const net = make2ClusterNetwork();
    const pf = new StationPathfinder(net);
    // 0 to 2: direct edge (distance 20) vs via 1 (10+10=20). Either is fine.
    const result = pf.findPath(0, 2);
    expect(result.found).toBe(true);
    expect(result.cost).toBeCloseTo(20, 0);
  });
});
