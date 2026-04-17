import { describe, it, expect } from "vitest";
import { HyperlanePathfinder } from "@core/pathfinding/HyperlanePathfinder";
import { HyperlaneAdapter, StarMap } from "@core/pathfinding/HyperlaneAdapter";
import { aStar } from "@core/pathfinding/AStar";

/**
 * Build a 10-system mock star map.
 *
 * Layout (approximate):
 *   0 -- 1 -- 2 -- 3 -- 4
 *   |              |
 *   5 -- 6 -- 7    9
 *             |
 *             8
 *
 * Positions: systems on a rough grid.
 */
function makeMockStarMap(): StarMap {
  const systemCount = 10;
  const systemX = new Float32Array([0, 10, 20, 30, 40, 0, 10, 20, 20, 30]);
  const systemY = new Float32Array([0, 0, 0, 0, 0, 10, 10, 10, 20, 10]);

  // Edges (bidirectional):
  // 0-1, 1-2, 2-3, 3-4, 0-5, 5-6, 6-7, 7-8, 3-9
  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [3, 9],
  ];

  // Build CSR
  const degree = new Uint32Array(systemCount);
  for (const [a, b] of edges) {
    degree[a]++;
    degree[b]++;
  }
  const adjOffset = new Uint32Array(systemCount + 1);
  for (let i = 0; i < systemCount; i++) {
    adjOffset[i + 1] = adjOffset[i] + degree[i];
  }
  const adjList = new Uint32Array(adjOffset[systemCount]);
  const cursor = new Uint32Array(systemCount);
  for (let i = 0; i < systemCount; i++) cursor[i] = adjOffset[i];
  for (const [a, b] of edges) {
    adjList[cursor[a]++] = b;
    adjList[cursor[b]++] = a;
  }

  return { systemCount, systemX, systemY, adjOffset, adjList };
}

describe("HyperlanePathfinder", () => {
  it("finds path between adjacent systems", () => {
    const map = makeMockStarMap();
    const pf = new HyperlanePathfinder(map);
    const result = pf.findPath(0, 1);
    expect(result.found).toBe(true);
    expect(result.path).toEqual([0, 1]);
    expect(result.cost).toBeCloseTo(10, 0);
  });

  it("finds shortest path across the map", () => {
    const map = makeMockStarMap();
    const pf = new HyperlanePathfinder(map);
    const result = pf.findPath(0, 4);
    expect(result.found).toBe(true);
    expect(result.path[0]).toBe(0);
    expect(result.path[result.path.length - 1]).toBe(4);
    // Direct route 0-1-2-3-4 should be chosen
    expect(result.path).toEqual([0, 1, 2, 3, 4]);
  });

  it("finds path from branch to branch", () => {
    const map = makeMockStarMap();
    const pf = new HyperlanePathfinder(map);
    // From 8 (bottom branch) to 4 (right end)
    const result = pf.findPath(8, 4);
    expect(result.found).toBe(true);
    expect(result.path[0]).toBe(8);
    expect(result.path[result.path.length - 1]).toBe(4);
  });

  it("returns no path when disconnected", () => {
    // Create a map with 2 disconnected components
    const systemCount = 4;
    const systemX = new Float32Array([0, 10, 100, 110]);
    const systemY = new Float32Array([0, 0, 0, 0]);
    const edges: [number, number][] = [[0, 1], [2, 3]];
    const degree = new Uint32Array(systemCount);
    for (const [a, b] of edges) { degree[a]++; degree[b]++; }
    const adjOffset = new Uint32Array(systemCount + 1);
    for (let i = 0; i < systemCount; i++) adjOffset[i + 1] = adjOffset[i] + degree[i];
    const adjList = new Uint32Array(adjOffset[systemCount]);
    const cursor = new Uint32Array(systemCount);
    for (let i = 0; i < systemCount; i++) cursor[i] = adjOffset[i];
    for (const [a, b] of edges) {
      adjList[cursor[a]++] = b;
      adjList[cursor[b]++] = a;
    }
    const map: StarMap = { systemCount, systemX, systemY, adjOffset, adjList };

    const pf = new HyperlanePathfinder(map);
    const result = pf.findPath(0, 3);
    expect(result.found).toBe(false);
  });

  it("handles same start and goal", () => {
    const map = makeMockStarMap();
    const pf = new HyperlanePathfinder(map);
    const result = pf.findPath(5, 5);
    expect(result.found).toBe(true);
    expect(result.path).toEqual([5]);
    expect(result.cost).toBe(0);
  });

  it("finds path to dead-end system 9", () => {
    const map = makeMockStarMap();
    const pf = new HyperlanePathfinder(map);
    const result = pf.findPath(0, 9);
    expect(result.found).toBe(true);
    expect(result.path[result.path.length - 1]).toBe(9);
    // Must go through 3
    expect(result.path).toContain(3);
  });
});
