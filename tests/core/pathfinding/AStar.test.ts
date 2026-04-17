import { describe, it, expect } from "vitest";
import { aStar, AStarAdapter } from "@core/pathfinding/AStar";

/**
 * Simple 4x4 grid graph:
 *  0  1  2  3
 *  4  5  6  7
 *  8  9 10 11
 * 12 13 14 15
 *
 * Movement: 4-directional, uniform cost 1.
 */
function makeGridAdapter(width: number, height: number, blocked: Set<number> = new Set()): AStarAdapter {
  const total = width * height;
  return {
    nodeCount: total,
    neighbors(node: number, out: Uint32Array): number {
      if (blocked.has(node)) return 0;
      let count = 0;
      const x = node % width;
      const y = (node / width) | 0;
      // up
      if (y > 0 && !blocked.has(node - width)) out[count++] = node - width;
      // down
      if (y < height - 1 && !blocked.has(node + width)) out[count++] = node + width;
      // left
      if (x > 0 && !blocked.has(node - 1)) out[count++] = node - 1;
      // right
      if (x < width - 1 && !blocked.has(node + 1)) out[count++] = node + 1;
      return count;
    },
    cost(): number {
      return 1;
    },
    heuristic(a: number, b: number): number {
      const ax = a % width, ay = (a / width) | 0;
      const bx = b % width, by = (b / width) | 0;
      return Math.abs(ax - bx) + Math.abs(ay - by);
    },
  };
}

describe("aStar", () => {
  it("finds shortest path on 4x4 grid", () => {
    const adapter = makeGridAdapter(4, 4);
    const result = aStar(adapter, 0, 15);
    expect(result.found).toBe(true);
    expect(result.path[0]).toBe(0);
    expect(result.path[result.path.length - 1]).toBe(15);
    // Manhattan distance from (0,0) to (3,3) = 6
    expect(result.cost).toBe(6);
    expect(result.path.length).toBe(7);
  });

  it("returns no path when goal is unreachable", () => {
    // Block all neighbors of node 15
    const blocked = new Set([11, 14]);
    const adapter = makeGridAdapter(4, 4, blocked);
    const result = aStar(adapter, 0, 15);
    expect(result.found).toBe(false);
    expect(result.path).toEqual([]);
  });

  it("handles start === goal", () => {
    const adapter = makeGridAdapter(4, 4);
    const result = aStar(adapter, 5, 5);
    expect(result.found).toBe(true);
    expect(result.path).toEqual([5]);
    expect(result.cost).toBe(0);
  });

  it("routes around obstacles", () => {
    // Block the middle row except position 11
    const blocked = new Set([4, 5, 6]);
    const adapter = makeGridAdapter(4, 4, blocked);
    const result = aStar(adapter, 0, 8);
    expect(result.found).toBe(true);
    expect(result.path[0]).toBe(0);
    expect(result.path[result.path.length - 1]).toBe(8);
    // Must go around: cost > 2
    expect(result.cost).toBeGreaterThan(2);
  });

  it("tracks iteration count", () => {
    const adapter = makeGridAdapter(4, 4);
    const result = aStar(adapter, 0, 15);
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.iterations).toBeLessThan(100);
  });

  it("finds adjacent path", () => {
    const adapter = makeGridAdapter(4, 4);
    const result = aStar(adapter, 0, 1);
    expect(result.found).toBe(true);
    expect(result.path).toEqual([0, 1]);
    expect(result.cost).toBe(1);
  });
});
